/** Canonical form for comparing student math answers to accepted solutions. */
export function normalizeMathAnswerForCompare(raw: string): string {
  let s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "";

  s = s.replace(/\$([^$]*)\$/g, "$1");
  s = s.replace(/\\{2,}/g, "\\");
  s = s.replace(/[−–—]/g, "-");
  s = s.replace(/[×·]/g, "*");
  s = s.replace(/÷/g, "/");
  s = s.replace(/√\s*/g, "sqrt");
  s = s.replace(/π/g, "pi");
  s = s.replace(/°/g, "deg");

  for (let i = 0; i < 6; i++) {
    const prev = s;
    s = s.replace(/\\sqrt\s*\{\s*([^{}]+)\s*\}/g, "sqrt($1)");
    s = s.replace(/\\sqrt\s*\(\s*([^()]+)\s*\)/g, "sqrt($1)");
    s = s.replace(/\\frac\s*\{\s*([^{}]+)\s*\}\s*\{\s*([^{}]+)\s*\}/g, "($1)/($2)");
    s = s.replace(/\\pi\b/g, "pi");
    s = s.replace(/\\times\b|\\cdot\b/g, "*");
    s = s.replace(/\\left|\\right/g, "");
    s = s.replace(/\^\s*\{\s*([^{}]+)\s*\}/g, "^$1");
    s = s.replace(/_\s*\{\s*([^{}]+)\s*\}/g, "_$1");
    if (s === prev) break;
  }

  s = s.replace(/\bsqrt\s+([a-z0-9(]+)/g, "sqrt($1)");
  s = s.replace(/\s+/g, "");
  s = s.replace(/\(\s+/g, "(").replace(/\s+\)/g, ")");
  return s;
}

export function mathAnswersEquivalent(student: string, accepted: string): boolean {
  const a = normalizeMathAnswerForCompare(student);
  const b = normalizeMathAnswerForCompare(accepted);
  if (!a || !b) return false;
  return a === b;
}

/** Extract answer-like fragments from a single ruled line (priority order). */
function lineAnswerCandidates(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed) return [];

  const out: string[] = [];
  const marked = trimmed.match(
    /^(?:∴|therefore|hence|so|thus|answer|ans|final)(?:\s+answer)?\s*[:=]\s*(.+)$/i,
  );
  if (marked?.[1]?.trim()) out.push(marked[1].trim());

  if (trimmed.includes("=")) {
    const rhs = trimmed.split("=").pop()?.trim();
    if (rhs && rhs.length <= 160) out.push(rhs);
  }

  out.push(trimmed);
  return [...new Set(out.filter(Boolean))];
}

/**
 * Walk ruled working from the last line upward; return candidate answers in try order.
 * Typed / scribble text only — not handwriting images.
 */
export function workingAnswerCandidates(raw: string): string[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return [text];

  const candidates: string[] = [];
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    for (const candidate of lineAnswerCandidates(lines[i]!)) {
      if (!candidates.includes(candidate)) candidates.push(candidate);
    }
  }
  return candidates;
}

/** @deprecated alias — use workingAnswerCandidates */
export function answerCandidatesFromWorking(raw: string): string[] {
  return workingAnswerCandidates(raw);
}

/** Best-effort final answer: highest-priority fragment from the last non-empty line upward. */
export function extractFinalAnswerFromWorking(raw: string): string {
  return workingAnswerCandidates(raw)[0] ?? "";
}
