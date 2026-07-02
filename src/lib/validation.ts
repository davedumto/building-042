// Input validation for the capture step. Explicit over clever (per prefs):
// plain functions returning a typed result, easy to test, no schema lib needed.

export interface ValidatedContact {
  name: string;
  whatsapp: string; // normalized to +234... where possible
  email: string;
}

export type FieldErrors = Partial<Record<"name" | "whatsapp" | "email", string>>;

export interface ValidationResult {
  ok: boolean;
  errors: FieldErrors;
  value?: ValidatedContact;
}

// Normalizes common Nigerian number formats to E.164 (+234...).
//  08012345678       -> +2348012345678
//  8012345678        -> +2348012345678
//  2348012345678     -> +2348012345678
//  +2348012345678    -> +2348012345678
// Non-Nigerian / already-plus numbers are kept if they look like phone numbers.
export function normalizeWhatsapp(raw: string): string | null {
  const trimmed = raw.trim();
  const digits = trimmed.replace(/[^\d+]/g, "");

  if (/^\+\d{10,15}$/.test(digits)) return digits; // already E.164-ish

  const bare = digits.replace(/\D/g, "");
  if (/^0\d{10}$/.test(bare)) return "+234" + bare.slice(1); // 0801...
  if (/^234\d{10}$/.test(bare)) return "+" + bare; // 234801...
  if (/^\d{10}$/.test(bare)) return "+234" + bare; // 801...

  // Fallback: accept any 10-15 digit international number.
  if (/^\d{10,15}$/.test(bare)) return "+" + bare;

  return null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContact(input: {
  name?: string;
  whatsapp?: string;
  email?: string;
}): ValidationResult {
  const errors: FieldErrors = {};

  const name = (input.name ?? "").trim();
  if (name.length < 2) errors.name = "Tell us your name.";
  if (name.length > 80) errors.name = "That name is a bit long.";

  const whatsappRaw = (input.whatsapp ?? "").trim();
  const whatsapp = normalizeWhatsapp(whatsappRaw);
  if (!whatsappRaw) errors.whatsapp = "We need your WhatsApp number.";
  else if (!whatsapp)
    errors.whatsapp = "That doesn't look like a valid number.";

  const email = (input.email ?? "").trim().toLowerCase();
  if (!email) errors.email = "We need your email.";
  else if (!EMAIL_RE.test(email)) errors.email = "That email looks off.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    errors: {},
    value: { name, whatsapp: whatsapp!, email },
  };
}
