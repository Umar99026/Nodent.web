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

/**
 * Pull the student's final answer from multi-line working (VCE ruled lines).
 * Does not read handwriting — typed text only.
 */
export function extractFinalAnswerFromWorking(raw: string): string {
  const text = String(raw ?? "").trim();
  if (!text) return "";
  if (!text.includes("\n")) return text;

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return text;
  if (lines.length === 1) return lines[0]!;

  for (let i = lines.length - 1; i >= Math.max(0, lines.length - 4); i--) {
    const line = lines[i]!;
    const marked = line.match(
      /^(?:∴|therefore|hence|so|thus|answer|ans|final)(?:\s+answer)?\s*[:=]\s*(.+)$/i,
    );
    if (marked?.[1]?.trim()) return marked[1].trim();
  }

  const last = lines[lines.length - 1]!;
  if (last.includes("=")) {
    const rhs = last.split("=").pop()?.trim();
    if (rhs && rhs.length <= 160) return rhs;
  }

  return last;
}

/** Compare full response and extracted final line against accepted answers. */
export function answerCandidatesFromWorking(raw: string): string[] {
  const text = String(raw ?? "").trim();
  if (!text) return [];

  const candidates: string[] = [text];
  const extracted = extractFinalAnswerFromWorking(text);
  if (extracted && extracted !== text) candidates.push(extracted);

  if (text.includes("\n")) {
    const lastLine = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .pop();
    if (lastLine && !candidates.includes(lastLine)) candidates.push(lastLine);
  }

  return candidates;
}
