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
    .replace(/[.,;:!?]+$/, "")
    .replace(/,/g, "")
    .replace(/\s+/g, "");
  if (!t) return null;
  // Basic numeric: -12, 3.14, .5, 5., 1e-3
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

function decimalPlacesFromLiteral(raw: string): number | null {
  const t = raw.trim().toLowerCase().replace(/[.,;:!?]+$/, "").replace(/,/g, "");
  const m = t.match(/^-?(?:\d+)?\.(\d+)(?:e[+-]?\d+)?$/i);
  if (!m) return null;
  return m[1]?.length ?? null;
}

export function inferDpHintFromAccepted(acceptedAnswers: string[]): number | null {
  const dps = acceptedAnswers
    .map((a) => decimalPlacesFromLiteral(String(a)))
    .filter((x): x is number => typeof x === "number" && Number.isFinite(x));
  if (!dps.length) return null;
  return Math.max(...dps);
}

export function isAnswerCorrect(
  studentAnswer: string,
  acceptedAnswers: string[],
): { correct: boolean; dpHint: number | null } {
  const dpHint = inferDpHintFromAccepted(acceptedAnswers);

  const studentNum = parseNumericAnswer(studentAnswer);
  if (studentNum != null) {
    for (const a of acceptedAnswers) {
      const accNum = parseNumericAnswer(String(a));
      if (accNum == null) continue;
      if (dpHint != null && dpHint > 0) {
        const f = 10 ** dpHint;
        const sn = Math.round(studentNum * f) / f;
        const an = Math.round(accNum * f) / f;
        if (Object.is(sn, an)) return { correct: true, dpHint };
        continue;
      }
      if (Math.abs(studentNum - accNum) < 1e-9) return { correct: true, dpHint };
    }
  }

  const normalized = normalizeAnswer(studentAnswer);
  const correct = acceptedAnswers.some(
    (accepted) => normalizeAnswer(String(accepted)) === normalized,
  );
  return { correct, dpHint };
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
