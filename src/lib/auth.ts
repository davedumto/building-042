import "server-only";
import { cookies } from "next/headers";
import crypto from "node:crypto";

// Minimal admin auth: a password check + an HMAC-signed session cookie.
// No external dependency, explicit, and secure enough for a private
// dashboard. Password + signing secret come from env.

const COOKIE = "ecm_admin";
const MAX_AGE = 60 * 60 * 12; // 12 hours

function secret(): string {
  // ADMIN_TOKEN doubles as the signing secret (already required).
  return process.env.ADMIN_TOKEN ?? "insecure-dev-secret-change-me";
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("hex");
}

// Verify the submitted password against the configured one, constant-time.
export function checkPassword(input: string): boolean {
  const expected = process.env.ADMIN_PASSWORD ?? process.env.ADMIN_TOKEN;
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

// Cookie value = "<issuedAt>.<hmac>". Tamper-proof; expires after MAX_AGE.
export async function createSession(): Promise<void> {
  const issuedAt = Math.floor(Date.now() / 1000).toString();
  const value = `${issuedAt}.${sign(issuedAt)}`;
  const jar = await cookies();
  jar.set(COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function isAuthed(): Promise<boolean> {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  if (!raw) return false;
  const [issuedAt, mac] = raw.split(".");
  if (!issuedAt || !mac) return false;

  // Signature must match.
  const expectedMac = sign(issuedAt);
  const a = Buffer.from(mac);
  const b = Buffer.from(expectedMac);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return false;

  // Not expired.
  const age = Math.floor(Date.now() / 1000) - Number(issuedAt);
  return age >= 0 && age < MAX_AGE;
}
