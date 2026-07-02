"use server";

import { prisma } from "@/lib/db";
import { validateContact, type FieldErrors } from "@/lib/validation";
import { makeReferralCode, referralLink } from "@/lib/referral";
import {
  derivePersona,
  deriveCampus,
  QUIZ,
  PERSONA_COPY,
  isValidHeardFrom,
  type Answers,
} from "@/lib/quiz";
import { sendEmail, welcomeEmail } from "@/lib/email";
import { getSettings } from "@/lib/settings";
import { advanceStage, trackQuizProgress } from "@/lib/funnel";
import { Prisma } from "@prisma/client";

// ============================================================
// CAPTURE — save the lead the instant we have contact info.
// Runs BEFORE the quiz so abandoners are still real leads (decision 1A).
// ============================================================

export interface CaptureResult {
  ok: boolean;
  errors?: FieldErrors;
  formError?: string;
  leadId?: string;
}

export async function captureLead(input: {
  name: string;
  whatsapp: string;
  email: string;
  heardFrom?: string; // "How did you hear about us?" (decision 3A)
  ref?: string; // referral code from ?ref= (decision 11A)
  source?: string; // utm/campaign
}): Promise<CaptureResult> {
  const v = validateContact(input);
  if (!v.ok || !v.value) return { ok: false, errors: v.errors };

  const settings = await getSettings();

  // Enforce the configurable builder cap.
  const count = await prisma.lead.count();
  if (count >= settings.builderCap) {
    return {
      ok: false,
      formError:
        "We've hit the cap for this round of builders. Join the waitlist. The next wave opens soon.",
    };
  }

  // Only store a valid heardFrom value.
  const heardFrom = isValidHeardFrom(input.heardFrom)
    ? input.heardFrom!
    : null;

  // Resolve the referrer (best-effort; a bad code just means no attribution).
  let referredById: string | null = null;
  if (input.ref) {
    const referrer = await prisma.lead.findUnique({
      where: { referralCode: input.ref },
      select: { id: true },
    });
    referredById = referrer?.id ?? null;
  }

  // Retry code generation on the astronomically-unlikely collision.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const lead = await prisma.lead.create({
        data: {
          name: v.value.name,
          whatsapp: v.value.whatsapp,
          email: v.value.email,
          heardFrom,
          referralCode: makeReferralCode(),
          referredById,
          source: input.source ?? null,
          funnelStage: "CAPTURED",
        },
        select: { id: true },
      });
      await advanceStage(lead.id, "CAPTURED");
      return { ok: true, leadId: lead.id };
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        const target = (e.meta?.target as string[] | undefined) ?? [];
        // Duplicate email = returning user. Let them continue with their record.
        if (target.includes("email")) {
          const existing = await prisma.lead.findUnique({
            where: { email: v.value.email },
            select: { id: true },
          });
          if (existing) return { ok: true, leadId: existing.id };
          return { ok: false, formError: "That email is already registered." };
        }
        // Duplicate referralCode: retry with a fresh code.
        if (target.includes("referralCode")) continue;
      }
      console.error("[captureLead] failed:", e);
      return {
        ok: false,
        formError: "Something went wrong on our end. Try again in a moment.",
      };
    }
  }
  return {
    ok: false,
    formError: "Something went wrong on our end. Try again in a moment.",
  };
}

// Fire-and-forget: the quiz UI calls this as each question is shown, so we
// know exactly where people abandon (decision 2A).
export async function reachQuizQuestion(input: {
  leadId: string;
  index: number;
}): Promise<void> {
  await trackQuizProgress(input.leadId, input.index);
}

// ============================================================
// QUALIFY — save quiz answers, derive persona, complete the lead,
// then fire the welcome email. Returns everything the ROUTE screen needs.
// ============================================================

export interface CompleteResult {
  ok: boolean;
  formError?: string;
  leadId?: string;
  builderNo?: number;
  persona?: string;
  personaTitle?: string;
  personaLine?: string;
  referralCode?: string;
  referralUrl?: string;
  whatsappUrl?: string; // tracked redirect, NOT the raw invite (decision 4A)
}

export async function completeQuiz(input: {
  leadId: string;
  answers: Answers;
}): Promise<CompleteResult> {
  const { leadId, answers } = input;

  // Only persist answers to known questions (ignore anything unexpected).
  const known = new Set(QUIZ.map((q) => q.key));
  const entries = Object.entries(answers).filter(([k]) => known.has(k));

  const persona = derivePersona(answers);
  const campus = deriveCampus(answers);

  try {
    // Upsert each answer (idempotent — retaking the quiz updates, not dupes).
    await prisma.$transaction([
      ...entries.map(([questionKey, answerValue]) =>
        prisma.quizAnswer.upsert({
          where: { leadId_questionKey: { leadId, questionKey } },
          create: { leadId, questionKey, answerValue },
          update: { answerValue },
        }),
      ),
      prisma.lead.update({
        where: { id: leadId },
        data: { persona, campus, quizCompleted: true },
      }),
    ]);
  } catch (e) {
    console.error("[completeQuiz] failed:", e);
    return {
      ok: false,
      formError: "We couldn't save your answers. Please try again.",
    };
  }

  await advanceStage(leadId, "COMPLETED");

  const lead = await prisma.lead.findUnique({
    where: { id: leadId },
    select: { builderNo: true, name: true, email: true, referralCode: true },
  });
  if (!lead) return { ok: false, formError: "Lead not found." };

  const settings = await getSettings();
  const copy = PERSONA_COPY[persona];
  const referralUrl = referralLink(lead.referralCode, settings.siteUrl);
  // The email links to the tracked redirect so email clicks count too.
  const whatsappUrl = `${settings.siteUrl.replace(/\/$/, "")}/api/wa?lead=${leadId}`;

  // Fire-and-log the welcome email (never blocks the response on failure).
  const msg = welcomeEmail({
    name: lead.name,
    builderNo: lead.builderNo,
    personaLine: copy.line,
    whatsappInvite: whatsappUrl,
    referralLink: referralUrl,
  });
  void sendEmail({ ...msg, to: lead.email });

  return {
    ok: true,
    leadId,
    builderNo: lead.builderNo,
    persona,
    personaTitle: copy.title,
    personaLine: copy.line,
    referralCode: lead.referralCode,
    referralUrl,
    whatsappUrl,
  };
}

// Live count for the "X of cap builders" scarcity counter.
export async function getBuilderCount(): Promise<{
  count: number;
  cap: number;
}> {
  const [count, settings] = await Promise.all([
    prisma.lead.count(),
    getSettings(),
  ]);
  return { count, cap: settings.builderCap };
}
