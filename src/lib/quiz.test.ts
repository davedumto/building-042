import { test } from "node:test";
import assert from "node:assert/strict";
import {
  derivePersona,
  deriveCampus,
  QUIZ,
  PERSONA_COPY,
  type Answers,
} from "./quiz";

// --- Persona derivation from what-you-build (Q1) ---
test("build=design -> DESIGNER", () => {
  assert.equal(derivePersona({ what_you_build: "design" }), "DESIGNER");
});
test("build=fashion -> FASHION_ENTREPRENEUR", () => {
  assert.equal(
    derivePersona({ what_you_build: "fashion" }),
    "FASHION_ENTREPRENEUR",
  );
});
test("build=content -> CONTENT_CREATOR", () => {
  assert.equal(derivePersona({ what_you_build: "content" }), "CONTENT_CREATOR");
});
test("build=writing_marketing -> MARKETER", () => {
  assert.equal(
    derivePersona({ what_you_build: "writing_marketing" }),
    "MARKETER",
  );
});
test("build=business -> FOUNDER", () => {
  assert.equal(derivePersona({ what_you_build: "business" }), "FOUNDER");
});

// --- Edge cases: unsure / missing / student fallback ---
test("unsure + student campus -> STUDENT (not EXPLORER)", () => {
  const a: Answers = { what_you_build: "unsure", student: "UNEC" };
  assert.equal(derivePersona(a), "STUDENT");
});
test("unsure + not student -> EXPLORER", () => {
  const a: Answers = { what_you_build: "unsure", student: "no" };
  assert.equal(derivePersona(a), "EXPLORER");
});
test("missing build answer + not student -> EXPLORER", () => {
  assert.equal(derivePersona({}), "EXPLORER");
});
test("clear build always wins over student status", () => {
  // A student who builds fashion is still tagged by their craft, campus captured separately.
  const a: Answers = { what_you_build: "fashion", student: "IMT" };
  assert.equal(derivePersona(a), "FASHION_ENTREPRENEUR");
});

// --- Campus derivation (feeds Campus Wars) ---
test("deriveCampus returns campus code for a campus answer", () => {
  assert.equal(deriveCampus({ student: "ESUT" }), "ESUT");
});
test("deriveCampus returns null for 'no'", () => {
  assert.equal(deriveCampus({ student: "no" }), null);
});
test("deriveCampus returns null when unanswered", () => {
  assert.equal(deriveCampus({}), null);
});
test("deriveCampus ignores non-campus junk", () => {
  assert.equal(deriveCampus({ student: "MADEUP" }), null);
});

// --- Integrity: every persona has copy, every question has options ---
test("every derivable persona has presentation copy", () => {
  const personas = [
    "DESIGNER",
    "FASHION_ENTREPRENEUR",
    "CONTENT_CREATOR",
    "FOUNDER",
    "MARKETER",
    "STUDENT",
    "EXPLORER",
  ] as const;
  for (const p of personas) {
    assert.ok(PERSONA_COPY[p], `missing copy for ${p}`);
    assert.ok(PERSONA_COPY[p].title.length > 0);
    assert.ok(PERSONA_COPY[p].line.length > 0);
  }
});
test("quiz has exactly 5 questions, each with >=2 options and unique keys", () => {
  assert.equal(QUIZ.length, 5);
  const keys = new Set<string>();
  for (const q of QUIZ) {
    assert.ok(q.options.length >= 2, `${q.key} needs >=2 options`);
    assert.ok(!keys.has(q.key), `duplicate question key ${q.key}`);
    keys.add(q.key);
    const optKeys = new Set(q.options.map((o) => o.key));
    assert.equal(optKeys.size, q.options.length, `dup option key in ${q.key}`);
  }
});
