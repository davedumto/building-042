import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { toCsv } from "@/lib/csv";
import { heardFromLabel, PERSONA_COPY, type Persona } from "@/lib/quiz";
import { STAGE_LABEL, type FunnelStage } from "@/lib/funnel";

// Auth-guarded CSV export of ALL leads (the full field set, ignoring
// pagination — an export should be complete).
export async function GET() {
  if (!(await isAuthed())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const leads = await prisma.lead.findMany({
    orderBy: { builderNo: "asc" },
    include: {
      _count: { select: { referrals: true } },
      referredBy: { select: { builderNo: true, referralCode: true } },
    },
  });

  const headers = [
    "Builder No",
    "Name",
    "WhatsApp",
    "Email",
    "Persona",
    "Campus",
    "Heard From",
    "Funnel Stage",
    "Quiz Completed",
    "WA Clicks",
    "WA First Click",
    "WA Last Click",
    "Referral Code",
    "Referred By (No)",
    "Referred By (Code)",
    "Referrals Made",
    "Source",
    "Created At",
  ];

  const rows = leads.map((l) => [
    l.builderNo,
    l.name,
    l.whatsapp,
    l.email,
    l.persona ? PERSONA_COPY[l.persona as Persona]?.title ?? l.persona : "",
    l.campus ?? "",
    heardFromLabel(l.heardFrom),
    STAGE_LABEL[l.funnelStage as FunnelStage] ?? l.funnelStage,
    l.quizCompleted ? "Yes" : "No",
    l.waClicks,
    l.waFirstClickAt ? l.waFirstClickAt.toISOString() : "",
    l.waLastClickAt ? l.waLastClickAt.toISOString() : "",
    l.referralCode,
    l.referredBy?.builderNo ?? "",
    l.referredBy?.referralCode ?? "",
    l._count.referrals,
    l.source ?? "",
    l.createdAt.toISOString(),
  ]);

  const csv = toCsv(headers, rows);
  // Build a dated filename. (Date is fine here — this is request-time, not a
  // workflow script.)
  const stamp = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="enugu-builders-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
