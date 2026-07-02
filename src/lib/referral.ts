// Referral code generation for the Creative Bounty (decision 4A).
// Codes are short, unambiguous, and shareable in WhatsApp.

// Excludes easily-confused chars (0/O, 1/I/L).
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// Generates a readable code like "BUILD-7KQP". The BUILD- prefix makes the
// referral link legible and on-brand: /?ref=BUILD-7KQP
export function makeReferralCode(): string {
  let body = "";
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  for (const b of bytes) body += ALPHABET[b % ALPHABET.length];
  return `BUILD-${body}`;
}

// Builds the full shareable link for a code. Pass the site URL from
// settings; falls back to env / localhost.
export function referralLink(code: string, siteUrl?: string): string {
  const base =
    siteUrl ?? process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/?ref=${encodeURIComponent(code)}`;
}
