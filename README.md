# The Enugu Creative Movement — Lead Onboarding

A branded lead-capture onboarding flow. Turns "Who is building Enugu?" into
captured, qualified, routed leads.

**Funnel:** HOOK (`/`) → CAPTURE (name + WhatsApp + email, saved instantly) →
QUALIFY (5-question buyer-persona quiz) → ROUTE ("you're in": persona message +
WhatsApp invite + shareable referral link) → NURTURE (welcome email).

## Stack
- **Next.js 16** (App Router) + React 19 + TypeScript
- **Tailwind v4** — "Warm Editorial" design system in `src/app/globals.css`
- **Prisma 6 + PostgreSQL** (local for dev, Supabase for prod)
- **Nodemailer** (SMTP) behind a swappable `sendEmail()` interface
- Deploy target: **Vercel**

## Run locally

Requires a running Postgres. This project used local Homebrew Postgres 15:

```bash
brew services start postgresql@15
createdb enugu_dev            # once
```

Then:

```bash
cp .env.example .env          # then edit values (a working local .env is already present)
npm install
npx prisma db push            # sync schema to the database
npm run dev                   # http://localhost:3000
```

Pages:
- `/` — landing (the hook) with the live builder counter
- `/join` — the onboarding flow (supports `?ref=CODE` and `?source=tag`)
- `/admin` — password-protected dashboard (redirects to `/admin/login`)
- `/api/wa?lead=ID` — tracked WhatsApp redirect (counts per-user clicks, then 302s to the invite)

### Admin dashboard
Log in at `/admin/login` with the password you set in `ADMIN_PASSWORD` (see `.env.example`). It gives you:
- **Editable settings** — WhatsApp community link, builder cap, site URL (saved to the DB, take effect instantly, no redeploy).
- **Drop-off funnel** — how many builders reached each stage (Captured → Q1…Q5 → Completed → Joined WhatsApp), with the % lost at each step, so you can see exactly *where* people abandon.
- **Breakdowns** — by persona, by campus (Campus Wars), and by "how they heard about us".
- **WhatsApp clicks** — total clicks + unique clickers, plus per-user click counts in the table.
- **Top referrers** and the full lead table.

## Verify the funnel

```bash
npm test                                  # unit tests for the persona engine
NODE_OPTIONS="--conditions=react-server" npx tsx scripts/verify-funnel.ts   # end-to-end DB checks
```

## Going to production (Supabase + Vercel)

1. Create a Supabase project. Copy the **Connection string** (URI, use the
   *Transaction* pooler for serverless).
2. Set `DATABASE_URL` to that string (in `.env` locally and in Vercel env vars).
3. Run `npx prisma db push` (or set up `prisma migrate` for versioned migrations).
4. Set the remaining env vars in Vercel:
   - `NEXT_PUBLIC_WHATSAPP_INVITE` — your real community invite link
   - `NEXT_PUBLIC_SITE_URL` — your production URL (for referral links)
   - `NEXT_PUBLIC_BUILDER_CAP` — the round cap (300 for the test)
   - `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `EMAIL_FROM`
   - `ADMIN_TOKEN` — a long random string
5. `git push` → import into Vercel → deploy.

### Note on email at scale
Nodemailer/SMTP is fine for the low-volume transactional "you're in" email during
the 300-person test. For broadcasting the storytelling sequence at 3,000+ scale,
swap the transport inside `src/lib/email.ts` (to a real ESP) — callers don't change.

## Deferred for September (not built for the test, by design)
- WhatsApp Business API auto-add (currently a tracked invite link)
- Live referral leaderboard + prize tiers (referral *data* is captured now)
- Email nurture sequences (welcome email is wired; sequences are not)
