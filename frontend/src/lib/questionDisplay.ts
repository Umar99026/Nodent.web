export function displayMarks(marks: number | undefined, type: "mcq" | "short" | "long"): number {
  if (typeof marks === "number" && Number.isFinite(marks) && marks > 0) {
    return Math.max(1, Math.round(marks));
  }
  return type === "mcq" ? 1 : 2;
}

export function stripQuestionNumberPrefix(text: string): string {
  const src = String(text ?? "").trim();
  if (!src) return "";
  return src
    // Remove placeholder test labels sometimes injected by imports.
    .replace(/^(?:test(?:\s*pdf)?|pdf\s*test)\s*[:.)-]?\s*/i, "")
    // Question 7 / Q7 / Question 7 (6 marks) / Q7(a): etc.
    .replace(
      /^(?:question|q)\s*\d{1,4}\s*[a-z]?(?:\([a-z0-9]+\))?\s*(?:\(\d+\s*marks?\))?\s*[:.)-]?\s*/i,
      "",
    )
    // 7 / 7a / 7(a) / 7a) / 7. / 7: etc.
    .replace(/^\d{1,4}\s*[a-z]?(?:\([a-z0-9]+\))?\s*[:.)-]\s*/i, "")
    .trim();
}

export function stripQuestionHeadingFromPassage(passage?: string): string | undefined {
  if (!passage?.trim()) return undefined;
  const lines = passage.split(/\r?\n/);
  const first = (lines[0] ?? "").trim();
  if (
    /^(?:test(?:\s*pdf)?|pdf\s*test)\b/i.test(first) ||
    /^(?:question|q)\s*\d{1,4}\b/i.test(first)
  ) {
    const rest = lines.slice(1).join("\n").trim();
    return rest || undefined;
  }
  return passage.trim();
}
