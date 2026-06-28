import { stripAnswerUnits } from "@/lib/utils";

export function displayMarks(marks: number | undefined, type: "mcq" | "short" | "long"): number {
  if (typeof marks === "number" && Number.isFinite(marks) && marks > 0) {
    return Math.max(1, Math.round(marks));
  }
  return type === "mcq" ? 1 : 2;
}

/** Remove leading A/B/C/D label — the quiz UI shows letters on each tile. */
export function stripMcqOptionPrefix(option: string, letter?: string): string {
  let t = String(option ?? "").trim();
  if (!t) return t;

  if (letter) {
    const L = letter.toUpperCase();
    const exact = new RegExp(`^\\(?\\[?${L}\\]?\\)?\\s*[\\).:\\-–—]?\\s*`, "i");
    if (exact.test(t)) return t.replace(exact, "").trim();
  }

  return t.replace(/^\(?\[?[A-H]\]?\)?\s*[\).:\-–—]?\s*/i, "").trim();
}

export function normalizeMcqOptions(options: string[]): string[] {
  return options.map((opt, i) => {
    const letter = String.fromCharCode(65 + (i % 26));
    const stripped = stripMcqOptionPrefix(opt, letter);
    return stripped || stripMcqOptionPrefix(opt);
  });
}

/** Per-part marks from answerParts, or split total evenly when not set. */
export function resolvePartMarks(
  configuredParts: { marks?: number }[],
  partCount: number,
  totalMarks: number,
): number[] {
  const safeParts = Math.max(1, partCount);
  if (configuredParts.length >= 2 && configuredParts.length === safeParts) {
    const explicit = configuredParts.map((p) =>
      typeof p.marks === "number" && p.marks > 0 ? Math.round(p.marks) : 0,
    );
    if (explicit.every((m) => m > 0)) return explicit;
  }
  const safeTotal = Math.max(1, Math.round(totalMarks));
  if (safeTotal <= safeParts) return Array(safeParts).fill(1);
  const base = Math.floor(safeTotal / safeParts);
  const rem = safeTotal % safeParts;
  return Array.from({ length: safeParts }, (_, idx) => base + (idx < rem ? 1 : 0));
}

export type AnswerScoreDetail = {
  marksEarned: number;
  marksTotal: number;
};

/** Sum marks for each correct multipart sub-part. */
export function marksEarnedFromPartResults(
  partResults: Array<boolean | null | undefined>,
  partMarks: number[],
): number {
  return partResults.reduce(
    (sum, ok, idx) => sum + (ok ? Math.max(1, Math.round(partMarks[idx] ?? 1)) : 0),
    0,
  );
}

/** Total marks for competition / scorecard (sum of part marks when multipart). */
export function competitionMarksForQuestion(q: {
  marks?: number;
  type?: "mcq" | "short" | "long";
  answerParts?: Array<{ marks?: number; label?: string }>;
}): number {
  const parts = q.answerParts?.filter((p) => p?.label?.trim()) ?? [];
  const qType = q.type ?? "short";
  if (parts.length >= 2) {
    const partMarks = resolvePartMarks(
      parts,
      parts.length,
      displayMarks(q.marks, qType),
    );
    return partMarks.reduce((sum, m) => sum + m, 0);
  }
  return displayMarks(q.marks, qType);
}
export function partLetterForIndex(index: number): string {
  return String.fromCharCode(97 + Math.min(Math.max(0, index), 25));
}

/** Roman/letter prefix id from PDF part label, e.g. b.i. → b_i, i. → i, a. → a */
export function partKeyFromLabel(rawLabel: string, fallbackKey = ""): string {
  const label = String(rawLabel ?? "").trim();
  const bi = label.match(/^([a-z])\.(i{1,3}|iv)\./i);
  if (bi?.[1] && bi[2]) return `${bi[1]}_${bi[2].toLowerCase()}`;
  const roman = label.match(/^(i{1,3}|iv)\./i);
  if (roman?.[1]) return roman[1].toLowerCase();
  const letter = label.match(/^([a-z])\./i);
  if (letter?.[1]) return letter[1].toLowerCase();
  const fb = fallbackKey.trim().toLowerCase();
  return fb || "a";
}

/** Student-facing part text — no a)/b)/i./ii. prefixes. */
export function studentFacingPartText(label: string): string {
  let out = String(label ?? "").trim();
  out = out.replace(/^([a-z])\.(?:i{1,3}|iv)\.\s*/i, "");
  out = out.replace(/^(?:i{1,3}|iv)\.\s*/i, "");
  while (/^(?:[a-z])\s*[).:\-–—]\s*/i.test(out)) {
    out = out.replace(/^(?:[a-z])\s*[).:\-–—]\s*/i, "").trim();
  }
  return out.trim();
}

/** Strip roman sub-part markers only — keeps letter prefixes like a. / b. */
export function stripRomanPartPrefix(label: string): string {
  let out = String(label ?? "").trim();
  // b.i. / c.ii. → b. / c.
  out = out.replace(/^([a-z])\.(?:i{1,3}|iv)\.\s*/i, "$1. ");
  // standalone i. / ii. at the start (no parent letter)
  out = out.replace(/^(?:i{1,3}|iv)\.\s*/i, "");
  return out.trim();
}

/** @deprecated Use partLetterForIndex(index) — all parts display as a, b, c, … */
export function romanParentLetterForPart(
  _parts: Array<{ key?: string }>,
  index: number,
  _stemHint?: string,
): string {
  return partLetterForIndex(index);
}

/** Roman sub-part keys used under a letter part (i. / ii. / iii. / iv.). */
export function isRomanPartKey(key: string): boolean {
  return /^(?:i{1,3}|iv)$/i.test(String(key ?? "").trim());
}

/** Normalize stored part keys (part1, A, i, ii, etc.) to a display key. */
export function normalizePartKey(key: string | undefined, index: number): string {
  const k = key?.trim().toLowerCase() ?? "";
  if (/^[a-z]$/.test(k) && !isRomanPartKey(k)) return k;
  if (isRomanPartKey(k)) return k;
  const m = k.match(/^part(\d+)$/i);
  if (m?.[1]) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= 1 && n <= 26) return partLetterForIndex(n - 1);
  }
  return partLetterForIndex(index);
}

/** Strip leading part letter markers (a) / a. / a:) from stored labels. */
export function stripMainPartPrefix(label: string): string {
  let out = stripRomanPartPrefix(String(label ?? "").trim());
  if (!out) return "";
  out = out.replace(/^(?:[a-z])\s*[).:\-–—]\s*/i, "");
  return out.trim();
}

/** Student-facing part heading, e.g. "a. Find the mean" (VCE booklet style). */
export function formatPartDescriptor(letter: string, label: string): string {
  const L = letter.trim().toLowerCase();
  const clean = stripMainPartPrefix(label);
  const suffix = ".";
  if (!clean || /^answer$/i.test(clean)) return `${L}${suffix}`;
  return `${L}${suffix} ${clean}`;
}

/** Prefix for submitted multipart answers (a) / i. etc.). */
export function partSubmitLabel(key: string): string {
  const k = key.trim().toLowerCase();
  return isRomanPartKey(k) ? `${k}.` : `${k})`;
}

/** Strip all leading letter markers wrongly copied onto sub-part labels. */
function stripAnyLetterPartPrefix(label: string): string {
  let out = String(label ?? "").trim();
  while (/^(?:[a-z])\s*[).:\-–—]\s*/i.test(out)) {
    out = out.replace(/^(?:[a-z])\s*[).:\-–—]\s*/i, "").trim();
  }
  return out;
}

export function resolveMultipartPartDisplay(
  answerParts: Array<{ key?: string; label?: string }>,
  _options?: { stemHint?: string },
): { letters: string[]; descriptors: string[] } {
  const letters: string[] = [];
  const descriptors: string[] = [];

  for (let idx = 0; idx < answerParts.length; idx += 1) {
    const p = answerParts[idx]!;
    const key = normalizePartKey(p.key, idx);
    letters.push(key);
    const raw = String(p.label ?? "").trim();
    descriptors.push(
      raw ? formatPartDescriptor(key, raw) : `${key}${isRomanPartKey(key) ? "." : ")"}`,
    );
  }

  return { letters, descriptors };
}

/** Strip leading part labels from a stored model answer (i. / a) / etc.). */
export function cleanAcceptedPartAnswer(raw: string): string {
  return stripAnswerUnits(
    String(raw ?? "")
      .replace(/^\s*(?:i{1,3}|iv)\.\s*/i, "")
      .replace(/^\s*(?:\(?i+\)?|[a-z]|\d+)\)\s*/i, "")
      .trim(),
  );
}

/** Split a combined multipart answer like "i. volume; ii. $9.53$" into per-part values. */
export function splitMultipartAcceptedAnswers(acceptedPool: string[]): string[] {
  if (acceptedPool.length !== 1) {
    return acceptedPool.map(cleanAcceptedPartAnswer).filter(Boolean);
  }

  const raw = String(acceptedPool[0] ?? "").trim();
  if (!raw) return acceptedPool;

  const romanChunks = [...raw.matchAll(/(?:^|[;\n])\s*(i{1,3}|iv)\.\s*([^;\n]+)/gi)];
  if (romanChunks.length >= 2) {
    return romanChunks.map((m) => cleanAcceptedPartAnswer(m[2] ?? "")).filter(Boolean);
  }

  const letterLabelled = raw.match(/(?:^|[;\n])\s*(?:\(?i+\)?|[a-z]|\d+)\)\s*([^;\n]+)/gi);
  if (letterLabelled && letterLabelled.length >= 2) {
    return letterLabelled.map((x) => cleanAcceptedPartAnswer(x)).filter(Boolean);
  }

  const split = raw
    .split(/\s*;\s*|\s*\n+\s*/)
    .map((x) => cleanAcceptedPartAnswer(x))
    .filter(Boolean);
  if (split.length >= 2) return split;

  const splitCommaAndAnd = raw
    .split(/\s*,\s*|\s+\band\b\s+/i)
    .map((x) => cleanAcceptedPartAnswer(x))
    .filter(Boolean);
  return splitCommaAndAnd.length >= 2
    ? splitCommaAndAnd
    : acceptedPool.map(cleanAcceptedPartAnswer);
}

/** Normalize accepted answers to one value per multipart sub-part. */
export function normalizeMultipartAcceptedAnswers(
  acceptedPool: string[],
  partCount: number,
): string[] {
  if (partCount < 2 || !acceptedPool.length) {
    return acceptedPool.map(cleanAcceptedPartAnswer);
  }
  let expanded =
    acceptedPool.length === 1
      ? splitMultipartAcceptedAnswers(acceptedPool)
      : acceptedPool.map(cleanAcceptedPartAnswer).filter(Boolean);
  if (expanded.length === 1 && partCount >= 2) {
    expanded = splitMultipartAcceptedAnswers(expanded);
  }
  if (expanded.length >= partCount) {
    return expanded.slice(0, partCount).map(cleanAcceptedPartAnswer);
  }
  return expanded.map(cleanAcceptedPartAnswer);
}

/** Label for a single answer part — no a)/b) prefix. */
export function formatSinglePartLabel(label: string): string {
  const clean = stripMainPartPrefix(label);
  if (!clean || /^answer$/i.test(clean)) return "";
  return clean;
}

/** Remove scenario/topic labels duplicated in the stem (topic already shows in the badge). */
export function stripScenarioLabelPrefix(text: string): string {
  let out = String(text ?? "").trim();
  if (!out) return "";

  out = out.replace(
    /^(?:Particle|Game|Tank|Binomial|Sample|Composite|Perpetuity|Tasks|Implicit|Separable|Verify|Statement|Polar|Solid|Velocity|Constant velocity)\s*:\s*/i,
    "",
  );
  out = out.replace(/^Particle at rest when\s+/i, "");
  out = out.replace(/^(?:Velocity|Constant velocity)\s+(?=\$v\s*\()/i, "");
  // Generic short label (≤3 words) before math or the question body.
  out = out.replace(
    /^[A-Z][a-z]+(?:\s+[a-z]+){0,2}\s*:\s*(?=\$|[A-Za-z(0-9])/,
    "",
  );

  return out.trim();
}

/** Remove “(3 marks)” / “3 marks” annotations from displayed question text. */
export function stripMarksAnnotations(text: string): string {
  return String(text ?? "")
    .replace(/\(\s*\d+\s*marks?\s*\)/gi, "")
    .replace(/\b\d+\s*marks?\b/gi, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function stripQuestionNumberPrefix(text: string): string {
  const src = stripMarksAnnotations(stripScenarioLabelPrefix(String(text ?? "").trim()));
  if (!src) return "";
  const stripped = src
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
  return stripMainPartPrefix(stripped);
}

/** True when stem has unpaired $…$ or a dangling formula at the end. */
export function isBrokenMathStem(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return false;
  const dollars = (t.match(/(?<!\\)\$/g) ?? []).length;
  if (dollars % 2 === 1) return true;
  if (/\$[A-Za-z][A-Za-z0-9_]*\s*=\s*\$?\s*$/i.test(t)) return true;
  return false;
}

/** Shared scenario text before roman sub-parts under a letter part (c) … i. … ii. …). */
export function extractLetterScenarioBeforeRomans(text: string): string {
  const t = stripMarksAnnotations(String(text ?? "").trim());
  if (!t) return "";

  const letterMatch = t.match(/^([a-z])\s*[.)]\s*/i);
  const searchIn = letterMatch ? t.slice(letterMatch[0].length) : t;
  const romanMatch = searchIn.match(/(?:^|\n|\s)((?:i{1,3}|iv)\.)\s+/i);
  if (!romanMatch || romanMatch.index == null) {
    return stripQuestionNumberPrefix(t);
  }

  const end = letterMatch
    ? letterMatch[0].length + romanMatch.index
    : romanMatch.index;
  const scenario = t.slice(0, end).trim();
  return stripQuestionNumberPrefix(stripMainPartPrefix(scenario));
}

function splitStemBeforeParts(text: string): string {
  const romanStem = extractLetterScenarioBeforeRomans(text);
  const t = String(text ?? "").trim();
  const hasRoman = /(?:^|\n|\s)(?:i{1,3}|iv)\.\s+/i.test(t);
  if (hasRoman && romanStem) return romanStem;

  let stem = t;
  const firstPart = stem.search(/(?:^|\n)\s*(?:[a-z][.)]|[a-z]\.\s*i{1,3}\.)/i);
  if (firstPart < 0) return stem;
  if (firstPart === 0) return "";
  return stem.slice(0, firstPart).trim();
}

/** Shared stem for multipart — part prompts live in answerParts, not the main stem. */
export function multipartSharedStem(q: {
  question: string;
  passage?: string;
  imageUrls?: string[];
  answerParts?: Array<{ label?: string }>;
}): string {
  const parts = q.answerParts?.filter((p) => p?.label?.trim()) ?? [];
  if (parts.length < 2) return stripQuestionNumberPrefix(q.question);

  const hasRomanParts = parts.some((p) => isRomanPartKey(p.key ?? ""));
  let stem = stripQuestionNumberPrefix(
    hasRomanParts
      ? extractLetterScenarioBeforeRomans(q.question) || splitStemBeforeParts(q.question)
      : splitStemBeforeParts(q.question),
  );

  if (/^question\s*\d*$/i.test(stem.replace(/\s+/g, " ").trim())) {
    stem = "";
  }

  if (isBrokenMathStem(stem)) stem = "";

  if (!stem.trim()) {
    const passage = q.passage?.trim();
    if (passage) return stripQuestionHeadingFromPassage(passage) ?? passage;
    if (q.imageUrls?.length) return "See figure.";
    return "";
  }

  return stem;
}

/** Repair stored question text after bad multipart import (stem + parts duplicated). */
export function repairMultipartQuestionStem(
  question: string,
  answerParts?: Array<{ label?: string }>,
): string {
  const parts = answerParts?.filter((p) => p?.label?.trim()) ?? [];
  if (parts.length < 2) {
    const stem = stripQuestionNumberPrefix(question);
    return isBrokenMathStem(stem) ? "" : stem;
  }

  let stem = stripQuestionNumberPrefix(splitStemBeforeParts(question));
  if (/^question\s*\d*$/i.test(stem.replace(/\s+/g, " ").trim())) stem = "";
  if (isBrokenMathStem(stem)) stem = "";
  return stem;
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
  const seen = new Set<string>();
  const imageUrls = merged.filter((u) => {
    const key = String(u ?? "").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const prose = rawPassage ? stripMarkdownImages(rawPassage) : "";
  return {
    passage: prose || undefined,
    imageUrls,
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

/** PDF continuation pages stored separately from the main stimulus (not solutions). */
export function deferredQuestionImageUrls(q: { answerImageUrls?: string[] }): string[] {
  const seen = new Set<string>();
  return (q.answerImageUrls ?? [])
    .map((u) => String(u ?? "").trim())
    .filter((u) => {
      if (!u || seen.has(u)) return false;
      seen.add(u);
      return true;
    });
}

/** Stimulus images plus any deferred continuation pages (shown during the question). */
export function collectFullQuestionStimulus(q: {
  passage?: string;
  imageUrls?: string[];
  answerImageUrls?: string[];
}): StimulusContent {
  const base = collectStimulusFromQuestion(q);
  const deferred = deferredQuestionImageUrls(q);
  if (!deferred.length) return base;
  const seen = new Set(base.imageUrls);
  const imageUrls = [...base.imageUrls];
  for (const url of deferred) {
    if (!seen.has(url)) {
      imageUrls.push(url);
      seen.add(url);
    }
  }
  return { passage: base.passage, imageUrls };
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

const INLINE_MATH_SEGMENT_RE = /(\$\$[\s\S]*?\$\$|\$[^$\n]*?\$)/g;

/** Sentence / line / subpart starts — leaves `$…$` math untouched. */
export function capitalizeQuestionDisplayText(text: string): string {
  const raw = String(text ?? "");
  if (!raw.trim()) return raw;

  const segments = raw.split(INLINE_MATH_SEGMENT_RE);
  return segments
    .map((segment, index) => (index % 2 === 1 ? segment : capitalizePlainQuestionText(segment)))
    .join("");
}

function capitalizePlainQuestionText(text: string): string {
  return text
    .split("\n")
    .map((line) => capitalizeQuestionLine(line))
    .join("\n");
}

function capitalizeQuestionLine(line: string): string {
  if (!line.trim()) return line;

  let out = line.replace(
    /^(\s*(?:\([a-zivx]+\)|[a-z]\))\s*)([a-z])/,
    (_, prefix: string, letter: string) => `${prefix}${letter.toUpperCase()}`,
  );

  out = out.replace(/(^|[.!?;]\s+)([a-z])/g, (_, prefix: string, letter: string) => {
    return `${prefix}${letter.toUpperCase()}`;
  });

  return out;
}

export function stripQuestionHeadingFromPassage(passage?: string): string | undefined {
  if (!passage?.trim()) return undefined;
  const lines = passage.split(/\r?\n/);
  const first = (lines[0] ?? "").trim();
  if (
    /^(?:test(?:\s*pdf)?|pdf\s*test)\b/i.test(first) ||
    /^(?:question|q)\s*\d{1,4}\b/i.test(first) ||
    /^(?:stimulus\s*\/?\s*passage|passage\s*\/?\s*stimulus)\b/i.test(first) ||
    /^(?:stimulus|passage)\s*$/i.test(first)
  ) {
    const rest = lines.slice(1).join("\n").trim();
    return rest || undefined;
  }
  return passage.trim();
}
