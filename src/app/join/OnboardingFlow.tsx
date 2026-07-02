"use client";

import { useState, useEffect } from "react";
import {
  captureLead,
  completeQuiz,
  reachQuizQuestion,
  type CaptureResult,
  type CompleteResult,
} from "@/app/actions";
import { QUIZ, HEARD_FROM_OPTIONS, type Answers } from "@/lib/quiz";

type Step = "capture" | "quiz" | "done";

export default function OnboardingFlow({
  refCode,
  source,
}: {
  refCode?: string;
  source?: string;
}) {
  const [step, setStep] = useState<Step>("capture");
  const [leadId, setLeadId] = useState<string | null>(null);
  const [result, setResult] = useState<CompleteResult | null>(null);

  return (
    <div className="editorial py-12 sm:py-16 max-w-2xl">
      {step === "capture" && (
        <CaptureStep
          refCode={refCode}
          source={source}
          onCaptured={(id) => {
            setLeadId(id);
            setStep("quiz");
          }}
        />
      )}

      {step === "quiz" && leadId && (
        <QuizStep
          leadId={leadId}
          onDone={(r) => {
            setResult(r);
            setStep("done");
          }}
        />
      )}

      {step === "done" && result && <DoneStep result={result} />}
    </div>
  );
}

// ---------------- STEP 1: CAPTURE ----------------
function CaptureStep({
  refCode,
  source,
  onCaptured,
}: {
  refCode?: string;
  source?: string;
  onCaptured: (leadId: string) => void;
}) {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<CaptureResult["errors"]>({});
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setFormError(null);
    setErrors({});
    const fd = new FormData(e.currentTarget);
    const res = await captureLead({
      name: String(fd.get("name") ?? ""),
      whatsapp: String(fd.get("whatsapp") ?? ""),
      email: String(fd.get("email") ?? ""),
      heardFrom: String(fd.get("heardFrom") ?? "") || undefined,
      ref: refCode,
      source,
    });
    setPending(false);
    if (res.ok && res.leadId) {
      onCaptured(res.leadId);
    } else {
      setErrors(res.errors ?? {});
      setFormError(res.formError ?? null);
    }
  }

  return (
    <div className="rise">
      <span className="pill mb-6">STEP 01 · CLAIM YOUR SPOT</span>
      <h1 className="display display-lg mt-6">
        Let&apos;s get you in the room.
      </h1>
      <p className="mt-4 text-lg text-muted">
        Two minutes. First we save your spot, then we learn who you&apos;re
        building.
        {refCode && (
          <span className="block mt-2 serial">
            Invited by a builder. Nice. Referral locked in.
          </span>
        )}
      </p>

      <form onSubmit={onSubmit} className="mt-10 space-y-6" noValidate>
        <Field
          name="name"
          label="Your name"
          placeholder="Amaka Asadu"
          error={errors?.name}
          autoFocus
        />
        <Field
          name="whatsapp"
          label="WhatsApp number"
          placeholder="0801 234 5678"
          error={errors?.whatsapp}
          inputMode="tel"
        />
        <Field
          name="email"
          label="Email"
          placeholder="you@email.com"
          error={errors?.email}
          type="email"
        />

        <div>
          <label htmlFor="heardFrom" className="field-label">
            How did you hear about us?
          </label>
          <select
            id="heardFrom"
            name="heardFrom"
            className="field"
            defaultValue=""
          >
            <option value="" disabled>
              Pick one…
            </option>
            {HEARD_FROM_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {formError && <p className="error-text">{formError}</p>}

        <button type="submit" className="btn btn-primary w-full" disabled={pending}>
          {pending ? "Saving your spot…" : "Save my spot →"}
        </button>
        <p className="serial text-center">
          We only use this to bring you into the movement. No spam.
        </p>
      </form>
    </div>
  );
}

// ---------------- STEP 2: QUALIFY (quiz) ----------------
function QuizStep({
  leadId,
  onDone,
}: {
  leadId: string;
  onDone: (r: CompleteResult) => void;
}) {
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tell the server which question they've reached, so abandonment is tracked
  // per-question (decision 2A). Fire-and-forget — never blocks the UI.
  useEffect(() => {
    void reachQuizQuestion({ leadId, index: idx });
  }, [leadId, idx]);

  const q = QUIZ[idx];
  const selected = answers[q.key];
  const isLast = idx === QUIZ.length - 1;
  const progress = Math.round(((idx + (selected ? 1 : 0)) / QUIZ.length) * 100);

  function choose(value: string) {
    setAnswers((a) => ({ ...a, [q.key]: value }));
  }

  async function next() {
    if (!selected) return;
    if (!isLast) {
      setIdx((i) => i + 1);
      return;
    }
    setPending(true);
    setError(null);
    const res = await completeQuiz({ leadId, answers });
    setPending(false);
    if (res.ok) onDone(res);
    else setError(res.formError ?? "Something went wrong.");
  }

  return (
    <div key={q.key} className="rise">
      {/* progress rail */}
      <div className="rail mb-8">
        <div className="rail-fill" style={{ width: `${progress}%` }} />
      </div>

      <span className="pill">{q.eyebrow}</span>
      <h2 className="display display-md mt-5 mb-8">{q.prompt}</h2>

      <div className="space-y-3">
        {q.options.map((opt, i) => (
          <button
            key={opt.key}
            type="button"
            className="option"
            data-selected={selected === opt.key}
            onClick={() => choose(opt.key)}
          >
            <span className="option-key">{String.fromCharCode(65 + i)}</span>
            <span>{opt.label}</span>
          </button>
        ))}
      </div>

      {error && <p className="error-text mt-4">{error}</p>}

      <div className="flex items-center justify-between mt-8">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => setIdx((i) => Math.max(0, i - 1))}
          disabled={idx === 0 || pending}
        >
          ← Back
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={next}
          disabled={!selected || pending}
        >
          {pending ? "Locking you in…" : isLast ? "See where I fit →" : "Next →"}
        </button>
      </div>
    </div>
  );
}

// ---------------- STEP 3: ROUTE (you're in) ----------------
function DoneStep({ result }: { result: CompleteResult }) {
  const [copied, setCopied] = useState(false);
  const serial = `Builder No. ${String(result.builderNo ?? 0).padStart(4, "0")}`;

  async function copyLink() {
    if (!result.referralUrl) return;
    try {
      await navigator.clipboard.writeText(result.referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked — the input below is still selectable
    }
  }

  return (
    <div className="rise text-center">
      <p className="serial mb-3">
        <strong>{serial}</strong> / ENUGU
      </p>
      <span className="pill">YOU&apos;RE IN · {result.personaTitle}</span>
      <h1 className="display display-lg mt-6">You&apos;re a builder now.</h1>
      <p className="mt-5 text-lg text-ink-soft max-w-xl mx-auto leading-relaxed">
        {result.personaLine}
      </p>

      {/* WhatsApp routing — via tracked redirect so clicks are counted (4A) */}
      <a
        href={result.whatsappUrl ?? "#"}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary mt-10 text-lg"
      >
        Join the WhatsApp community →
      </a>

      {/* Referral (Creative Bounty) */}
      <div className="mt-12 text-left bg-base-deep/60 border border-line rounded-2xl p-6">
        <span className="pill pill-blue mb-3">THE CREATIVE BOUNTY</span>
        <h3 className="font-[family-name:var(--font-display)] text-xl font-semibold mt-3">
          Your referral link
        </h3>
        <p className="text-muted mt-1 mb-4">
          Every builder you bring earns you the bounty. Share this link.
        </p>
        <div className="flex gap-2 flex-col sm:flex-row">
          <input
            readOnly
            value={result.referralUrl ?? ""}
            className="field font-[family-name:var(--font-mono)] text-sm"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button type="button" className="btn btn-ink" onClick={copyLink}>
            {copied ? "Copied ✓" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------- shared field ----------------
function Field({
  name,
  label,
  error,
  ...rest
}: {
  name: string;
  label: string;
  error?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label htmlFor={name} className="field-label">
        {label}
      </label>
      <input
        id={name}
        name={name}
        className={`field ${error ? "field-error" : ""}`}
        {...rest}
      />
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
