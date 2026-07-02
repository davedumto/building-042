"use client";

import { useEffect, useRef, useState } from "react";

export interface AnswerItem {
  prompt: string;
  value: string; // already formatted (readable labels, multi = comma-joined)
}

// A compact "View answers" button that opens a floating card with the lead's
// quiz Q/A. Client-side only for open/close + click-outside + ESC — the
// content is pre-formatted on the server and passed in.
export default function AnswersPopover({
  builderNo,
  name,
  items,
}: {
  builderNo: number;
  name: string;
  items: AnswerItem[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (items.length === 0) {
    return <span className="text-muted">·</span>;
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-green-deep font-medium hover:underline"
        aria-expanded={open}
      >
        View {items.length}
      </button>

      {open && (
        <>
          {/* dim backdrop */}
          <div className="fixed inset-0 bg-ink/20 z-40" aria-hidden />
          {/* card */}
          <div
            role="dialog"
            aria-label={`Answers for ${name}`}
            className="absolute right-0 z-50 mt-2 w-80 max-w-[85vw] rounded-2xl border border-line bg-white shadow-xl p-5 text-left whitespace-normal"
          >
            <div className="flex items-baseline justify-between mb-3">
              <p className="font-[family-name:var(--font-display)] font-semibold">
                Builder No. {String(builderNo).padStart(4, "0")}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted hover:text-ink text-lg leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="serial mb-4">{name}</p>
            <div className="space-y-3">
              {items.map((it, i) => (
                <div key={i}>
                  <p className="serial">{it.prompt}</p>
                  <p className="text-ink">{it.value}</p>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
