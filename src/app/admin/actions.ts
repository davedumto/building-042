"use server";

import { redirect } from "next/navigation";
import { checkPassword, createSession, destroySession, isAuthed } from "@/lib/auth";
import { saveSettings, SETTING_KEYS, type SettingKey } from "@/lib/settings";

export interface LoginState {
  error?: string;
}

// Login form action. On success, sets the session cookie and redirects.
export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const password = String(formData.get("password") ?? "");
  if (!checkPassword(password)) {
    return { error: "Wrong password." };
  }
  await createSession();
  redirect("/admin");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/admin/login");
}

export interface SettingsState {
  ok?: boolean;
  error?: string;
}

// Save the editable settings (WhatsApp link, cap, site URL). Auth-guarded.
export async function updateSettings(
  _prev: SettingsState,
  formData: FormData,
): Promise<SettingsState> {
  if (!(await isAuthed())) return { error: "Not authorized." };

  const values: Partial<Record<SettingKey, string>> = {};
  const whatsapp = String(formData.get("WHATSAPP_INVITE") ?? "").trim();
  const cap = String(formData.get("BUILDER_CAP") ?? "").trim();
  const siteUrl = String(formData.get("SITE_URL") ?? "").trim();

  if (whatsapp) values[SETTING_KEYS.WHATSAPP_INVITE] = whatsapp;
  if (siteUrl) values[SETTING_KEYS.SITE_URL] = siteUrl;
  if (cap) {
    const n = Number.parseInt(cap, 10);
    if (!Number.isFinite(n) || n <= 0) {
      return { error: "Builder cap must be a positive number." };
    }
    values[SETTING_KEYS.BUILDER_CAP] = String(n);
  }

  try {
    await saveSettings(values);
    return { ok: true };
  } catch (e) {
    console.error("[updateSettings] failed:", e);
    return { error: "Couldn't save settings." };
  }
}
