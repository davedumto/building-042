import "server-only";
import { prisma } from "@/lib/db";

// Funnel stages, ordered. The Lead.funnelStage always holds the FURTHEST
// stage reached; we never move a lead backwards. This drives the drop-off
// chart (decision 2A).
export const FUNNEL_STAGES = [
  "CAPTURED", // gave contact info
  "QUIZ_Q1", // reached question 1
  "QUIZ_Q2",
  "QUIZ_Q3",
  "QUIZ_Q4",
  "QUIZ_Q5",
  "COMPLETED", // finished the quiz
  "JOINED_WHATSAPP", // clicked the WhatsApp invite
] as const;

export type FunnelStage = (typeof FUNNEL_STAGES)[number];

export function stageRank(stage: string): number {
  const i = FUNNEL_STAGES.indexOf(stage as FunnelStage);
  return i === -1 ? 0 : i;
}

// Human labels for the admin chart.
export const STAGE_LABEL: Record<FunnelStage, string> = {
  CAPTURED: "Captured contact",
  QUIZ_Q1: "Started quiz (Q1)",
  QUIZ_Q2: "Reached Q2",
  QUIZ_Q3: "Reached Q3",
  QUIZ_Q4: "Reached Q4",
  QUIZ_Q5: "Reached Q5",
  COMPLETED: "Completed quiz",
  JOINED_WHATSAPP: "Joined WhatsApp",
};

// Advance a lead to `stage` only if it's further than where they are.
// Always logs a FunnelEvent for the timeline (even repeats, so we can see
// e.g. multiple WhatsApp clicks). Never throws — tracking must not break UX.
export async function advanceStage(
  leadId: string,
  stage: FunnelStage,
  meta?: string,
): Promise<void> {
  try {
    const lead = await prisma.lead.findUnique({
      where: { id: leadId },
      select: { funnelStage: true },
    });
    if (!lead) return;

    const data: { funnelStage?: string } = {};
    if (stageRank(stage) > stageRank(lead.funnelStage)) {
      data.funnelStage = stage;
    }

    await prisma.$transaction([
      prisma.funnelEvent.create({ data: { leadId, stage, meta: meta ?? null } }),
      ...(data.funnelStage
        ? [prisma.lead.update({ where: { id: leadId }, data })]
        : []),
    ]);
  } catch (e) {
    console.error("[funnel] advanceStage failed:", e);
  }
}

// Record that a lead reached quiz question at 0-based `index`.
// Advances the furthest stage (never backward, even if they hit "Back"),
// but always records lastQuizIndex so we know where they currently are.
export async function trackQuizProgress(
  leadId: string,
  index: number,
): Promise<void> {
  const stage = `QUIZ_Q${index + 1}` as FunnelStage;
  if (!FUNNEL_STAGES.includes(stage)) return;

  // advanceStage handles the "furthest reached" logic + event log.
  await advanceStage(leadId, stage, `reached_q${index + 1}`);

  // lastQuizIndex tracks CURRENT position (may go up or down as they navigate).
  await prisma.lead
    .update({ where: { id: leadId }, data: { lastQuizIndex: index } })
    .catch(() => {});
}
