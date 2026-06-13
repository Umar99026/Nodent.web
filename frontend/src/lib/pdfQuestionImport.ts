import { stripMarksAnnotations } from "@/lib/questionDisplay";
import { normalizeQuestionMathText } from "@/lib/questionMathText";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export type PdfSplitMode = "per_page" | "by_marker" | "per_question";

export type DetectedSubpart = {
  label: string;
  /** Shown above the answer input, e.g. "a) Find the mean" */
  descriptor: string;
  body: string;
  marks?: number;
  /** Set when this subpart's page has its own figure */
  imageDataUrl?: string;
};

export type McqExtractResult = {
  stem: string;
  options: [string, string, string, string] | null;
  correctAnswer: string;
};

export type PdfParsedQuestion = {
  id: string;
  pageNumber: number;
  pageNumbers?: number[];
  question: string;
  marks?: number;
  imageDataUrl: string;
  imageDataUrls?: string[];
  detectedParts?: DetectedSubpart[];
  mcqOptions?: string[];
  mcqCorrectAnswer?: string;
  rawText?: string;
};

/** Total marks from a question header, e.g. “Question 5 (6 marks)”. */
export function extractQuestionTotalMarks(rawText: string): number | null {
  const raw = cleanExtractedPdfText(rawText);
  const header = raw.match(
    /(?:^|\n)\s*(?:QUESTION|Question|Q)\s*\d+\s*[.):\-–—]?\s*\(\s*(\d+)\s*marks?\s*\)/i,
  );
  if (header?.[1]) {
    const n = Number(header[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const inline = raw.match(/(?:^|\n)\s*\(\s*(\d+)\s*marks?\s*\)/i);
  if (inline?.[1]) {
    const n = Number(inline[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

/** Marks on a single subpart, e.g. “… graph. (2 marks)”. */
export function extractPartMarks(body: string): number | null {
  const t = String(body ?? "").trim();
  if (!t) return null;
  const paren = t.match(/\(\s*(\d+)\s*marks?\s*\)\s*$/i);
  if (paren?.[1]) {
    const n = Number(paren[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const trailing = t.match(/(\d+)\s*marks?\s*$/i);
  if (trailing?.[1]) {
    const n = Number(trailing[1]);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

type PdfJsModule = typeof import("pdfjs-dist");

let pdfJsPromise: Promise<PdfJsModule> | null = null;

async function getPdfJs(): Promise<PdfJsModule> {
  if (!pdfJsPromise) {
    pdfJsPromise = import("pdfjs-dist").then((pdfjs) => {
      pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      return pdfjs;
    });
  }
  return pdfJsPromise;
}

function cleanExtractedPdfText(raw: string): string {
  return raw
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Remove VCE exam headers/footers and question numbering boilerplate. */
export function stripExamBoilerplate(text: string): string {
  let t = cleanExtractedPdfText(text);
  const linePatterns = [
    /^Page\s+\d+\s+of\s+\d+.*$/gim,
    /^\d{4}\s+VCE\s+.+Examination\s*\d*.*$/gim,
    /^(?:MATHEMATICS|Mathematics|GENERAL|General|SPECIALIST|Specialist)\s+.*$/gim,
    /^Question\s+\d+\s*\(\s*\d+\s*marks?\s*\)\s*$/gim,
    /^QUESTION\s+\d+\s*\(\s*\d+\s*marks?\s*\)\s*$/gim,
    /^Q\s*\d+\s*\(\s*\d+\s*marks?\s*\)\s*$/gim,
    /^©\s*VCAA.*$/gim,
    /^DO\s+NOT\s+WRITE\s+IN\s+THIS\s+AREA.*$/gim,
  ];
  for (const re of linePatterns) {
    t = t.replace(re, "");
  }
  t = t.replace(
    /^(?:QUESTION|Question|Q)\s*\d+\s*[.):\-–—]?\s*(?:\(\s*\d+\s*marks?\s*\))?\s*/i,
    "",
  );
  t = t.replace(/\bPage\s+\d+\s+of\s+\d+\b/gi, "");
  t = t.replace(/\b\d{4}\s+VCE\s+[^.\n]{0,80}Examination\s*\d*\b/gi, "");
  t = t.replace(/\bQuestion\s+\d+\s*\(\s*\d+\s*marks?\s*\)/gi, "");
  return cleanExtractedPdfText(t);
}

export function sanitizePdfQuestionText(text: string, imagePrimary: boolean): string {
  const stripped = stripMarksAnnotations(stripExamBoilerplate(text));
  const mathified = normalizeQuestionMathText(stripped);
  if (imagePrimary) {
    return mathified.length >= 20 ? mathified : "";
  }
  if (mathified.length >= 8) return mathified;
  return "";
}

type TextItem = { str: string; transform: number[] };

export async function extractPageText(
  page: import("pdfjs-dist").PDFPageProxy,
): Promise<string> {
  const content = await page.getTextContent();
  const items = (content.items as TextItem[]).filter((it) => it.str?.trim());
  if (!items.length) return "";

  items.sort((a, b) => {
    const yDiff = b.transform[5]! - a.transform[5]!;
    if (Math.abs(yDiff) > 4) return yDiff > 0 ? 1 : -1;
    return a.transform[4]! - b.transform[4]!;
  });

  let text = "";
  let lastY: number | null = null;
  for (const item of items) {
    const y = item.transform[5]!;
    if (lastY !== null && Math.abs(y - lastY) > 7) {
      text += "\n";
    } else if (text && !text.endsWith("\n") && !text.endsWith(" ")) {
      text += " ";
    }
    text += item.str;
    lastY = y;
  }
  return cleanExtractedPdfText(text);
}

export type RenderPageOptions = {
  /** Target max width in CSS pixels (page is scaled up to reach this). */
  maxWidth?: number;
  /** Hard cap on scale factor (e.g. 3 = 3× native PDF resolution). */
  maxScale?: number;
  quality?: number;
};

/** Default render for PDF import previews and cropping. */
export const PDF_RENDER_STANDARD: RenderPageOptions = {
  maxWidth: 2200,
  maxScale: 2.5,
  quality: 0.88,
};

/** High-resolution render for NODENT figures (cropped from a large source). */
export const PDF_RENDER_HIGH_RES: RenderPageOptions = {
  maxWidth: 3200,
  maxScale: 3,
  quality: 0.93,
};

export async function renderPageToDataUrl(
  page: import("pdfjs-dist").PDFPageProxy,
  options: RenderPageOptions | number = PDF_RENDER_STANDARD,
): Promise<string> {
  const opts: RenderPageOptions =
    typeof options === "number" ? { maxWidth: options } : options;
  const maxWidth = opts.maxWidth ?? PDF_RENDER_STANDARD.maxWidth!;
  const maxScale = opts.maxScale ?? PDF_RENDER_STANDARD.maxScale!;
  const quality = opts.quality ?? PDF_RENDER_STANDARD.quality!;

  const baseViewport = page.getViewport({ scale: 1 });
  const scale = Math.min(
    maxScale,
    maxWidth / Math.max(1, baseViewport.width),
  );
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not supported in this browser.");

  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/jpeg", quality);
}

const QUESTION_MARKER_RE =
  /(?:^|\n)\s*(?:QUESTION|Question|Q)\s*(\d+)\s*[.):\-]?\s*/g;

const SUBPART_MARKER_RE =
  /(?:^|\n)\s*(?:\(([a-z])\)|([a-z])\s*[.)])\s*/gi;

/** Read question number from raw page text (before boilerplate stripping removes headers). */
function extractQuestionNumber(text: string): number | null {
  const raw = cleanExtractedPdfText(text);
  const m = raw.match(
    /(?:^|\n)\s*(?:QUESTION|Question|Q)\s*(\d+)\s*[.):\-–—]?(?:\s*\(\s*\d+\s*marks?\s*\))?/i,
  );
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function firstSubpartLabel(text: string): string | null {
  const raw = cleanExtractedPdfText(text);
  const m = raw.match(/(?:^|\n)\s*(?:\(([a-z])\)|([a-z])\s*[.)])\s*/i);
  const label = (m?.[1] || m?.[2] || "").toLowerCase();
  return label || null;
}

/** True when a page without a question header continues the previous numbered question. */
function isContinuationPage(text: string, questionNumber: number | null): boolean {
  if (questionNumber == null) return false;

  const label = firstSubpartLabel(text);
  if (label) return label > "a";

  const stripped = stripExamBoilerplate(text);
  // Figure-only or very short continuation pages (common between subparts)
  return stripped.length > 0 && stripped.length < 50;
}

/** Detect a), b), c) … subparts in exam question text. */
export function detectLetterSubparts(text: string): {
  stem: string;
  parts: DetectedSubpart[];
} {
  const cleaned = stripExamBoilerplate(text);
  if (!cleaned) return { stem: "", parts: [] };

  const markers: { label: string; index: number; matchLen: number }[] = [];
  const re = new RegExp(SUBPART_MARKER_RE.source, SUBPART_MARKER_RE.flags);
  let m: RegExpExecArray | null;
  while ((m = re.exec(cleaned)) !== null) {
    const label = (m[1] || m[2] || "").toLowerCase();
    if (!label || label < "a" || label > "z") continue;
    markers.push({ label, index: m.index, matchLen: m[0].length });
  }

  if (markers.length < 2) return { stem: cleaned, parts: [] };

  const labels = markers.map((x) => x.label);
  const distinct = new Set(labels);
  if (distinct.size < 2) return { stem: cleaned, parts: [] };

  const sequential =
    labels[0] === "a" &&
    labels.every((l, i) => l === String.fromCharCode(97 + i));
  const mostlySequential =
    sequential ||
    (labels.length >= 2 &&
      labels.every((l, i) => {
        if (i === 0) return true;
        const prev = labels[i - 1]!.charCodeAt(0);
        const curr = l.charCodeAt(0);
        return curr === prev + 1 || curr === prev;
      }));

  if (!mostlySequential) return { stem: cleaned, parts: [] };

  const stem = cleaned.slice(0, markers[0]!.index).trim();
  const parts: DetectedSubpart[] = [];
  for (let i = 0; i < markers.length; i++) {
    const { label, index, matchLen } = markers[i]!;
    const bodyStart = index + matchLen;
    const bodyEnd =
      i + 1 < markers.length ? markers[i + 1]!.index : cleaned.length;
    const body = cleaned.slice(bodyStart, bodyEnd).trim();
    const marks = extractPartMarks(body);
    const cleanBody = stripMarksAnnotations(body);
    const firstLine = stripMarksAnnotations(cleanBody.split(/\n/)[0]?.trim() ?? "");
    const descriptor = firstLine
      ? `${label}) ${firstLine}`.slice(0, 160)
      : `${label})`;
    parts.push({ label, descriptor, body: cleanBody, ...(marks ? { marks } : {}) });
  }
  return { stem, parts };
}

const MCQ_OPTION_MARKER_RE =
  /(?:^|\n)\s*(?:\(([A-D])\)|\(([a-d])\)|([A-Da-d])\s*[.)]\s*)\s*/g;

const MCQ_OPTION_INLINE_RE =
  /(?<![A-Za-z0-9])(?:\(([A-D])\)|\(([a-d])\)|([A-Da-d])\s*[.)])\s+/g;

const MCQ_OPTION_SPACED_RE = /(?:^|\n)\s*([A-Da-d])\s{2,}/g;

const MCQ_OPTION_DASH_RE =
  /(?:^|\n)\s*([A-Da-d])\s*(?:[\-–—]\s*|\s+[\-–—]\s*)/g;

const MCQ_CORRECT_ANSWER_RE =
  /(?:^|\n)\s*(?:correct(?:\s+answer)?|answer)\s*[:\-–—]\s*([A-D])\b/i;

type McqMarker = { letter: string; index: number; matchLen: number };

function readCorrectAnswer(text: string): string {
  const correctMatch = text.match(MCQ_CORRECT_ANSWER_RE);
  return (correctMatch?.[1] ?? "").toUpperCase();
}

function collectMcqMarkers(text: string, re: RegExp): McqMarker[] {
  const markers: McqMarker[] = [];
  const regex = new RegExp(re.source, re.flags);
  let m: RegExpExecArray | null;
  while ((m = regex.exec(text)) !== null) {
    const letter = (m[1] || m[2] || m[3] || "").toUpperCase();
    if (!letter || letter < "A" || letter > "D") continue;
    markers.push({ letter, index: m.index, matchLen: m[0].length });
  }
  return markers;
}

function pickOrderedAbcdMarkers(markers: McqMarker[]): McqMarker[] | null {
  const byLetter = new Map<string, McqMarker>();
  for (const mk of markers) {
    if (!byLetter.has(mk.letter)) byLetter.set(mk.letter, mk);
  }
  const ordered = (["A", "B", "C", "D"] as const)
    .map((l) => byLetter.get(l))
    .filter(Boolean) as McqMarker[];
  if (ordered.length < 4) return null;
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i]!.index <= ordered[i - 1]!.index) return null;
  }
  return ordered;
}

/** Unwrap one layer of [brackets] from an option value. */
export function unwrapBracketOption(raw: string): string {
  let t = raw.trim();
  while (t.startsWith("[") && t.endsWith("]")) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

function trimMcqOptionTail(text: string): string {
  return unwrapBracketOption(
    text
      .replace(/\b(?:correct|answer)\s*[:\-–—]\s*[A-D]\b.*$/i, "")
      .replace(/\bDO\s+NOT\s+WRITE\s+IN\s+THIS\s+AREA\b.*$/i, "")
      .replace(/\bPage\s+\d+\s+of\s+\d+\b.*$/i, "")
      .trim(),
  );
}

/** MCQ options wrapped in [brackets], e.g. [A] [$3x$] or options: [a] [b] [c] [d] */
function tryExtractMcqFromBracketNotation(text: string): McqExtractResult | null {
  const cleaned = stripExamBoilerplate(text);
  if (!cleaned) return null;

  const correctAnswer = readCorrectAnswer(cleaned);

  // [A] [option text]  or  [A][option text]
  const labeledDouble = [...cleaned.matchAll(/\[([A-Da-d])\]\s*\[([^\]]+)\]/g)];
  if (labeledDouble.length >= 4) {
    const byLetter = new Map<string, string>();
    for (const m of labeledDouble) {
      const letter = (m[1] ?? "").toUpperCase();
      if (!byLetter.has(letter)) {
        byLetter.set(letter, unwrapBracketOption(normalizeQuestionMathText(m[2] ?? "")));
      }
    }
    const options = (["A", "B", "C", "D"] as const).map((l) => byLetter.get(l) ?? "");
    if (options.every((o) => o.trim())) {
      return {
        stem: cleaned.slice(0, labeledDouble[0]!.index!).trim(),
        options: options as [string, string, string, string],
        correctAnswer,
      };
    }
  }

  // [A] option text until next [B]
  const labeledOpen = [...cleaned.matchAll(/\[([A-Da-d])\]\s*([\s\S]*?)(?=\[[A-Da-d]\]|$)/g)];
  if (labeledOpen.length >= 4) {
    const byLetter = new Map<string, string>();
    for (const m of labeledOpen) {
      const letter = (m[1] ?? "").toUpperCase();
      if (!byLetter.has(letter)) {
        byLetter.set(
          letter,
          trimMcqOptionTail(stripMarksAnnotations(normalizeQuestionMathText(m[2] ?? ""))),
        );
      }
    }
    const options = (["A", "B", "C", "D"] as const).map((l) => byLetter.get(l) ?? "");
    if (options.every((o) => o.trim())) {
      return {
        stem: cleaned.slice(0, labeledOpen[0]!.index!).trim(),
        options: options as [string, string, string, string],
        correctAnswer,
      };
    }
  }

  // options: [first] [second] [third] [fourth]
  const optionsLine = cleaned.match(/(?:^|\n)\s*options?\s*:\s*(.+)$/im);
  if (optionsLine?.[1]) {
    const groups = [...optionsLine[1].matchAll(/\[([^\]]+)\]/g)].map((m) =>
      unwrapBracketOption(normalizeQuestionMathText(m[1] ?? "")),
    );
    if (groups.length >= 4) {
      return {
        stem: cleaned.slice(0, optionsLine.index!).trim(),
        options: groups.slice(0, 4) as [string, string, string, string],
        correctAnswer,
      };
    }
  }

  // Four consecutive bracket groups (no letter labels), e.g. [$3x$] [$3x^2$] [$x^2$] [$6x$]
  const allGroups = [...cleaned.matchAll(/\[([^\]]+)\]/g)];
  if (allGroups.length >= 4) {
    for (let i = 0; i <= allGroups.length - 4; i++) {
      const slice = allGroups.slice(i, i + 4);
      const letters = slice.map((m) => (m[1] ?? "").trim().toUpperCase());
      if (letters.every((l) => /^[A-D]$/.test(l))) continue;
      const options = slice.map((m) =>
        unwrapBracketOption(normalizeQuestionMathText(m[1] ?? "")),
      ) as [string, string, string, string];
      if (options.every((o) => o.trim())) {
        return {
          stem: cleaned.slice(0, slice[0]!.index!).trim(),
          options,
          correctAnswer,
        };
      }
    }
  }

  return null;
}

function optionsFromMarkers(
  text: string,
  ordered: McqMarker[],
): [string, string, string, string] {
  return ordered.map((mk, i) => {
    const start = mk.index + mk.matchLen;
    const end = i + 1 < ordered.length ? ordered[i + 1]!.index : text.length;
    const raw = text.slice(start, end).trim();
    const cleaned = trimMcqOptionTail(stripMarksAnnotations(normalizeQuestionMathText(raw)));
    return i === ordered.length - 1 ? cleaned : cleaned;
  }) as [string, string, string, string];
}

function tryExtractMcqFromLines(text: string, correctAnswer: string): McqExtractResult | null {
  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  const optionLines: Array<{ letter: string; text: string; lineIndex: number }> = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const patterns = [
      /^\[([A-D])\]\s*\[([^\]]+)\]$/i,
      /^\[([A-D])\]\s*(.+)$/i,
      /^([A-D])\s*(?:[\s.)-–—]+|\s{2,})(.+)$/i,
      /^([A-D])\s*[.)]\s*(.+)$/i,
      /^\(([A-D])\)\s*(.+)$/i,
    ];
    for (const re of patterns) {
      const m = line.match(re);
      if (m?.[1] && m[2]?.trim()) {
        optionLines.push({
          letter: m[1].toUpperCase(),
          text: unwrapBracketOption(m[2].trim()),
          lineIndex: i,
        });
        break;
      }
    }
  }

  const byLetter = new Map(optionLines.map((o) => [o.letter, o]));
  const ordered = (["A", "B", "C", "D"] as const)
    .map((l) => byLetter.get(l))
    .filter(Boolean) as Array<{ letter: string; text: string; lineIndex: number }>;
  if (ordered.length < 4) return null;
  for (let i = 1; i < ordered.length; i++) {
    if (ordered[i]!.lineIndex <= ordered[i - 1]!.lineIndex) return null;
  }

  const options = ordered.map((o) =>
    stripMarksAnnotations(normalizeQuestionMathText(o.text)),
  ) as [string, string, string, string];
  if (options.some((o) => !o.trim())) return null;

  const stem = lines.slice(0, ordered[0]!.lineIndex).join("\n").trim();
  return { stem, options, correctAnswer };
}

function tryExtractMcqFromText(text: string): McqExtractResult | null {
  const cleaned = stripExamBoilerplate(text);
  if (!cleaned) return null;

  const correctAnswer = readCorrectAnswer(cleaned);
  const markerPatterns = [
    MCQ_OPTION_MARKER_RE,
    MCQ_OPTION_INLINE_RE,
    MCQ_OPTION_SPACED_RE,
    MCQ_OPTION_DASH_RE,
  ];

  for (const re of markerPatterns) {
    const ordered = pickOrderedAbcdMarkers(collectMcqMarkers(cleaned, re));
    if (!ordered) continue;
    const options = optionsFromMarkers(cleaned, ordered);
    if (options.every((o) => o.trim())) {
      return {
        stem: cleaned.slice(0, ordered[0]!.index).trim(),
        options,
        correctAnswer,
      };
    }
  }

  return tryExtractMcqFromLines(cleaned, correctAnswer);
}

function tryExtractMcqWithMissingD(text: string): McqExtractResult | null {
  const cleaned = stripExamBoilerplate(text);
  if (!cleaned) return null;

  const correctAnswer = readCorrectAnswer(cleaned);
  for (const re of [
    MCQ_OPTION_MARKER_RE,
    MCQ_OPTION_INLINE_RE,
    MCQ_OPTION_SPACED_RE,
    MCQ_OPTION_DASH_RE,
  ]) {
    const byLetter = new Map<string, McqMarker>();
    for (const mk of collectMcqMarkers(cleaned, re)) {
      if (!byLetter.has(mk.letter)) byLetter.set(mk.letter, mk);
    }
    if (!byLetter.has("A") || !byLetter.has("B") || !byLetter.has("C") || byLetter.has("D")) {
      continue;
    }

    const ordered = (["A", "B", "C"] as const).map((l) => byLetter.get(l)!) ;
    const c = byLetter.get("C")!;
    const afterC = cleaned.slice(c.index + c.matchLen);
    const dLine = afterC.match(
      /(?:^|\n)\s*(?:\(([Dd])\)|([Dd])\s*[.)-–—]\s*)\s*(.+)$/s,
    );
    if (!dLine?.[3]?.trim()) continue;

    const dIndex = c.index + c.matchLen + (dLine.index ?? 0);
    const dMarker: McqMarker = {
      letter: "D",
      index: dIndex,
      matchLen: dLine[0].length - dLine[3].length,
    };
    const full = [...ordered, dMarker];
    const options = optionsFromMarkers(cleaned, full);
    if (options.every((o) => o.trim())) {
      return {
        stem: cleaned.slice(0, ordered[0]!.index).trim(),
        options,
        correctAnswer,
      };
    }
  }
  return null;
}

/** Detect A–D multiple-choice options in exam PDF text. Bracket notation is tried first. */
export function extractMcqOptionsFromText(text: string): McqExtractResult {
  const bracketed = tryExtractMcqFromBracketNotation(text);
  if (bracketed) return bracketed;
  const extracted = tryExtractMcqFromText(text) ?? tryExtractMcqWithMissingD(text);
  if (extracted) return extracted;
  const cleaned = stripExamBoilerplate(text);
  return { stem: cleaned, options: null, correctAnswer: readCorrectAnswer(cleaned) };
}

/** Layout-aware MCQ extraction using positioned PDF text items. */
export async function extractMcqOptionsFromPdfPage(
  page: import("pdfjs-dist").PDFPageProxy,
): Promise<McqExtractResult | null> {
  const content = await page.getTextContent();
  type Item = { str: string; x: number; y: number };
  const items: Item[] = (
    content.items as Array<{ str?: string; transform?: number[] }>
  )
    .filter((it) => it.str?.trim())
    .map((it) => ({
      str: it.str!.trim(),
      x: it.transform![4]!,
      y: it.transform![5]!,
    }));

  if (!items.length) return null;

  items.sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > 4) return yDiff > 0 ? 1 : -1;
    return a.x - b.x;
  });

  const lines: string[] = [];
  let currentY: number | null = null;
  let parts: string[] = [];
  for (const item of items) {
    if (currentY === null || Math.abs(item.y - currentY) > 6) {
      if (parts.length) lines.push(parts.join(" ").trim());
      parts = [item.str];
      currentY = item.y;
    } else {
      parts.push(item.str);
    }
  }
  if (parts.length) lines.push(parts.join(" ").trim());

  return tryExtractMcqFromText(lines.join("\n"));
}

function applyMcqExtract(
  question: string,
  rawText: string,
): Pick<PdfParsedQuestion, "question" | "mcqOptions" | "mcqCorrectAnswer"> {
  const candidates = [
    extractMcqOptionsFromText(question),
    extractMcqOptionsFromText(rawText),
  ].filter((c): c is McqExtractResult => Boolean(c?.options?.length === 4));

  const fromRaw = candidates.find((c) => c.options!.every((o) => o.trim()));
  if (!fromRaw?.options?.length) return { question };

  const stem = fromRaw.stem.trim();
  return {
    question: stem || question,
    mcqOptions: [...fromRaw.options],
    mcqCorrectAnswer: fromRaw.correctAnswer,
  };
}

function assignPartImages(
  pages: { text: string; imageDataUrl: string }[],
  parts: DetectedSubpart[],
): DetectedSubpart[] {
  if (parts.length < 2) return parts;
  const partByLabel = new Map(parts.map((p) => [p.label, { ...p }]));
  const assigned = new Set<string>();

  for (const page of pages) {
    const onPage = detectLetterSubparts(page.text).parts;
    if (onPage.length === 1) {
      const label = onPage[0]!.label;
      const part = partByLabel.get(label);
      if (part && !assigned.has(label)) {
        part.imageDataUrl = page.imageDataUrl;
        assigned.add(label);
      }
    }
  }

  return parts.map((p) => partByLabel.get(p.label) ?? p);
}

function buildQuestionTextFromParts(
  stem: string,
  parts: DetectedSubpart[],
  fallbackText: string,
  pageNumber: number,
  imagePrimary: boolean,
): string {
  if (parts.length >= 2) {
    const stemText = sanitizePdfQuestionText(stem, imagePrimary);
    const partLines = parts.map((p) => p.descriptor);
    if (stemText) return `${stemText}\n\n${partLines.join("\n")}`;
    if (imagePrimary) return partLines.join("\n");
    return partLines.join("\n");
  }
  return buildQuestionText(pageNumber, fallbackText, imagePrimary);
}

function buildQuestionText(
  pageNumber: number,
  rawText: string,
  imagePrimary: boolean,
): string {
  const sanitized = sanitizePdfQuestionText(rawText, imagePrimary);
  if (sanitized) return sanitized;
  if (imagePrimary) return "See figure.";
  return `Question from page ${pageNumber} (see figure).`;
}

function splitTextIntoQuestionBlocks(text: string): string[] {
  const cleaned = stripExamBoilerplate(text);
  if (!cleaned) return [];

  const matches = [...cleaned.matchAll(QUESTION_MARKER_RE)];
  if (matches.length < 2) return [cleaned];

  const blocks: string[] = [];
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i]!.index ?? 0;
    const end =
      i + 1 < matches.length
        ? (matches[i + 1]!.index ?? cleaned.length)
        : cleaned.length;
    const chunk = cleaned.slice(start, end).trim();
    if (chunk) blocks.push(chunk);
  }
  return blocks.length ? blocks : [cleaned];
}

type PageSlice = {
  pageNumber: number;
  text: string;
  imageDataUrl: string;
};

function buildParsedQuestion(
  id: string,
  pages: PageSlice[],
  imagePrimary: boolean,
  questionNumber?: number | null,
): PdfParsedQuestion {
  const combinedText = pages.map((p) => p.text).join("\n\n");
  const images = pages.map((p) => p.imageDataUrl);
  const { stem, parts: rawParts } = detectLetterSubparts(combinedText);
  const parts =
    rawParts.length >= 2
      ? assignPartImages(
          pages.map((p) => ({ text: p.text, imageDataUrl: p.imageDataUrl })),
          rawParts,
        )
      : [];

  const partOnlyImages = new Set(
    parts.map((p) => p.imageDataUrl).filter(Boolean) as string[],
  );
  const sharedImages =
    partOnlyImages.size > 0
      ? images.filter((img) => !partOnlyImages.has(img))
      : images;

  const headerMarks = extractQuestionTotalMarks(combinedText);
  const partMarksSum = parts.reduce((sum, p) => sum + (p.marks ?? 0), 0);
  const marks =
    headerMarks ??
    (partMarksSum > 0 ? partMarksSum : undefined);

  const builtQuestion = buildQuestionTextFromParts(
    stem,
    parts,
    combinedText,
    pages[0]!.pageNumber,
    imagePrimary,
  );
  const mcq =
    parts.length < 2 ? applyMcqExtract(builtQuestion, combinedText) : { question: builtQuestion };

  return {
    id: questionNumber != null ? `q${questionNumber}` : id,
    pageNumber: pages[0]!.pageNumber,
    pageNumbers: pages.map((p) => p.pageNumber),
    marks,
    question: mcq.question,
    rawText: combinedText,
    imageDataUrl: sharedImages[0] ?? images[0]!,
    imageDataUrls: sharedImages.length ? sharedImages : images,
    detectedParts: parts.length >= 2 ? parts : undefined,
    ...(mcq.mcqOptions ? { mcqOptions: mcq.mcqOptions, mcqCorrectAnswer: mcq.mcqCorrectAnswer } : {}),
  };
}

export type ParsePdfOptions = {
  splitMode?: PdfSplitMode;
  imagePrimary?: boolean;
  onProgress?: (done: number, total: number) => void;
};

export async function parsePdfToQuestions(
  file: File,
  { splitMode = "per_page", imagePrimary = true, onProgress }: ParsePdfOptions = {},
): Promise<PdfParsedQuestion[]> {
  if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Please choose a PDF file.");
  }

  const pdfjs = await getPdfJs();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: bytes }).promise;

  const pageSlices: PageSlice[] = [];
  const total = doc.numPages;

  for (let pageNumber = 1; pageNumber <= total; pageNumber++) {
    onProgress?.(pageNumber - 1, total);
    const page = await doc.getPage(pageNumber);
    const text = await extractPageText(page);
    const imageDataUrl = await renderPageToDataUrl(page, PDF_RENDER_STANDARD);
    pageSlices.push({ pageNumber, text, imageDataUrl });
  }

  const out: PdfParsedQuestion[] = [];

  if (splitMode === "per_question") {
    type Acc = { questionNumber: number | null; pages: PageSlice[] };
    let acc: Acc | null = null;

    const flush = () => {
      if (!acc?.pages.length) return;
      out.push(
        buildParsedQuestion(
          `p${acc.pages[0]!.pageNumber}`,
          acc.pages,
          imagePrimary,
          acc.questionNumber,
        ),
      );
      acc = null;
    };

    for (const slice of pageSlices) {
      const qNum = extractQuestionNumber(slice.text);

      if (qNum != null) {
        if (acc != null && acc.questionNumber === qNum) {
          acc.pages.push(slice);
        } else {
          flush();
          acc = { questionNumber: qNum, pages: [slice] };
        }
        continue;
      }

      if (acc && isContinuationPage(slice.text, acc.questionNumber)) {
        acc.pages.push(slice);
        continue;
      }

      flush();
      acc = { questionNumber: null, pages: [slice] };
    }
    flush();
  } else {
    for (const slice of pageSlices) {
      const { pageNumber, text, imageDataUrl } = slice;

      if (splitMode === "by_marker") {
        const blocks = splitTextIntoQuestionBlocks(text);
        blocks.forEach((block, idx) => {
          const { stem, parts } = detectLetterSubparts(block);
          const parsedParts =
            parts.length >= 2
              ? assignPartImages([{ text: block, imageDataUrl }], parts)
              : [];
          const builtQuestion = buildQuestionTextFromParts(
            stem,
            parsedParts,
            block,
            pageNumber,
            imagePrimary,
          );
          const mcq =
            parsedParts.length < 2
              ? applyMcqExtract(builtQuestion, block)
              : { question: builtQuestion };
          out.push({
            id: `p${pageNumber}-q${idx + 1}`,
            pageNumber,
            question: mcq.question,
            rawText: block,
            imageDataUrl,
            imageDataUrls: [imageDataUrl],
            detectedParts: parsedParts.length >= 2 ? parsedParts : undefined,
            ...(mcq.mcqOptions
              ? { mcqOptions: mcq.mcqOptions, mcqCorrectAnswer: mcq.mcqCorrectAnswer }
              : {}),
          });
        });
        if (!blocks.length) {
          out.push(buildParsedQuestion(`p${pageNumber}`, [slice], imagePrimary));
        }
      } else {
        out.push(buildParsedQuestion(`p${pageNumber}`, [slice], imagePrimary));
      }
    }
  }

  onProgress?.(total, total);
  return out;
}

/** Render selected PDF pages to JPEG data URLs (for table + PDF import). */
export async function renderPdfPagesToDataUrls(
  file: File,
  pageNumbers: number[],
  onProgress?: (done: number, total: number) => void,
): Promise<Map<number, string>> {
  const unique = [...new Set(pageNumbers.filter((n) => Number.isFinite(n) && n >= 1))].sort(
    (a, b) => a - b,
  );
  const map = new Map<number, string>();
  if (!unique.length) return map;

  const pdfjs = await getPdfJs();
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data: bytes }).promise;

  let done = 0;
  for (const pageNumber of unique) {
    if (pageNumber > doc.numPages) continue;
    onProgress?.(done, unique.length);
    const page = await doc.getPage(pageNumber);
    map.set(pageNumber, await renderPageToDataUrl(page, PDF_RENDER_STANDARD));
    done += 1;
  }
  onProgress?.(unique.length, unique.length);
  return map;
}

export async function readPdfFileBytes(file: File): Promise<Uint8Array> {
  if (!file.type.includes("pdf") && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Please choose a PDF file.");
  }
  return new Uint8Array(await file.arrayBuffer());
}

export async function openPdfDocumentFromBytes(bytes: Uint8Array) {
  const pdfjs = await getPdfJs();
  return pdfjs.getDocument({ data: bytes, useSystemFonts: true }).promise;
}

export async function openPdfDocument(file: File) {
  const bytes = await readPdfFileBytes(file);
  return openPdfDocumentFromBytes(bytes);
}
