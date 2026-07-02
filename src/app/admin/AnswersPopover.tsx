"use client";

import { useEffect, useState } from "react";

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

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    // Prevent the page behind the modal from scrolling while it's open.
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (items.length === 0) {
    return <span className="text-muted">·</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-green-deep font-medium hover:underline"
        aria-expanded={open}
      >
        View {items.length}
      </button>

      {open && (
        // Fixed, full-screen overlay — escapes the table's overflow container
        // entirely, so the card is never clipped. Click the backdrop to close.
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/30"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`Answers for ${name}`}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md max-h-[85vh] overflow-y-auto rounded-2xl border border-line bg-white shadow-2xl p-6 text-left whitespace-normal"
          >
            <div className="flex items-baseline justify-between mb-1">
              <p className="font-[family-name:var(--font-display)] text-lg font-semibold">
                Builder No. {String(builderNo).padStart(4, "0")}
              </p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-muted hover:text-ink text-2xl leading-none"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="serial mb-5">{name}</p>
            <div className="space-y-4">
              {items.map((it, i) => (
                <div key={i}>
                  <p className="serial mb-0.5">{it.prompt}</p>
                  <p className="text-ink">{it.value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
