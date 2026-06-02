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

const MARKDOWN_IMAGE_RE = /!\[([^\]]*)\]\(([^)\s]+)\)/g;

/** Turn `/public/...` style paths into same-origin URLs for markdown sanitizers. */
export function absolutizeAssetUrl(url: string): string {
  const t = String(url ?? "").trim();
  if (!t) return t;
  if (/^https?:\/\//i.test(t) || /^data:/i.test(t)) return t;
  if (t.startsWith("//")) return `https:${t}`;
  if (t.startsWith("/") && typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}${t}`;
  }
  return t;
}

/** Paths for `<img src>` — keep relative (e.g. `/questions/...`) so any dev port/host works. */
export function extractMarkdownImageUrls(text: string): string[] {
  const urls: string[] = [];
  for (const m of String(text ?? "").matchAll(MARKDOWN_IMAGE_RE)) {
    const raw = m[2]?.trim();
    if (raw) urls.push(raw);
  }
  return urls;
}

export type StimulusContent = {
  passage?: string;
  imageUrls: string[];
};

export function collectStimulusFromText(
  passage?: string,
  existingUrls?: string[],
): StimulusContent {
  const rawPassage = passage?.trim() ?? "";
  const merged = [...(existingUrls ?? []), ...extractMarkdownImageUrls(rawPassage)];
  const prose = rawPassage ? stripMarkdownImages(rawPassage) : "";
  return {
    passage: prose || undefined,
    imageUrls: merged.filter(Boolean),
  };
}

export function collectStimulusFromQuestion(
  q: { passage?: string; imageUrls?: string[] },
): StimulusContent {
  return collectStimulusFromText(q.passage, q.imageUrls);
}

export function collectStimulusFromParts(
  parts: { passage?: string; imageUrls?: string[] }[],
): StimulusContent {
  const urls: string[] = [];
  let passage: string | undefined;
  for (const p of parts) {
    if (!passage && p.passage?.trim()) passage = p.passage.trim();
    if (p.imageUrls?.length) urls.push(...p.imageUrls);
    urls.push(...extractMarkdownImageUrls(p.passage ?? ""));
  }
  return collectStimulusFromText(passage, urls);
}

export function hasVisibleStimulus(s: StimulusContent): boolean {
  return Boolean(s.passage?.trim()) || s.imageUrls.length > 0;
}

export function stripMarkdownImages(text: string): string {
  return String(text ?? "")
    .replace(/!\[[^\]]*\]\([^)]+\)\s*/g, "")
    .trim();
}

export function absolutizeMarkdownAssetUrls(text: string): string {
  return String(text ?? "").replace(MARKDOWN_IMAGE_RE, (_, alt: string, url: string) => {
    return `![${alt}](${absolutizeAssetUrl(url)})`;
  });
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
