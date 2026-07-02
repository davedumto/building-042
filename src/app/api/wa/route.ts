import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { advanceStage } from "@/lib/funnel";

// Tracked WhatsApp redirect (decision 4A).
// The "Join the WhatsApp community" button points here, not at the raw invite.
// We record the click server-side (per-user count + event + stage), then
// 302-redirect to the real invite. Reliable, survives flaky JS, and works
// from the welcome email too.
export async function GET(req: NextRequest) {
  const settings = await getSettings();
  const leadId = req.nextUrl.searchParams.get("lead");

  if (leadId) {
    try {
      const now = new Date();
      const existing = await prisma.lead.findUnique({
        where: { id: leadId },
        select: { waClicks: true, waFirstClickAt: true },
      });
      if (existing) {
        await prisma.lead.update({
          where: { id: leadId },
          data: {
            waClicks: { increment: 1 },
            waFirstClickAt: existing.waFirstClickAt ?? now,
            waLastClickAt: now,
          },
        });
        // Log every click (so waClicks and the event count agree), and
        // advance the furthest stage to JOINED_WHATSAPP.
        await advanceStage(leadId, "JOINED_WHATSAPP", "wa_click");
      }
    } catch (e) {
      // Never block the redirect on a tracking failure.
      console.error("[api/wa] tracking failed:", e);
    }
  }

  return NextResponse.redirect(settings.whatsappInvite, { status: 302 });
}
