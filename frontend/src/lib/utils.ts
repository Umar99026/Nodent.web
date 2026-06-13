import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Trim, lowercase, and strip trailing punctuation from an answer string. */
export function normalizeAnswer(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[.,;:!?]+$/, "");
}

function parseNumericAnswer(raw: string): number | null {
  const t = raw
    .trim()
    .toLowerCase()
    .replace(/[−–—]/g, "-")
    .replace(/[.,;:!?]+$/, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "");
  if (!t) return null;
  // Basic numeric: -12, 3.14, .5, 5., 1e-3
  const n = Number(t);
  if (Number.isFinite(n)) return n;
  // Avoid misreading labels like "g(2)" as numeric answer 2.
  if (!t.includes("=") && /^[a-z]\w*\(\s*[-+]?(?:\d+\.\d+|\d+|\.\d+)\s*\)$/i.test(t)) {
    return null;
  }
  // Fallback: allow answers embedded in text, e.g. "g(2)=9" or "minimum is 6".
  const rhs = t.includes("=") ? t.split("=").pop() ?? t : t;
  const rhsNum = Number(rhs);
  if (Number.isFinite(rhsNum)) return rhsNum;
  const fractionMatch = rhs.match(/^([+-]?\d+)\/([+-]?\d+)$/);
  if (fractionMatch) {
    const num = Number(fractionMatch[1]);
    const den = Number(fractionMatch[2]);
    if (Number.isFinite(num) && Number.isFinite(den) && den !== 0) return num / den;
  }

  const numericTokens =
    rhs.match(/[+-]?(?:\d+\.\d+|\d+|\.\d+)(?:e[+-]?\d+)?|[+-]?\d+\/[+-]?\d+/g) ??
    t.match(/[+-]?(?:\d+\.\d+|\d+|\.\d+)(?:e[+-]?\d+)?|[+-]?\d+\/[+-]?\d+/g) ??
    [];
  if (numericTokens.length < 1) return null;
  const last = numericTokens[numericTokens.length - 1];
  let parsed = Number(last);
  if (!Number.isFinite(parsed)) {
    const fm = String(last).match(/^([+-]?\d+)\/([+-]?\d+)$/);
    if (fm) {
      const num = Number(fm[1]);
      const den = Number(fm[2]);
      parsed = den !== 0 ? num / den : NaN;
    }
  }
  return Number.isFinite(parsed) ? parsed : null;
}

/** True when an accepted answer is a number, single token, or MCQ letter. */
export function isAutoMarkableAnswer(raw: string): boolean {
  const t = String(raw ?? "").trim();
  if (!t) return false;
  if (/^[a-d]$/i.test(t)) return true;
  if (parseNumericAnswer(t) != null) return true;
  if (!/\s/.test(t) && t.length <= 32 && /^[a-z0-9$%/°π.-]+$/i.test(t)) return true;
  return false;
}

function decimalPlacesFromLiteral(raw: string): number | null {
  const t = raw.trim().toLowerCase().replace(/[.,;:!?]+$/, "").replace(/,/g, "");
  const m = t.match(/^-?(?:\d+)?\.(\d+)(?:e[+-]?\d+)?$/i);
  if (!m) return null;
  return m[1]?.length ?? null;
}

function studentDecimalPlaces(raw: string): number | null {
  const t = String(raw ?? "").trim().toLowerCase().replace(/,/g, "");
  const rhs = t.includes("=") ? t.split("=").pop() ?? t : t;
  const decimalMatch = rhs.match(/[+-]?\d*\.(\d+)(?:e[+-]?\d+)?/);
  if (decimalMatch?.[1]) return decimalMatch[1].length;
  const fractionMatch = rhs.match(/^([+-]?\d+)\/([+-]?\d+)$/);
  if (fractionMatch) return 0;
  const intMatch = rhs.match(/[+-]?\d+/);
  if (intMatch) return 0;
  return null;
}

export function inferDpHintFromAccepted(acceptedAnswers: string[]): number | null {
  // If accepted answers are numeric, decide whether this is a whole-number question.
  const numericAccepted = acceptedAnswers
    .map((a) => parseNumericAnswer(String(a)))
    .filter((x): x is number => x != null && Number.isFinite(x));
  if (numericAccepted.length) {
    const allIntegers = numericAccepted.every((n) => Math.abs(n - Math.round(n)) < 1e-9);
    return allIntegers ? 0 : 2;
  }

  const dps = acceptedAnswers
    .map((a) => decimalPlacesFromLiteral(String(a)))
    .filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (dps.length) return 2;

  return null;
}

const EXPLANATION_STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "that",
  "with",
  "from",
  "have",
  "has",
  "are",
  "was",
  "were",
  "this",
  "than",
  "into",
  "within",
  "data",
  "range",
  "there",
  "they",
  "when",
  "where",
  "what",
  "which",
  "while",
  "also",
  "been",
  "being",
  "does",
  "each",
  "more",
  "most",
  "other",
  "some",
  "such",
  "only",
  "over",
  "same",
  "their",
  "them",
  "then",
  "these",
  "those",
  "through",
  "under",
  "very",
  "will",
  "your",
  "sale",
  "price",
  "question",
  "answer",
  "shown",
  "find",
  "state",
  "explain",
]);

function looksLikeExplanationRubric(accepted: string): boolean {
  const t = String(accepted ?? "").trim();
  if (!t || /see marking guide/i.test(t)) return false;
  const numericChars = (t.match(/[\d.+-]/g) ?? []).length;
  if (numericChars > t.length * 0.55 && parseNumericAnswer(t) != null) return false;
  return /[a-z]{3,}/i.test(t);
}

/** Pull 1–6 keyword phrases from a model explanation answer. */
export function extractExplanationKeywords(accepted: string): string[] {
  const raw = String(accepted ?? "").trim();
  if (!raw) return [];

  const segments = raw
    .split(/\s*;\s*/)
    .flatMap((seg) => seg.split(/\s*,\s*(?=[a-z])/i))
    .map((s) => normalizeAnswer(s))
    .filter((s) => s.length >= 3);

  const keywords: string[] = [];
  for (const seg of segments) {
    if (seg.length <= 28 && !EXPLANATION_STOPWORDS.has(seg)) {
      keywords.push(seg);
      continue;
    }
    const words = seg
      .split(/\s+/)
      .filter(
        (w) =>
          w.length >= 4 &&
          !EXPLANATION_STOPWORDS.has(w) &&
          !/^[\d$%]+$/.test(w),
      );
    keywords.push(...words.slice(0, 3));
  }

  return [...new Set(keywords)].slice(0, 6);
}

/** Mark explanation answers correct when the student includes enough rubric keywords. */
export function matchesExplanationKeywords(
  studentAnswer: string,
  acceptedAnswer: string,
): boolean {
  if (!looksLikeExplanationRubric(acceptedAnswer)) return false;
  const studentNorm = normalizeAnswer(studentAnswer);
  if (!studentNorm) return false;

  const keywords = extractExplanationKeywords(acceptedAnswer);
  if (!keywords.length) return false;

  const hits = keywords.filter((kw) => studentNorm.includes(kw));
  const required = keywords.length <= 2 ? 1 : Math.min(2, Math.ceil(keywords.length / 2));
  return hits.length >= required;
}

export function isAnswerCorrect(
  studentAnswer: string,
  acceptedAnswers: string[],
): { correct: boolean; dpHint: number | null } {
  const dpHint = inferDpHintFromAccepted(acceptedAnswers);
  const studentDp = studentDecimalPlaces(studentAnswer);

  const studentNum = parseNumericAnswer(studentAnswer);
  if (studentNum != null) {
    for (const a of acceptedAnswers) {
      const accNum = parseNumericAnswer(String(a));
      if (accNum == null) continue;
      if (dpHint != null && dpHint > 0) {
        if (studentDp === 0) continue;
        const f = 10 ** 2;
        const sn = Math.round(studentNum * f) / f;
        const an = Math.round(accNum * f) / f;
        if (Object.is(sn, an)) return { correct: true, dpHint };
        continue;
      }
      if (dpHint === 0 && studentDp != null && studentDp > 0 && studentDp !== 2) continue;
      if (Math.abs(studentNum - accNum) < 1e-9) return { correct: true, dpHint };
    }
  }

  const normalized = normalizeAnswer(studentAnswer);
  for (const accepted of acceptedAnswers) {
    const acceptedStr = String(accepted);
    if (normalizeAnswer(acceptedStr) === normalized) {
      return { correct: true, dpHint };
    }
    if (matchesExplanationKeywords(studentAnswer, acceptedStr)) {
      return { correct: true, dpHint };
    }
  }
  return { correct: false, dpHint };
}

/** Format a duration in seconds as MM:SS or HH:MM:SS. */
export function formatSeconds(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;

  const pad = (n: number) => String(n).padStart(2, "0");

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/** Local calendar date as YYYY-MM-DD (matches study timer storage keys). */
export function localDateISO(d = new Date()): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Shift a local calendar YYYY-MM-DD by a number of days. */
export function addDaysToLocalISO(isoDate: string, deltaDays: number): string {
  const parts = isoDate.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return isoDate;
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + deltaDays);
  return localDateISO(dt);
}

/** Per-subject second totals: take the max per key (used when merging local + server study sync). */
export function mergeSecondsBySubject(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: Record<string, number> = {};
  for (const k of keys) {
    out[k] = Math.max(
      Math.max(0, Math.floor(Number(a[k]) || 0)),
      Math.max(0, Math.floor(Number(b[k]) || 0)),
    );
  }
  return out;
}

/** Format an ISO date string to a human-readable locale string. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) return iso;
  return date.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Escape HTML special characters to prevent XSS. */
export function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return text.replace(/[&<>"']/g, (ch) => map[ch] ?? ch);
}

const QUESTION_TYPE_LABELS: Record<string, string> = {
  mcq: "Multiple Choice",
  true_false: "True / False",
  fill_blank: "Fill in the Blank",
  short_answer: "Short Answer",
  short: "Short Answer",
  written: "Written Response",
  long: "Written Response",
  matching: "Matching",
};

/** Get a human-readable label for a question type key. */
export function getQuestionTypeLabel(type: string): string {
  return QUESTION_TYPE_LABELS[type] ?? type;
}
