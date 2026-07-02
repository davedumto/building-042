import "server-only";
import nodemailer from "nodemailer";

// Thin, swappable email interface. During the test we send low-volume
// transactional "you're in" emails over SMTP (Nodemailer). At September
// scale, swap the transport here (to a real ESP) WITHOUT touching callers.

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

let transporter: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter | null {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  if (!host) return null; // no SMTP configured -> console mode
  transporter = nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT ?? 587) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
  return transporter;
}

// Never throws — email failure must not break lead capture.
export async function sendEmail(msg: EmailMessage): Promise<boolean> {
  const from = process.env.EMAIL_FROM ?? "The Enugu Creative Movement";
  const tx = getTransport();

  if (!tx) {
    // Dev / unconfigured: log instead of send so the funnel still works.
    console.log(
      `\n[email:console-mode] To: ${msg.to}\nSubject: ${msg.subject}\n${msg.text}\n`,
    );
    return true;
  }

  try {
    await tx.sendMail({
      from,
      to: msg.to,
      subject: msg.subject,
      text: msg.text,
      html: msg.html,
    });
    return true;
  } catch (err) {
    console.error("[email] send failed:", err);
    return false;
  }
}

// The "you're in" welcome email, personalized by builder number + persona.
export function welcomeEmail(params: {
  name: string;
  builderNo: number;
  personaLine: string;
  whatsappInvite: string;
  referralLink: string;
}): EmailMessage {
  const serial = `Builder No. ${String(params.builderNo).padStart(4, "0")}`;
  const subject = `You're in, ${params.name.split(" ")[0]} · ${serial} / Enugu`;
  const text = [
    `${serial} / Enugu`,
    ``,
    `${params.personaLine}`,
    ``,
    `Join the WhatsApp community: ${params.whatsappInvite}`,
    `Your referral link (share it, earn the bounty): ${params.referralLink}`,
    ``,
    `The Enugu Creative Movement`,
  ].join("\n");

  const html = `
  <div style="font-family:Inter,Arial,sans-serif;background:#faf9f1;padding:32px;color:#111">
    <div style="max-width:520px;margin:auto;background:#fff;border:1px solid #e3e0d1;border-radius:16px;padding:32px">
      <p style="font-family:monospace;letter-spacing:2px;color:#0f9d58;margin:0 0 8px">${serial} / ENUGU</p>
      <h1 style="font-size:26px;margin:0 0 16px">You're in, ${escapeHtml(params.name.split(" ")[0])}.</h1>
      <p style="color:#3a3a36;line-height:1.6">${escapeHtml(params.personaLine)}</p>
      <a href="${params.whatsappInvite}" style="display:inline-block;background:#12b368;color:#fff;text-decoration:none;padding:14px 22px;border-radius:999px;font-weight:600;margin:16px 0">Join the WhatsApp community →</a>
      <p style="color:#6b7280;font-size:14px;margin-top:24px">Share your link, earn the Creative Bounty:</p>
      <p style="font-family:monospace;font-size:14px;background:#f2f0e3;padding:12px;border-radius:8px;word-break:break-all">${params.referralLink}</p>
      <p style="color:#6b7280;font-size:13px;margin-top:24px">The Enugu Creative Movement</p>
    </div>
  </div>`;

  return { to: "", subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
