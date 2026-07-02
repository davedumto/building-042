import "server-only";
import { prisma } from "@/lib/db";

// DB-backed, admin-editable configuration (decision 1A).
// Reads fall back to env vars when a key hasn't been set in the DB, so the
// app works before anyone touches the admin, and env stays the default.

export const SETTING_KEYS = {
  WHATSAPP_INVITE: "WHATSAPP_INVITE",
  BUILDER_CAP: "BUILDER_CAP",
  SITE_URL: "SITE_URL",
} as const;

export type SettingKey = (typeof SETTING_KEYS)[keyof typeof SETTING_KEYS];

// Env fallback for each key.
const ENV_FALLBACK: Record<SettingKey, string | undefined> = {
  WHATSAPP_INVITE: process.env.NEXT_PUBLIC_WHATSAPP_INVITE,
  BUILDER_CAP: process.env.NEXT_PUBLIC_BUILDER_CAP,
  SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
};

const HARD_DEFAULT: Record<SettingKey, string> = {
  WHATSAPP_INVITE: "https://chat.whatsapp.com",
  BUILDER_CAP: "300",
  SITE_URL: "http://localhost:3000",
};

export interface AppSettings {
  whatsappInvite: string;
  builderCap: number;
  siteUrl: string;
}

// Load all settings in one query (DB overrides env overrides hard default).
export async function getSettings(): Promise<AppSettings> {
  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((r) => [r.key, r.value]));

  const resolve = (key: SettingKey): string =>
    map.get(key) ?? ENV_FALLBACK[key] ?? HARD_DEFAULT[key];

  const capRaw = resolve("BUILDER_CAP");
  const cap = Number.parseInt(capRaw, 10);

  return {
    whatsappInvite: resolve("WHATSAPP_INVITE"),
    builderCap: Number.isFinite(cap) && cap > 0 ? cap : 300,
    siteUrl: resolve("SITE_URL"),
  };
}

// Upsert a batch of settings from the admin form.
export async function saveSettings(
  values: Partial<Record<SettingKey, string>>,
): Promise<void> {
  const entries = Object.entries(values).filter(
    ([, v]) => v !== undefined && v !== null,
  ) as [SettingKey, string][];

  await prisma.$transaction(
    entries.map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        create: { key, value: value.trim() },
        update: { value: value.trim() },
      }),
    ),
  );
}
