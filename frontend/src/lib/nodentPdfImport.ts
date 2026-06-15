import { type CropRect } from "@/lib/pdfImageCrop";
import {
  extractPageText,
  extractMcqOptionsFromText,
  openPdfDocument,
  PDF_RENDER_STANDARD,
  renderPageToDataUrl,
} from "@/lib/pdfQuestionImport";
import { formatPartDescriptor, formatSinglePartLabel, partLetterForIndex } from "@/lib/questionDisplay";
import { normalizeQuestionMathText } from "@/lib/questionMathText";

export type NodentQuestionType = "mcq" | "short_answer" | "long_answer";

export type NodentPartMeta = {
  key: string;
  marks: number;
  label: string;
  answer: string;
  placeholder: string;
};

export type NodentPageMeta = {
  questionId: string;
  subjectId: string;
  type: NodentQuestionType;
  topic: string;
  marks: number;
  question: string;
  passage?: string;
  parts: NodentPartMeta[];
  mcqOptions?: string[];
  correctAnswer?: string;
  /** When false, import without stimulus image. */
  useImage: boolean;
};

export type NodentParsedQuestion = {
  id: string;
  questionId: string;
  subjectId: string;
  pageNumber: number;
  question: string;
  marks: number;
  topic: string;
  type: NodentQuestionType;
  /** Cropped figure (metadata stripped). Empty when useImage is false. */
  imageDataUrl: string;
  /** Full page render for re-cropping in admin. Omitted when useImage is false. */
  sourceImageDataUrl?: string;
  crop: CropRect;
  parts: Array<{
    label: string;
    descriptor: string;
    placeholder: string;
    acceptedAnswer: string;
    marks: number;
  }>;
  mcqOptions?: string[];
  correctAnswer?: string;
  useImage: boolean;
  passage?: string;
  /** 1-based index when multiple ---NODENT--- blocks share one PDF page. */
  pageQuestionIndex?: number;
  pageQuestionCount?: number;
};

const IMAGE_FLAG_VALUES = new Set([
  "true",
  "false",
  "yes",
  "no",
  "0",
  "1",
  "none",
  "off",
  "on",
  "without",
  "with",
  "text_only",
  "text-only",
  "no_image",
  "with_image",
]);

function isImageFlagValue(raw: string): boolean {
  return IMAGE_FLAG_VALUES.has(raw.trim().toLowerCase());
}

function parsePassageFromFields(fields: Map<string, string>): string | undefined {
  for (const key of ["passage", "context", "stimulus_text", "stimulus_passage"] as const) {
    const val = fields.get(key)?.trim();
    if (val) return normalizeQuestionMathText(val);
  }
  const stimulus = fields.get("stimulus")?.trim();
  if (stimulus && !isImageFlagValue(stimulus)) {
    return normalizeQuestionMathText(stimulus);
  }
  return undefined;
}

function stripNodentBlocks(text: string): string {
  return normalizeNodentText(text).replace(/---NODENT---[\s\S]*?---END---/gi, "");
}

function normalizeNodentText(text: string): string {
  return text
    .replace(/\u2013|\u2014|\u2212/g, "-")
    .replace(/\uFF1A/g, ":")
    .replace(/-{2,}\s*\n\s*NODENT\s*\n\s*-{2,}/gi, "---NODENT---")
    .replace(/-{2,}\s*\n\s*END\s*\n\s*-{2,}/gi, "---END---")
    .replace(/-{2,}\s*NODENT\s*-{2,}/gi, "---NODENT---")
    .replace(/-{2,}\s*END\s*-{2,}/gi, "---END---");
}

function normalizeFieldKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function looksLikeFieldLine(line: string): boolean {
  const colon = line.indexOf(":");
  if (colon <= 0) return false;
  const key = normalizeFieldKey(line.slice(0, colon));
  return /^[a-z][a-z0-9_]*$/.test(key);
}

function parseFieldMap(block: string): Map<string, string> {
  const fields = new Map<string, string>();
  const normalized = block.replace(/\r\n/g, "\n").replace(/\uFF1A/g, ":");
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!;
    if (/^---(?:END|NODENT)---$/i.test(trimmed)) continue;
    const colon = trimmed.indexOf(":");
    if (colon < 0) continue;
    const key = normalizeFieldKey(trimmed.slice(0, colon));
    if (!key) continue;
    let val = trimmed.slice(colon + 1).trim();
    while (!val && i + 1 < lines.length) {
      const next = lines[i + 1]!;
      if (looksLikeFieldLine(next) || /^---/i.test(next)) break;
      val = next;
      i++;
    }
    if (!fields.has(key) || val) fields.set(key, val);
  }

  // PDF text often glues multiple key: value pairs on one line — pick up any we missed.
  const fieldRe = /\b([a-z][a-z0-9_]*)\s*:\s*/gi;
  const hits: { key: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = fieldRe.exec(normalized)) !== null) {
    hits.push({
      key: m[1]!.toLowerCase(),
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i]!;
    const nextStart = hits[i + 1]?.start ?? normalized.length;
    const val = normalized.slice(hit.end, nextStart).trim();
    if (!fields.has(hit.key) && val) fields.set(hit.key, val);
  }

  if (!fields.has("question_id")) {
    const idMatch = normalized.match(/\bquestion[_\s-]?id\s*:\s*(\S+)/i);
    if (idMatch?.[1]) fields.set("question_id", idMatch[1]);
  }

  return fields;
}

function normalizeType(raw: string): NodentQuestionType {
  const t = raw.trim().toLowerCase();
  if (t === "mcq" || t === "multiple_choice") return "mcq";
  if (t === "short" || t === "short_answer") return "short_answer";
  return "long_answer";
}

function normalizeCorrectLetter(raw: string): string {
  const t = raw.trim().toUpperCase();
  if (/^[A-D]$/.test(t)) return t;
  const m = t.match(/^([A-D])\b/);
  return m?.[1] ?? "";
}

function unwrapBracketOption(raw: string): string {
  let t = raw.trim();
  while (t.startsWith("[") && t.endsWith("]")) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

function parseBracketOptionList(raw: string): string[] {
  const groups = [...raw.matchAll(/\[([^\]]+)\]/g)].map((m) =>
    normalizeQuestionMathText(unwrapBracketOption(m[1] ?? "")),
  );
  return groups.filter(Boolean);
}

function parseMcqOptionsFromFields(fields: Map<string, string>): {
  options: string[];
  correctAnswer: string;
} {
  const letters = ["a", "b", "c", "d"] as const;
  let options = letters.map((l) =>
    unwrapBracketOption(
      normalizeQuestionMathText(
        fields.get(`option_${l}`) ??
          fields.get(`option ${l.toUpperCase()}`) ??
          fields.get(`option${l.toUpperCase()}`) ??
          "",
      ),
    ),
  );

  const optionsLine = fields.get("options") ?? fields.get("options_json") ?? "";
  if (optionsLine && options.some((o) => !o.trim())) {
    const bracketOpts = parseBracketOptionList(optionsLine);
    if (bracketOpts.length >= 4) {
      options = bracketOpts.slice(0, 4);
    }
  }

  const optionsJson = fields.get("options_json") ?? fields.get("options");
  if (optionsJson && options.some((o) => !o.trim()) && !optionsLine.includes("[")) {
    try {
      const parsed = JSON.parse(optionsJson) as unknown;
      if (Array.isArray(parsed) && parsed.length >= 4) {
        options = parsed.slice(0, 4).map((x) => normalizeQuestionMathText(String(x)));
      }
    } catch {
      const split = optionsJson
        .split(/\s*\|\s*|\s*;\s*|\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (split.length >= 4) {
        options = split.slice(0, 4).map((x) => unwrapBracketOption(normalizeQuestionMathText(x)));
      }
    }
  }

  // GPT sometimes mislabels option D as "placeholder" or "part_a_placeholder"
  if (!options[3]?.trim()) {
    for (const key of ["option_d", "placeholder", "part_a_placeholder"] as const) {
      const stray = fields.get(key)?.trim();
      if (stray) {
        options[3] = unwrapBracketOption(normalizeQuestionMathText(stray));
        break;
      }
    }
  }

  options = options.map((o) => unwrapBracketOption(o));

  const hasOptions = options.some((o) => o.trim());
  const correctAnswer = normalizeCorrectLetter(
    fields.get("correct_answer") ??
      fields.get("correct") ??
      (hasOptions ? "" : (fields.get("answer") ?? "")),
  );
  return { options, correctAnswer: hasOptions ? correctAnswer : "" };
}

function hasMcqOptionFields(fields: Map<string, string>): boolean {
  if (["a", "b", "c", "d"].some((l) => Boolean(fields.get(`option_${l}`)?.trim()))) {
    return true;
  }
  const optionsLine = fields.get("options") ?? "";
  return parseBracketOptionList(optionsLine).length >= 4;
}

function parseUseImage(fields: Map<string, string>): boolean {
  const raw = (
    fields.get("use_image") ??
    fields.get("include_image") ??
    fields.get("image") ??
    ""
  ).trim();
  if (raw) {
    if (isImageFlagValue(raw)) {
      return !["false", "no", "0", "none", "off", "without", "text_only", "text-only", "no_image"].includes(
        raw.toLowerCase(),
      );
    }
    return true;
  }
  const stimulus = fields.get("stimulus")?.trim() ?? "";
  if (stimulus && isImageFlagValue(stimulus)) {
    return !["false", "no", "0", "none", "off", "without", "text_only", "text-only", "no_image"].includes(
      stimulus.toLowerCase(),
    );
  }
  return true;
}

function partDescriptor(key: string, label: string): string {
  return formatPartDescriptor(key, label);
}

/** All ---NODENT--- … ---END--- block bodies in document order. */
export function extractNodentBlockBodies(text: string): string[] {
  const normalized = normalizeNodentText(text);
  const bodies: string[] = [];

  for (const m of normalized.matchAll(/---NODENT---([\s\S]*?)---END---/gi)) {
    const body = m[1]?.trim();
    if (body) bodies.push(body);
    if (bodies.length >= 12) break;
  }
  if (bodies.length) return bodies;

  // GPT sometimes omits ---END---; split on the next block or end of page text.
  for (const part of normalized.split(/---NODENT---/i).slice(1)) {
    const withoutEnd = part.replace(/---END---[\s\S]*/i, "").trim();
    const nextMarker = withoutEnd.search(/---NODENT---/i);
    const body = (nextMarker >= 0 ? withoutEnd.slice(0, nextMarker) : withoutEnd).trim();
    if (body) bodies.push(body);
    if (bodies.length >= 12) break;
  }
  return bodies;
}

function parseNodentMetadataBlock(blockBody: string): NodentPageMeta | null {
  const fields = parseFieldMap(blockBody);
  const questionId = fields.get("question_id") ?? "";
  if (!questionId) return null;

  const totalMarks = Math.max(1, Math.round(Number(fields.get("marks")) || 0));
  const type = normalizeType(fields.get("type") ?? "short_answer");
  const topic = fields.get("topic") ?? "General";
  const question = normalizeQuestionMathText(fields.get("question") ?? "");
  const passage = parsePassageFromFields(fields);
  const useImage = parseUseImage(fields);

  const mcqParsed = parseMcqOptionsFromFields(fields);
  const isMcq =
    type === "mcq" || hasMcqOptionFields(fields) || mcqParsed.options.every((o) => o.trim());

  if (isMcq && mcqParsed.options.some((o) => o.trim())) {
    const marks = Math.max(1, Math.round(Number(fields.get("marks")) || 1));
    return {
      questionId,
      subjectId: fields.get("subject_id") ?? "",
      type: "mcq",
      topic,
      marks,
      question,
      passage,
      parts: [],
      mcqOptions: mcqParsed.options,
      correctAnswer: mcqParsed.correctAnswer,
      useImage,
    };
  }

  if (type === "mcq") {
    const marks = Math.max(1, Math.round(Number(fields.get("marks")) || 1));
    return {
      questionId,
      subjectId: fields.get("subject_id") ?? "",
      type: "mcq",
      topic,
      marks,
      question,
      passage,
      parts: [],
      mcqOptions: mcqParsed.options,
      correctAnswer: mcqParsed.correctAnswer,
      useImage,
    };
  }

  const partLetters = new Set<string>();
  for (const key of fields.keys()) {
    const m = key.match(/^part_([a-z])_/);
    if (m?.[1]) partLetters.add(m[1]);
  }

  let parts: NodentPartMeta[] = [];

  if (partLetters.size > 0) {
    parts = [...partLetters]
      .sort()
      .map((letter) => ({
        key: letter,
        marks: Math.max(1, Math.round(Number(fields.get(`part_${letter}_marks`)) || 1)),
        label: fields.get(`part_${letter}_label`) ?? "",
        answer: fields.get(`part_${letter}_answer`) ?? "",
        placeholder: fields.get(`part_${letter}_placeholder`) ?? "Type your answer…",
      }))
      .filter((p) => p.label || p.answer);
  } else if (
    fields.has("part_label") ||
    fields.has("accepted_answer") ||
    fields.has("answer")
  ) {
    const key = (fields.get("part_key") ?? "a").toLowerCase();
    const answer =
      fields.get("accepted_answer") ?? fields.get("answer") ?? fields.get("correct_answer") ?? "";
    parts = [
      {
        key,
        marks: totalMarks,
        label: fields.get("part_label") ?? "Answer",
        answer,
        placeholder: fields.get("placeholder") ?? "Type your answer…",
      },
    ];
  }

  if (!parts.length && question.trim()) {
    parts = [
      {
        key: "a",
        marks: totalMarks,
        label: "Answer",
        answer: fields.get("accepted_answer") ?? fields.get("answer") ?? "",
        placeholder: fields.get("placeholder") ?? "Type your answer…",
      },
    ];
  }

  if (!parts.length) {
    parts = [
      {
        key: "a",
        marks: totalMarks,
        label: "Answer",
        answer: fields.get("accepted_answer") ?? fields.get("answer") ?? "",
        placeholder: fields.get("placeholder") ?? "Type your answer…",
      },
    ];
  }

  const marks =
    parts.length >= 2
      ? parts.reduce((sum, p) => sum + p.marks, 0) || totalMarks
      : totalMarks;

  return {
    questionId,
    subjectId: fields.get("subject_id") ?? "",
    type,
    topic,
    marks,
    question,
    passage,
    parts,
    useImage,
  };
}

/** Parse every NODENT block on a page (or in pasted text). */
export function parseAllNodentMetadataBlocks(text: string): NodentPageMeta[] {
  return extractNodentBlockBodies(text)
    .map((body) => parseNodentMetadataBlock(body))
    .filter((m): m is NodentPageMeta => m != null);
}

export function parseNodentMetadata(text: string): NodentPageMeta | null {
  return parseAllNodentMetadataBlocks(text)[0] ?? null;
}

type TextItem = { str: string; x: number; y: number };

async function extractPositionedItems(
  page: import("pdfjs-dist").PDFPageProxy,
): Promise<TextItem[]> {
  const content = await page.getTextContent();
  return (content.items as Array<{ str?: string; transform?: number[] }>)
    .filter((it) => it.str?.trim())
    .map((it) => ({
      str: it.str!.trim(),
      x: it.transform![4]!,
      y: it.transform![5]!,
    }));
}

/** Crop rectangle for the figure area below the ---NODENT--- metadata block. */
export async function estimateNodentFigureCrop(
  page: import("pdfjs-dist").PDFPageProxy,
): Promise<CropRect> {
  const viewport = page.getViewport({ scale: 1 });
  const pageH = viewport.height;
  const items = await extractPositionedItems(page);

  const metadataItems = items.filter(
    (it) =>
      it.str.includes("NODENT") ||
      it.str.includes("---END---") ||
      /^[a-z0-9_]+:/i.test(it.str),
  );

  if (!metadataItems.length) {
    return { x: 0, y: 0.28, w: 1, h: 0.72 };
  }

  let maxFromTop = 0;
  for (const item of metadataItems) {
    const fromTop = pageH - item.y;
    maxFromTop = Math.max(maxFromTop, fromTop + 14);
  }

  const y = Math.min(0.92, Math.max(0.12, maxFromTop / pageH + 0.015));
  return { x: 0, y, w: 1, h: Math.max(0.05, 1 - y) };
}

export function isNodentPdfText(text: string): boolean {
  return /---\s*NODENT\s*---/i.test(normalizeNodentText(text));
}

export type ParseNodentPdfOptions = {
  imagePrimary?: boolean;
  onProgress?: (page: number, total: number) => void;
};

function defaultCropForMetaCount(metaCount: number): CropRect {
  const y = Math.min(0.55, 0.1 + Math.max(1, metaCount) * 0.035);
  return { x: 0, y, w: 1, h: Math.max(0.35, 1 - y) };
}

function metaNeedsMcqFill(meta: NodentPageMeta): boolean {
  if (meta.type !== "mcq") return false;
  if (meta.mcqOptions?.length === 4 && meta.mcqOptions.every((o) => o.trim())) {
    return false;
  }
  return true;
}

function buildQuestionsFromPage(
  metas: NodentPageMeta[],
  pageNumber: number,
  pageMcqFromText: ReturnType<typeof extractMcqOptionsFromText> | null,
  imagePrimary: boolean,
  sourceImageDataUrl: string,
  crop: CropRect,
): NodentParsedQuestion[] {
  const pageQuestionCount = metas.length;
  const out: NodentParsedQuestion[] = [];

  for (let qi = 0; qi < metas.length; qi++) {
    const meta = metas[qi]!;
    let mcqOptions = meta.mcqOptions?.map((o) => o.trim());
    let correctAnswer = meta.correctAnswer ?? "";
    let questionStem = meta.question.trim();

    if (metaNeedsMcqFill(meta)) {
      const fromText = pageMcqFromText;
      const extracted =
        fromText?.options?.length === 4
          ? fromText
          : fromText?.options?.[3]?.trim()
            ? fromText
            : null;
      if (extracted?.options?.length === 4) {
        mcqOptions = [...extracted.options];
        if (!correctAnswer && extracted.correctAnswer) {
          correctAnswer = extracted.correctAnswer;
        }
        if (!questionStem && extracted.stem.trim()) {
          questionStem = extracted.stem.trim();
        }
      } else if (
        mcqOptions &&
        mcqOptions.filter((o) => o.trim()).length >= 3 &&
        !mcqOptions[3]?.trim()
      ) {
        const dOpt = fromText?.options?.[3]?.trim();
        if (dOpt) mcqOptions[3] = dOpt;
      }
    }

    const isMcqRow =
      meta.type === "mcq" || Boolean(mcqOptions?.filter((o) => o.trim()).length);
    const useImage = meta.useImage;

    const stem =
      questionStem ||
      (imagePrimary && useImage ? "See figure." : `Question ${meta.questionId}`);

    const safeId = meta.questionId.replace(/[^\w.-]+/g, "_");
    const uniqueId =
      pageQuestionCount > 1
        ? `${safeId}_p${pageNumber}_q${qi + 1}`
        : `${safeId}_p${pageNumber}`;

    out.push({
      id: uniqueId,
      questionId: meta.questionId,
      subjectId: meta.subjectId,
      pageNumber,
      pageQuestionIndex: qi + 1,
      pageQuestionCount,
      question: stem,
      marks: meta.marks,
      topic: meta.topic,
      type: isMcqRow && mcqOptions?.every((o) => o.trim()) ? "mcq" : meta.type,
      useImage,
      imageDataUrl: useImage ? sourceImageDataUrl : "",
      sourceImageDataUrl: useImage ? sourceImageDataUrl || undefined : undefined,
      crop,
      parts: isMcqRow
        ? []
        : meta.parts.map((p, idx) => {
            const letter = partLetterForIndex(idx);
            const multi = meta.parts.length >= 2;
            return {
              label: letter,
              descriptor: multi
                ? partDescriptor(letter, p.label)
                : formatSinglePartLabel(p.label) || p.label.trim() || "Answer",
              placeholder: p.placeholder,
              acceptedAnswer: p.answer,
              marks: p.marks,
            };
          }),
      ...(mcqOptions?.every((o) => o.trim())
        ? {
            mcqOptions,
            correctAnswer,
          }
        : {}),
      ...(meta.passage ? { passage: meta.passage } : {}),
    });
  }

  return out;
}

/** Parse a NODENT PDF — one page at a time, text then image (never concurrent). */
export async function parseNodentPdfToQuestions(
  file: File,
  { imagePrimary = true, onProgress }: ParseNodentPdfOptions = {},
): Promise<{ questions: NodentParsedQuestion[]; errors: string[] }> {
  const doc = await openPdfDocument(file);
  const total = doc.numPages;
  const questions: NodentParsedQuestion[] = [];
  const errors: string[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= total; pageNumber++) {
      onProgress?.(pageNumber, total);
      const page = await doc.getPage(pageNumber);
      const text = normalizeNodentText(await extractPageText(page));
      const metas = parseAllNodentMetadataBlocks(text);

      if (!metas.length) {
        const bodies = extractNodentBlockBodies(text);
        const hint = /NODENT/i.test(text)
          ? bodies.length
            ? " (NODENT marker found but question_id missing — check key: value format)"
            : " (NODENT text found but block not closed with ---END---?)"
          : text.trim()
            ? " (page text found but no NODENT marker)"
            : " (no extractable text on this page)";
        errors.push(`Page ${pageNumber}: no question parsed${hint}.`);
        if (pageNumber === 1) {
          console.warn("[nodent-import] page 1 text sample:", text.slice(0, 600));
        }
        continue;
      }

      const pageNeedsImage = metas.some((m) => m.useImage);
      const crop = defaultCropForMetaCount(metas.length);
      let sourceImageDataUrl = "";
      if (pageNeedsImage) {
        sourceImageDataUrl = await renderPageToDataUrl(page, PDF_RENDER_STANDARD);
      }

      const needsMcqTextFill = metas.some((m) => metaNeedsMcqFill(m));
      const strippedText = stripNodentBlocks(text).trim();
      const pageMcqFromText = needsMcqTextFill ? extractMcqOptionsFromText(strippedText) : null;

      questions.push(
        ...buildQuestionsFromPage(
          metas,
          pageNumber,
          pageMcqFromText,
          imagePrimary,
          sourceImageDataUrl,
          crop,
        ),
      );
    }
  } finally {
    await doc.destroy();
  }

  return { questions, errors };
}

/** Fast check: first page has a NODENT block. */
export async function quickDetectNodentPdf(file: File): Promise<boolean> {
  const doc = await openPdfDocument(file);
  try {
    if (doc.numPages < 1) return false;
    const page = await doc.getPage(1);
    const text = await extractPageText(page);
    return isNodentPdfText(text);
  } finally {
    await doc.destroy();
  }
}

/** True when every page in the PDF has a NODENT metadata block. */
export async function detectNodentPdf(file: File): Promise<boolean> {
  const doc = await openPdfDocument(file);
  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const text = await extractPageText(page);
      if (!isNodentPdfText(text)) return false;
    }
    return doc.numPages > 0;
  } finally {
    await doc.destroy();
  }
}
