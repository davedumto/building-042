import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAuthed } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import {
  PERSONA_COPY,
  heardFromLabel,
  answerLabels,
  QUIZ,
  type Persona,
} from "@/lib/quiz";
import { FUNNEL_STAGES, STAGE_LABEL, stageRank } from "@/lib/funnel";
import { logout } from "@/app/admin/actions";
import SettingsForm from "./SettingsForm";

const PAGE_SIZE = 25;

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  if (!(await isAuthed())) redirect("/admin/login");

  const settings = await getSettings();

  // Aggregates run over the WHOLE dataset (not the current page).
  const [
    total,
    completed,
    byPersona,
    byCampus,
    byHeardFrom,
    byStage,
    topReferrers,
    waAgg,
  ] = await Promise.all([
    prisma.lead.count(),
    prisma.lead.count({ where: { quizCompleted: true } }),
    prisma.lead.groupBy({ by: ["persona"], _count: true }),
    prisma.lead.groupBy({
      by: ["campus"],
      _count: true,
      where: { campus: { not: null } },
    }),
    prisma.lead.groupBy({ by: ["heardFrom"], _count: true }),
    prisma.lead.groupBy({ by: ["funnelStage"], _count: true }),
    prisma.lead.findMany({
      where: { referrals: { some: {} } },
      include: { _count: { select: { referrals: true } } },
      orderBy: { referrals: { _count: "desc" } },
      take: 5,
    }),
    prisma.lead.aggregate({
      _sum: { waClicks: true },
      _count: { waFirstClickAt: true },
    }),
  ]);

  // --- Pagination for the leads table only ---
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageParam = Number.parseInt((await searchParams).page ?? "1", 10);
  const page = Math.min(Math.max(1, Number.isFinite(pageParam) ? pageParam : 1), totalPages);
  const leads = await prisma.lead.findMany({
    orderBy: { builderNo: "asc" },
    include: {
      _count: { select: { referrals: true } },
      answers: { select: { questionKey: true, answerValue: true } },
    },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
  });

  // --- Drop-off funnel (computed from a groupBy, so it scales) ---
  // stageCounts[stage] = leads whose FURTHEST stage is exactly `stage`.
  // "Reached at least stage S" = sum of counts for every stage ranked >= S.
  const stageCounts = new Map<string, number>(
    byStage.map((s) => [s.funnelStage, s._count]),
  );
  const funnel = FUNNEL_STAGES.map((stage) => {
    const rank = stageRank(stage);
    let reached = 0;
    for (const [st, c] of stageCounts) {
      if (stageRank(st) >= rank) reached += c;
    }
    return { stage, label: STAGE_LABEL[stage], reached };
  });
  const topOfFunnel = funnel[0]?.reached || 1;

  const waClickers = waAgg._count.waFirstClickAt;
  const waTotalClicks = waAgg._sum.waClicks ?? 0;

  return (
    <main className="editorial py-12">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <span className="pill">ADMIN · THE ENUGU CREATIVE MOVEMENT</span>
          <h1 className="display display-md mt-6">Builders dashboard</h1>
        </div>
        <form action={logout}>
          <button type="submit" className="btn btn-ghost">
            Sign out
          </button>
        </form>
      </div>

      {/* ---- Top-line stats ---- */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mt-10 mb-12">
        <Stat label="Builders" value={`${total} / ${settings.builderCap}`} />
        <Stat label="Completed quiz" value={String(completed)} />
        <Stat
          label="Completion"
          value={total ? `${Math.round((completed / total) * 100)}%` : "·"}
        />
        <Stat label="WhatsApp clickers" value={String(waClickers)} />
        <Stat label="Total WA clicks" value={String(waTotalClicks)} />
      </div>

      {/* ---- SETTINGS EDITOR ---- */}
      <section className="mb-14">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold mb-4">
          Settings
        </h2>
        <SettingsForm
          whatsappInvite={settings.whatsappInvite}
          builderCap={settings.builderCap}
          siteUrl={settings.siteUrl}
        />
      </section>

      {/* ---- DROP-OFF FUNNEL ---- */}
      <section className="mb-14">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold mb-1">
          Where people drop off
        </h2>
        <p className="text-muted mb-5">
          How many builders reached each stage. The gaps are where you&apos;re
          losing them.
        </p>
        <div className="space-y-3 border border-line rounded-2xl bg-white p-6">
          {funnel.map((f, i) => {
            const pct = Math.round((f.reached / topOfFunnel) * 100);
            const prev = i > 0 ? funnel[i - 1].reached : f.reached;
            const dropped = prev - f.reached;
            const dropPct = prev > 0 ? Math.round((dropped / prev) * 100) : 0;
            return (
              <div key={f.stage}>
                <div className="flex justify-between items-baseline mb-1">
                  <span className="font-medium">{f.label}</span>
                  <span className="serial">
                    {f.reached} · {pct}%
                    {i > 0 && dropped > 0 && (
                      <span className="text-red-600">
                        {" "}
                        (−{dropped}, −{dropPct}%)
                      </span>
                    )}
                  </span>
                </div>
                <div className="rail">
                  <div className="rail-fill" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---- BREAKDOWNS ---- */}
      <div className="grid lg:grid-cols-3 gap-10 mb-14">
        <Breakdown
          title="By persona"
          rows={byPersona
            .filter((p) => p.persona)
            .map((p) => ({
              label: PERSONA_COPY[p.persona as Persona]?.title ?? p.persona!,
              count: p._count,
            }))}
          empty="No completed quizzes yet."
        />
        <Breakdown
          title="Campus (Campus Wars)"
          accent="blue"
          rows={byCampus.map((c) => ({ label: c.campus!, count: c._count }))}
          empty="No campus builders yet."
        />
        <Breakdown
          title="How they heard about us"
          rows={byHeardFrom.map((h) => ({
            label: heardFromLabel(h.heardFrom),
            count: h._count,
          }))}
          empty="No data yet."
        />
      </div>

      {/* ---- TOP REFERRERS ---- */}
      {topReferrers.length > 0 && (
        <section className="mb-14">
          <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold mb-4">
            Top referrers
          </h2>
          <div className="space-y-2">
            {topReferrers.map((r) => (
              <div
                key={r.id}
                className="flex justify-between items-center border border-line rounded-xl px-4 py-3 bg-white"
              >
                <span>
                  {r.name} <span className="serial">({r.referralCode})</span>
                </span>
                <span className="font-[family-name:var(--font-mono)] font-bold text-green">
                  {r._count.referrals} referred
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ---- RAW LEADS TABLE ---- */}
      <div className="flex items-end justify-between gap-4 flex-wrap mb-4">
        <h2 className="font-[family-name:var(--font-display)] text-xl font-semibold">
          All builders ({total})
        </h2>
        <a href="/admin/export" className="btn btn-ghost" download>
          ↓ Export CSV
        </a>
      </div>
      <div className="overflow-x-auto border border-line rounded-2xl bg-white">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="text-left border-b border-line">
              <Th>No.</Th>
              <Th>Name</Th>
              <Th>WhatsApp</Th>
              <Th>Email</Th>
              <Th>Persona</Th>
              <Th>Campus</Th>
              <Th>Heard via</Th>
              <Th>Stage</Th>
              <Th>WA clicks</Th>
              <Th>Refs</Th>
              <Th>Source</Th>
              <Th>Answers</Th>
            </tr>
          </thead>
          <tbody>
            {leads.map((l) => (
              <tr key={l.id} className="border-b border-line/60 align-top">
                <Td mono>{String(l.builderNo).padStart(4, "0")}</Td>
                <Td>{l.name}</Td>
                <Td mono>{l.whatsapp}</Td>
                <Td>{l.email}</Td>
                <Td>
                  {l.persona
                    ? PERSONA_COPY[l.persona as Persona]?.title ?? l.persona
                    : "·"}
                </Td>
                <Td>{l.campus ?? "·"}</Td>
                <Td>{heardFromLabel(l.heardFrom)}</Td>
                <Td>
                  <StageBadge stage={l.funnelStage} />
                </Td>
                <Td mono>{l.waClicks || "·"}</Td>
                <Td mono>{l._count.referrals || "·"}</Td>
                <Td>{l.source ?? "·"}</Td>
                <Td>
                  <AnswersCell answers={l.answers} />
                </Td>
              </tr>
            ))}
            {leads.length === 0 && (
              <tr>
                <td colSpan={12} className="text-center text-muted py-8">
                  No builders yet. Share the link!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ---- PAGINATION ---- */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <span className="serial">
            Page {page} of {totalPages} · showing{" "}
            {(page - 1) * PAGE_SIZE + 1}–
            {Math.min(page * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex gap-2">
            <PageLink page={page - 1} disabled={page <= 1} label="← Prev" />
            <PageLink
              page={page + 1}
              disabled={page >= totalPages}
              label="Next →"
            />
          </div>
        </div>
      )}
    </main>
  );
}

function PageLink({
  page,
  disabled,
  label,
}: {
  page: number;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="btn btn-ghost opacity-40 cursor-not-allowed">{label}</span>
    );
  }
  return (
    <a href={`/admin?page=${page}`} className="btn btn-ghost">
      {label}
    </a>
  );
}

// Expandable per-lead quiz answers. Uses native <details> so it needs no
// client JS (this page is a server component). Shows every answered question
// with readable labels (multi-select answers are comma-separated).
function AnswersCell({
  answers,
}: {
  answers: { questionKey: string; answerValue: string }[];
}) {
  if (answers.length === 0) {
    return <span className="text-muted">·</span>;
  }
  const byKey = new Map(answers.map((a) => [a.questionKey, a.answerValue]));
  return (
    <details className="group">
      <summary className="cursor-pointer select-none text-green-deep font-medium list-none">
        <span className="group-open:hidden">View {answers.length}</span>
        <span className="hidden group-open:inline">Hide</span>
      </summary>
      <div className="mt-2 space-y-2 whitespace-normal max-w-xs">
        {QUIZ.map((q) => {
          const v = byKey.get(q.key);
          if (!v) return null;
          return (
            <div key={q.key}>
              <p className="serial">{q.prompt}</p>
              <p className="text-ink">{answerLabels(q.key, v)}</p>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-line rounded-2xl p-5 bg-white">
      <p className="serial">{label}</p>
      <p className="display text-3xl mt-1">{value}</p>
    </div>
  );
}

function Breakdown({
  title,
  rows,
  empty,
  accent = "green",
}: {
  title: string;
  rows: { label: string; count: number }[];
  empty: string;
  accent?: "green" | "blue";
}) {
  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  const sorted = [...rows].sort((a, b) => b.count - a.count);
  return (
    <div>
      <h3 className="font-[family-name:var(--font-display)] text-lg font-semibold mb-4">
        {title}
      </h3>
      <div className="space-y-2">
        {sorted.length === 0 && <p className="text-muted">{empty}</p>}
        {sorted.map((r) => {
          const pct = Math.round((r.count / total) * 100);
          return (
            <div key={r.label}>
              <div className="flex justify-between mb-1">
                <span>{r.label}</span>
                <span className="serial">
                  {r.count} · {pct}%
                </span>
              </div>
              <div className="rail">
                <div
                  className="rail-fill"
                  style={{
                    width: `${pct}%`,
                    background:
                      accent === "blue" ? "var(--color-blue)" : undefined,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const done = stage === "JOINED_WHATSAPP" || stage === "COMPLETED";
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-[family-name:var(--font-mono)] ${
        done
          ? "bg-green/15 text-green-deep"
          : "bg-base-deep text-muted"
      }`}
    >
      {STAGE_LABEL[stage as keyof typeof STAGE_LABEL] ?? stage}
    </span>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 font-[family-name:var(--font-mono)] text-xs uppercase tracking-wider text-muted">
      {children}
    </th>
  );
}

function Td({ children, mono }: { children: React.ReactNode; mono?: boolean }) {
  return (
    <td className={`px-4 py-3 ${mono ? "font-[family-name:var(--font-mono)]" : ""}`}>
      {children}
    </td>
  );
}
