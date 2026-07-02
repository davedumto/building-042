// End-to-end funnel verification against the real dev DB + real server actions.
// Run: NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verify-funnel.ts
import {
  captureLead,
  completeQuiz,
  getBuilderCount,
  reachQuizQuestion,
} from "@/app/actions";
import { prisma } from "@/lib/db";
import { getSettings, saveSettings } from "@/lib/settings";
import { stageRank } from "@/lib/funnel";

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error("ASSERT FAILED: " + msg);
  console.log("  ✓ " + msg);
}

async function main() {
  // Clean slate for a deterministic run.
  await prisma.quizAnswer.deleteMany();
  await prisma.lead.deleteMany();

  console.log("\n[1] CAPTURE — validation rejects bad input");
  const bad = await captureLead({ name: "", whatsapp: "abc", email: "nope" });
  assert(!bad.ok, "bad input rejected");
  assert(bad.errors?.name && bad.errors?.whatsapp && bad.errors?.email, "all three field errors present");

  console.log("\n[2] CAPTURE — a real lead is saved instantly (before quiz)");
  const cap1 = await captureLead({
    name: "Amaka Asadu",
    whatsapp: "08012345678",
    email: "amaka@example.com",
    source: "campus-wars",
  });
  assert(cap1.ok && cap1.leadId, "lead captured, id returned");
  const saved = await prisma.lead.findUnique({ where: { id: cap1.leadId! } });
  assert(saved?.whatsapp === "+2348012345678", "whatsapp normalized to E.164");
  assert(saved?.quizCompleted === false, "lead exists but quiz not yet completed (abandoner-safe)");
  assert(saved?.referralCode?.startsWith("BUILD-"), "referral code generated: " + saved?.referralCode);
  assert(saved?.source === "campus-wars", "source attribution stored");
  const referrerCode = saved!.referralCode;

  console.log("\n[3] QUALIFY — quiz completes, persona derived, answers stored");
  const done = await completeQuiz({
    leadId: cap1.leadId!,
    answers: {
      what_you_build: "fashion",
      stage: "inconsistent",
      blocker: "clients",
      student: "IMT",
      win: "clients",
    },
  });
  assert(done.ok, "quiz completed");
  assert(done.persona === "FASHION_ENTREPRENEUR", "persona = FASHION_ENTREPRENEUR");
  assert(done.builderNo && done.builderNo > 0, "builder number assigned: " + done.builderNo);
  const answers = await prisma.quizAnswer.count({ where: { leadId: cap1.leadId! } });
  assert(answers === 5, "all 5 answers stored (" + answers + ")");
  const afterQuiz = await prisma.lead.findUnique({ where: { id: cap1.leadId! } });
  assert(afterQuiz?.campus === "IMT", "campus IMT captured (feeds Campus Wars)");
  assert(afterQuiz?.quizCompleted === true, "quizCompleted flipped to true");

  console.log("\n[4] REFERRAL — a second lead referred by the first is attributed");
  const cap2 = await captureLead({
    name: "Chinedu Okeke",
    whatsapp: "0803 111 2222",
    email: "chinedu@example.com",
    ref: referrerCode,
  });
  assert(cap2.ok, "referred lead captured");
  const referred = await prisma.lead.findUnique({ where: { id: cap2.leadId! } });
  assert(referred?.referredById === cap1.leadId, "referredById points to the referrer");

  console.log("\n[5] DUPLICATE EMAIL — returning user gets their existing record");
  const dup = await captureLead({
    name: "Amaka Again",
    whatsapp: "08012345678",
    email: "amaka@example.com",
  });
  assert(dup.ok && dup.leadId === cap1.leadId, "duplicate email returns existing leadId");

  console.log("\n[6] IDEMPOTENT QUIZ — retaking updates, doesn't duplicate answers");
  await completeQuiz({
    leadId: cap1.leadId!,
    answers: { what_you_build: "business", stage: "running", blocker: "network", student: "no", win: "partnerships" },
  });
  const answers2 = await prisma.lead.findUnique({
    where: { id: cap1.leadId! },
    include: { _count: { select: { answers: true } } },
  });
  assert(answers2?._count.answers === 5, "still exactly 5 answers after retake");
  assert(answers2?.persona === "FOUNDER", "persona updated to FOUNDER on retake");
  assert(answers2?.campus === null, "campus cleared when they answer 'no'");

  console.log("\n[7] COUNTER — reflects real lead count");
  const { count, cap } = await getBuilderCount();
  assert(count === 2, "counter shows 2 builders");
  assert(cap === 300, "cap is 300 (env/default)");

  console.log("\n[8] HEARD-FROM — stored on capture, junk rejected");
  const cap3 = await captureLead({
    name: "Ngozi Eze",
    whatsapp: "08099998888",
    email: "ngozi@example.com",
    heardFrom: "instagram",
  });
  const ngozi = await prisma.lead.findUnique({ where: { id: cap3.leadId! } });
  assert(ngozi?.heardFrom === "instagram", "valid heardFrom stored");
  const cap4 = await captureLead({
    name: "Junk Heard",
    whatsapp: "08077776666",
    email: "junk@example.com",
    heardFrom: "not-a-real-source",
  });
  const junk = await prisma.lead.findUnique({ where: { id: cap4.leadId! } });
  assert(junk?.heardFrom === null, "invalid heardFrom rejected -> null");

  console.log("\n[9] ABANDONMENT — funnel stage tracks where they stopped");
  // Ngozi reaches Q3 then abandons (never completes).
  await reachQuizQuestion({ leadId: cap3.leadId!, index: 0 });
  await reachQuizQuestion({ leadId: cap3.leadId!, index: 1 });
  await reachQuizQuestion({ leadId: cap3.leadId!, index: 2 });
  const ngozi2 = await prisma.lead.findUnique({ where: { id: cap3.leadId! } });
  assert(ngozi2?.funnelStage === "QUIZ_Q3", "abandoner stuck at QUIZ_Q3");
  assert(ngozi2?.quizCompleted === false, "abandoner not marked completed");
  const events = await prisma.funnelEvent.count({ where: { leadId: cap3.leadId! } });
  assert(events >= 4, "funnel events logged (captured + 3 questions): " + events);

  console.log("\n[10] STAGE NEVER GOES BACKWARD (clicking 'Back' in quiz)");
  await reachQuizQuestion({ leadId: cap3.leadId!, index: 1 }); // go back to Q2
  const ngozi3 = await prisma.lead.findUnique({ where: { id: cap3.leadId! } });
  assert(ngozi3?.funnelStage === "QUIZ_Q3", "furthest stage still QUIZ_Q3");
  assert(ngozi3?.lastQuizIndex === 1, "current position updated to Q2 (index 1)");

  console.log("\n[11] WHATSAPP CLICKS — per-user count increments");
  // Simulate what /api/wa does (the route itself is exercised via HTTP separately).
  const now = new Date();
  await prisma.lead.update({
    where: { id: cap1.leadId! },
    data: { waClicks: { increment: 1 }, waFirstClickAt: now, waLastClickAt: now },
  });
  await prisma.lead.update({
    where: { id: cap1.leadId! },
    data: { waClicks: { increment: 1 }, waLastClickAt: now },
  });
  const clicker = await prisma.lead.findUnique({ where: { id: cap1.leadId! } });
  assert(clicker?.waClicks === 2, "waClicks incremented to 2 for the user");
  assert(clicker?.waFirstClickAt != null, "first click timestamp set");

  console.log("\n[12] SETTINGS — DB overrides env, cap takes effect");
  await saveSettings({ WHATSAPP_INVITE: "https://chat.whatsapp.com/REALLINK", BUILDER_CAP: "5" });
  const s = await getSettings();
  assert(s.whatsappInvite === "https://chat.whatsapp.com/REALLINK", "WA link overridden from DB");
  assert(s.builderCap === 5, "cap overridden to 5 from DB");
  const { cap: newCap } = await getBuilderCount();
  assert(newCap === 5, "getBuilderCount reflects DB cap");
  // reset cap so the running app stays usable
  await saveSettings({ BUILDER_CAP: "300" });

  console.log("\n[13] STAGE RANK ordering is monotonic");
  assert(stageRank("CAPTURED") < stageRank("QUIZ_Q3"), "CAPTURED < QUIZ_Q3");
  assert(stageRank("QUIZ_Q5") < stageRank("COMPLETED"), "QUIZ_Q5 < COMPLETED");
  assert(stageRank("COMPLETED") < stageRank("JOINED_WHATSAPP"), "COMPLETED < JOINED_WHATSAPP");

  console.log("\n✅ ALL FUNNEL CHECKS PASSED\n");

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("\n❌ VERIFICATION FAILED:", e);
  process.exit(1);
});
