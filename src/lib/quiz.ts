// ============================================================
// The buyer-persona quiz — the heart of the funnel.
// 5 fixed questions, rule-based persona tagging (decision 2A).
// Voice tuned Enugu/creator-native (decision 10B).
//
// This module is pure (no DB, no React) so it is trivially testable.
// ============================================================

export type Persona =
  | "DESIGNER"
  | "FASHION_ENTREPRENEUR"
  | "CONTENT_CREATOR"
  | "FOUNDER"
  | "MARKETER"
  | "STUDENT"
  | "EXPLORER";

export const CAMPUSES = ["UNEC", "UNN", "ESUT", "IMT", "GODFREY"] as const;
export type Campus = (typeof CAMPUSES)[number];

export interface QuizOption {
  key: string; // stable value stored in the DB
  label: string; // shown to the user
}

export interface QuizQuestion {
  key: string;
  eyebrow: string; // small mono label above the question
  prompt: string; // the question, in the movement's voice
  options: QuizOption[];
}

// The 5 questions. `key`s are stable identifiers; changing a label never
// breaks stored data because we store keys, not labels.
export const QUIZ: QuizQuestion[] = [
  {
    key: "what_you_build",
    eyebrow: "Question 01 / 05",
    prompt: "What are you actually building?",
    options: [
      { key: "design", label: "Designs & visuals. I make things look right" },
      { key: "fashion", label: "Fashion, products, things people can buy" },
      { key: "content", label: "Content. Photos, video, the camera is mine" },
      { key: "writing_marketing", label: "Words & marketing. I move people to act" },
      { key: "business", label: "A business or startup. I run the whole thing" },
      { key: "unsure", label: "Still figuring it out, but I'm ready to build" },
    ],
  },
  {
    key: "stage",
    eyebrow: "Question 02 / 05",
    prompt: "Where are you right now?",
    options: [
      { key: "starting", label: "Just starting. More hunger than proof" },
      { key: "skilled_no_clients", label: "I have the skill, not the clients yet" },
      { key: "inconsistent", label: "Getting clients, but it comes and goes" },
      { key: "running", label: "Running a real business already" },
    ],
  },
  {
    key: "blocker",
    eyebrow: "Question 03 / 05",
    prompt: "What's the one thing holding you back?",
    options: [
      { key: "visibility", label: "Nobody knows I exist. Visibility" },
      { key: "clients", label: "Finding clients & closing sales" },
      { key: "pricing", label: "Pricing & getting paid what I'm worth" },
      { key: "skills", label: "Sharpening the actual skill" },
      { key: "network", label: "The right rooms & partnerships" },
    ],
  },
  {
    key: "student",
    eyebrow: "Question 04 / 05",
    prompt: "Are you building from a campus?",
    options: [
      { key: "UNEC", label: "Yes, UNEC" },
      { key: "UNN", label: "Yes, UNN" },
      { key: "ESUT", label: "Yes, ESUT" },
      { key: "IMT", label: "Yes, IMT" },
      { key: "GODFREY", label: "Yes, Godfrey Okoye" },
      { key: "no", label: "No, I'm out of school" },
    ],
  },
  {
    key: "win",
    eyebrow: "Question 05 / 05",
    prompt: "What would make this worth it for you?",
    options: [
      { key: "clients", label: "More clients & real revenue" },
      { key: "network", label: "A bigger, stronger network" },
      { key: "recognition", label: "Recognition. To be known for my work" },
      { key: "skills", label: "Becoming genuinely great at what I do" },
      { key: "partnerships", label: "Partnerships that open doors" },
    ],
  },
];

export type Answers = Record<string, string>;

// "How did you hear about us?" — asked on the capture step (decision 3A).
// Dropdown values are stable keys; labels are what the user sees.
export const HEARD_FROM_OPTIONS: QuizOption[] = [
  { key: "instagram", label: "Instagram" },
  { key: "tiktok", label: "TikTok" },
  { key: "whatsapp", label: "A WhatsApp group / status" },
  { key: "twitter", label: "Twitter / X" },
  { key: "friend", label: "A friend told me" },
  { key: "event", label: "An event or meetup" },
  { key: "campus", label: "On campus" },
  { key: "other", label: "Somewhere else" },
];

const HEARD_FROM_KEYS = new Set(HEARD_FROM_OPTIONS.map((o) => o.key));
export function isValidHeardFrom(v: string | undefined): boolean {
  return !!v && HEARD_FROM_KEYS.has(v);
}

export function heardFromLabel(key: string | null | undefined): string {
  if (!key) return "·";
  return HEARD_FROM_OPTIONS.find((o) => o.key === key)?.label ?? key;
}

// --- Rule-based persona tagging (explicit, from Q1 + Q4) ---
// Primary signal is WHAT they build (Q1). Student status (Q4) is captured
// separately as `campus` and can override to STUDENT when they have no
// clear build direction yet.
export function derivePersona(answers: Answers): Persona {
  const build = answers["what_you_build"];
  const isStudent = isStudentAnswer(answers["student"]);

  const byBuild: Record<string, Persona> = {
    design: "DESIGNER",
    fashion: "FASHION_ENTREPRENEUR",
    content: "CONTENT_CREATOR",
    writing_marketing: "MARKETER",
    business: "FOUNDER",
  };

  if (build && byBuild[build]) return byBuild[build];

  // No clear build direction ("unsure" or missing): students are STUDENT,
  // everyone else is an EXPLORER (still a real lead, just undecided).
  return isStudent ? "STUDENT" : "EXPLORER";
}

// Returns the campus code if they answered a campus, else null.
export function deriveCampus(answers: Answers): Campus | null {
  const a = answers["student"];
  return (CAMPUSES as readonly string[]).includes(a as string)
    ? (a as Campus)
    : null;
}

function isStudentAnswer(a: string | undefined): boolean {
  return !!a && a !== "no";
}

// --- Persona presentation (drives the personalized "you're in" screen) ---
export interface PersonaCopy {
  title: string; // e.g. "You're a Builder-Designer"
  line: string; // one-sentence affirmation in the movement's voice
  accent: "green" | "blue" | "ink";
}

export const PERSONA_COPY: Record<Persona, PersonaCopy> = {
  DESIGNER: {
    title: "The Designer",
    line: "You make things look right. Inside, you'll learn to make them sell, and get paid like it.",
    accent: "green",
  },
  FASHION_ENTREPRENEUR: {
    title: "The Fashion Builder",
    line: "You build things people can wear and buy. We'll help you turn a following into a business.",
    accent: "blue",
  },
  CONTENT_CREATOR: {
    title: "The Creator",
    line: "The camera is yours. Inside, you'll turn attention into clients, revenue, and real partnerships.",
    accent: "ink",
  },
  FOUNDER: {
    title: "The Founder",
    line: "You run the whole thing. This is the room where builders in Enugu find their next partners.",
    accent: "green",
  },
  MARKETER: {
    title: "The Marketer",
    line: "You move people to act. We'll put you in front of the businesses that need exactly that.",
    accent: "blue",
  },
  STUDENT: {
    title: "The Campus Builder",
    line: "You're building before you graduate. Your campus is on the leaderboard. Go make it #1.",
    accent: "green",
  },
  EXPLORER: {
    title: "The Explorer",
    line: "You're ready to build, you just haven't picked the lane. Perfect. This is where you find it.",
    accent: "ink",
  },
};
