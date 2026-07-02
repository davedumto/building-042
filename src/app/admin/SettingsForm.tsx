"use client";

import { useActionState } from "react";
import { updateSettings, type SettingsState } from "@/app/admin/actions";

const initial: SettingsState = {};

export default function SettingsForm({
  whatsappInvite,
  builderCap,
  siteUrl,
}: {
  whatsappInvite: string;
  builderCap: number;
  siteUrl: string;
}) {
  const [state, formAction, pending] = useActionState(updateSettings, initial);

  return (
    <form
      action={formAction}
      className="border border-line rounded-2xl bg-white p-6 space-y-5"
    >
      <div>
        <label htmlFor="WHATSAPP_INVITE" className="field-label">
          WhatsApp community invite link
        </label>
        <input
          id="WHATSAPP_INVITE"
          name="WHATSAPP_INVITE"
          className="field font-[family-name:var(--font-mono)] text-sm"
          defaultValue={whatsappInvite}
          placeholder="https://chat.whatsapp.com/…"
        />
        <p className="serial mt-2">
          Where the &quot;Join the WhatsApp community&quot; button sends people.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <div>
          <label htmlFor="BUILDER_CAP" className="field-label">
            Builder cap (round limit)
          </label>
          <input
            id="BUILDER_CAP"
            name="BUILDER_CAP"
            type="number"
            min={1}
            className="field"
            defaultValue={builderCap}
          />
        </div>
        <div>
          <label htmlFor="SITE_URL" className="field-label">
            Public site URL
          </label>
          <input
            id="SITE_URL"
            name="SITE_URL"
            className="field font-[family-name:var(--font-mono)] text-sm"
            defaultValue={siteUrl}
            placeholder="https://…"
          />
          <p className="serial mt-2">Used to build referral links.</p>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </button>
        {state.ok && <span className="text-green font-medium">Saved ✓</span>}
        {state.error && <span className="error-text">{state.error}</span>}
      </div>
    </form>
  );
}
