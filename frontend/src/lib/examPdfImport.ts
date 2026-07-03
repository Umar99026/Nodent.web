import type { QuestionDraft } from "@/lib/createAssessmentDraft";
import { createEmptyQuestionDraft } from "@/lib/createAssessmentDraft";
import {
  applyParsedAnswerToQuestion,
  extractQuestionNumberFromId,
  parseAnswerKeyDocument,
  parsePastedAnswers,
  type ParsedAnswerQuestion,
} from "@/lib/createPdfAnswerImport";
import { cropImageDataUrl, FULL_CROP, type CropRect } from "@/lib/pdfImageCrop";
import {
  extractMcqOptionsFromText,
  extractPageText,
  openPdfDocument,
  parsePdfToQuestions,
  stripExamBoilerplate,
  type PdfParsedQuestion,
  type PdfSplitMode,
} from "@/lib/pdfQuestionImport";
import {
  parseNodentPdfToQuestions,
  quickDetectNodentPdf,
  type NodentParsedQuestion,
} from "@/lib/nodentPdfImport";
import { parseLabeledExamPdf } from "@/lib/labeledExamPdfImport";
import {
  normalizeMcqOptions,
  partLetterForIndex,
  stripMainPartPrefix,
} from "@/lib/questionDisplay";
import {
  answerSlotsFromSolutionTsv,
  isMcqSlotKey,
  questionNumberFromSlotKey,
} from "@/lib/practiceExamImport";
import { normalizeQuestionMathText } from "@/lib/questionMathText";

function trimAcceptedAnswer(answer: string | undefined): string {
  const cleaned = String(answer ?? "").trim();
  if (!cleaned || cleaned.length > 500) return "";
  return cleaned;
}

export type ExamImportPart = {
  key: string;
  label: string;
  descriptor: string;
  placeholder: string;
  acceptedAnswer: string;
  marks: number;
  imageDataUrl?: string;
  /** PDF page chosen for this subpart's figure (1-based). */
  imagePageNumber?: number;
  sourceImageDataUrl?: string;
  crop?: CropRect;
  cropApplied?: boolean;
  cropping?: boolean;
};

export type ExamImportRow = {
  id: string;
  selected: boolean;
  questionNumber: number | null;
  pageNumber: number;
  pageNumbers?: number[];
  question: string;
  passage?: string;
  marks: number;
  type: "mcq" | "short_answer" | "long_answer";
  imageDataUrl: string;
  sourceImageDataUrl?: string;
  imageDataUrls?: string[];
  crop: CropRect;
  cropApplied: boolean;
  cropping: boolean;
  useImage: boolean;
  parts: ExamImportPart[];
  mcqOptions: string[];
  correctAnswer: string;
  fromNodent?: boolean;
  pageQuestionIndex?: number;
  pageQuestionCount?: number;
  /** PDF page for the main question figure (1-based). Defaults from parser. */
  imagePageNumber?: number;
  /** Section label from exam PDF, e.g. Section A or Module 2. */
  examSection?: string;
  /** Question number within that section (as printed on the paper). */
  examLocalNumber?: number;
};

export type QuestionImportMatchReport = {
  tsvRows: number;
  matchedQuestions: number;
  /** PDF skeleton slots (when a question PDF was uploaded). */
  pdfQuestions: number;
  /** PDF slots that still have no TSV wording. */
  awaitingTsv: number;
  /** TSV slots that did not match any parsed question number. */
  unmatchedTsv: Array<{ question: number; part: string; answer: string }>;
  /** Parsed questions with no TSV answers (or incomplete). */
  incompleteQuestions: Array<{
    question: number;
    missingParts: string[];
    filledParts: string[];
  }>;
};

function questionNumberFromId(id: string): number | null {
  return extractQuestionNumberFromId(id);
}

function defaultMcqOptions(): string[] {
  return ["", "", "", ""];
}

function defaultPart(index: number, marks = 1): ExamImportPart {
  const letter = partLetterForIndex(index);
  return {
    key: letter,
    label: letter,
    descriptor: "",
    placeholder: "Type your answer…",
    acceptedAnswer: "",
    marks,
  };
}

function partsFromParsed(q: PdfParsedQuestion): ExamImportPart[] {
  if (q.detectedParts && q.detectedParts.length >= 1) {
    return q.detectedParts.map((p) => ({
      key: p.label || "a",
      label: p.label || "a",
      descriptor: p.descriptor.trim(),
      placeholder: "Type your answer…",
      acceptedAnswer: "",
      marks: p.marks && p.marks > 0 ? p.marks : 1,
      imageDataUrl: p.imageDataUrl,
    }));
  }
  return [];
}

function totalMarksForRow(parts: ExamImportPart[], fallback: number): number {
  if (parts.length >= 2) {
    const sum = parts.reduce((s, p) => s + Math.max(1, Math.round(p.marks || 1)), 0);
    return sum > 0 ? sum : fallback;
  }
  return Math.max(1, Math.round(parts[0]?.marks ?? fallback));
}

function mcqFieldsFromParsed(q: {
  question: string;
  rawText?: string;
  mcqOptions?: string[];
  mcqCorrectAnswer?: string;
}): {
  type: "mcq" | "short_answer" | "long_answer";
  mcqOptions: string[];
  correctAnswer: string;
  question: string;
} {
  let options = q.mcqOptions?.length === 4 ? [...q.mcqOptions] : null;
  let correctAnswer = (q.mcqCorrectAnswer ?? "").trim().toUpperCase();
  let question = q.question;

  if (!options?.every((o) => o.trim())) {
    for (const source of [q.rawText, q.question].filter(Boolean)) {
      const extracted = extractMcqOptionsFromText(source!);
      if (extracted.options?.length === 4 && extracted.options.every((o) => o.trim())) {
        options = [...extracted.options];
        question = extracted.stem.trim() || question;
        if (!correctAnswer && extracted.correctAnswer) {
          correctAnswer = extracted.correctAnswer;
        }
        break;
      }
    }
  }

  if (options?.every((o) => o.trim())) {
    return {
      type: "mcq",
      mcqOptions: normalizeMcqOptions(options),
      correctAnswer,
      question,
    };
  }

  return {
    type: "short_answer",
    mcqOptions: defaultMcqOptions(),
    correctAnswer: "",
    question,
  };
}

function nodentToRow(q: NodentParsedQuestion): ExamImportRow {
  const mcq = mcqFieldsFromParsed({
    question: q.question,
    mcqOptions: q.mcqOptions,
    mcqCorrectAnswer: q.correctAnswer,
  });
  const parts =
    mcq.type === "mcq"
      ? []
      : q.parts.map((p, idx) => ({
          key: partLetterForIndex(idx),
          label: partLetterForIndex(idx),
          descriptor: p.descriptor,
          placeholder: p.placeholder,
          acceptedAnswer: p.acceptedAnswer,
          marks: p.marks,
        }));

  return {
    id: q.id,
    selected: true,
    questionNumber: questionNumberFromId(q.questionId) ?? questionNumberFromId(q.id),
    pageNumber: q.pageNumber,
    question: mcq.question,
    passage: q.passage,
    marks:
      mcq.type === "mcq"
        ? 1
        : parts.length >= 2
          ? totalMarksForRow(parts, q.marks)
          : q.marks,
    type: mcq.type === "mcq" ? "mcq" : q.type,
    imageDataUrl: q.imageDataUrl,
    sourceImageDataUrl: q.sourceImageDataUrl,
    crop: q.crop,
    cropApplied: false,
    cropping: false,
    useImage: q.useImage !== false,
    parts,
    mcqOptions: mcq.mcqOptions,
    correctAnswer: mcq.correctAnswer || q.correctAnswer || "",
    fromNodent: true,
    pageQuestionIndex: q.pageQuestionIndex,
    pageQuestionCount: q.pageQuestionCount,
  };
}

function genericToRow(q: PdfParsedQuestion): ExamImportRow {
  const mcq = mcqFieldsFromParsed(q);
  const parts = mcq.type === "mcq" ? [] : partsFromParsed(q);
  const rowType =
    mcq.type === "mcq"
      ? "mcq"
      : parts.length >= 2
        ? "long_answer"
        : "short_answer";

  return {
    id: q.id,
    selected: true,
    questionNumber: questionNumberFromId(q.id),
    pageNumber: q.pageNumber,
    pageNumbers: q.pageNumbers,
    question: mcq.type === "mcq" ? mcq.question : (q.stem?.trim() || mcq.question),
    examSection: q.examSection,
    examLocalNumber: q.examLocalNumber,
    marks:
      mcq.type === "mcq"
        ? 1
        : parts.length >= 2
          ? totalMarksForRow(parts, q.marks ?? 1)
          : Math.max(1, q.marks ?? 1),
    type: rowType,
    imageDataUrl: q.imageDataUrl,
    sourceImageDataUrl: q.imageDataUrl,
    imageDataUrls: q.imageDataUrls,
    crop: FULL_CROP,
    cropApplied: false,
    cropping: false,
    useImage: true,
    parts,
    mcqOptions: mcq.mcqOptions,
    correctAnswer: mcq.correctAnswer,
  };
}

export async function parseExamQuestionPdf(
  file: File,
  options?: {
    splitMode?: PdfSplitMode;
    onProgress?: (done: number, total: number) => void;
    /** PDF images + question slots only; wording comes from TSV. */
    skeletonOnly?: boolean;
  },
): Promise<{ rows: ExamImportRow[]; errors: string[]; source: "nodent" | "generic" }> {
  const isNodent = await quickDetectNodentPdf(file);
  if (isNodent) {
    const { questions, errors } = await parseNodentPdfToQuestions(file, {
      onProgress: options?.onProgress,
    });
    return { rows: questions.map(nodentToRow), errors, source: "nodent" };
  }

  const skeletonOnly = options?.skeletonOnly ?? false;

  const labeled = await parseLabeledExamPdf(file, {
    onProgress: options?.onProgress,
    skeletonOnly,
  });
  if (labeled.questions.length > 0) {
    return {
      rows: labeled.questions.map(genericToRow),
      errors: [],
      source: "generic",
    };
  }

  if (skeletonOnly) {
    return { rows: [], errors: ["No question headers found in PDF."], source: "generic" };
  }

  const questions = await parsePdfToQuestions(file, {
    splitMode: options?.splitMode ?? "per_question",
    imagePrimary: false,
    onProgress: options?.onProgress,
  });
  return { rows: questions.map(genericToRow), errors: [], source: "generic" };
}

export async function extractAnswerPdfText(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<string> {
  const doc = await openPdfDocument(file);
  const chunks: string[] = [];
  for (let page = 1; page <= doc.numPages; page++) {
    onProgress?.(page - 1, doc.numPages);
    const text = await extractPageText(await doc.getPage(page));
    if (text.trim()) chunks.push(text);
  }
  onProgress?.(doc.numPages, doc.numPages);
  return chunks.join("\n\n");
}

/** Split full solutions text into blocks keyed by question number. */
export function splitSolutionsByQuestionNumber(fullText: string): Map<number, string> {
  const cleaned = stripExamBoilerplate(fullText);
  if (!cleaned.trim()) return new Map();

  const markerRe = /(?:^|\n)\s*(?:Question|QUESTION|Q)\s*(\d+)\b/gi;
  const matches = [...cleaned.matchAll(markerRe)];
  if (!matches.length) {
    return new Map();
  }

  const result = new Map<number, string>();
  for (let i = 0; i < matches.length; i++) {
    const num = Number(matches[i]![1]);
    if (!Number.isFinite(num)) continue;
    const start = matches[i]!.index ?? 0;
    const end =
      i + 1 < matches.length
        ? (matches[i + 1]!.index ?? cleaned.length)
        : cleaned.length;
    const block = cleaned.slice(start, end).trim();
    if (block) result.set(num, block);
  }
  return result;
}

const STEM_PART_KEYS = new Set(["stem", "intro", "question", "stimulus", "passage"]);

function isMinimalPartLabel(label: string): boolean {
  return /^[a-z][.)]?\s*$/i.test(label.trim());
}

function preferPartDescriptor(tsvLabel: string | undefined, pdfDescriptor: string): string {
  const fromTsv = String(tsvLabel ?? "").trim();
  if (fromTsv && !isMinimalPartLabel(fromTsv)) return fromTsv;
  const fromPdf = pdfDescriptor.trim();
  if (fromPdf) return fromPdf;
  return fromTsv;
}

function applyParsedToRow(row: ExamImportRow, parsed: ParsedAnswerQuestion): ExamImportRow {
  let next: ExamImportRow = { ...row };

  if (parsed.questionText?.trim()) {
    next = {
      ...next,
      question: normalizeQuestionMathText(parsed.questionText.trim()),
    };
  }

  if (row.type === "mcq") {
    const letter = parsed.mcqAnswer?.trim().toUpperCase();
    if (letter && /^[A-D]$/.test(letter)) {
      return { ...next, correctAnswer: letter };
    }
    const first = parsed.parts[0]?.answer?.trim().toUpperCase();
    if (first && /^[A-D]$/.test(first)) {
      return { ...next, correctAnswer: first };
    }
    return next;
  }

  if (!parsed.parts.length) return next;

  const parsedByKey = new Map(
    parsed.parts.map((p) => [p.key.trim().toLowerCase(), p]),
  );

  let parts = row.parts.length ? [...row.parts] : [];
  const seen = new Set<string>();

  parts = parts.map((part) => {
    const pk = part.key.trim().toLowerCase();
    seen.add(pk);
    const fromTsv = parsedByKey.get(pk);
    if (!fromTsv) return part;
    parsedByKey.delete(pk);
    return {
      ...part,
      key: fromTsv.key || part.key,
      label: fromTsv.key || part.label,
      acceptedAnswer: trimAcceptedAnswer(fromTsv.answer) || part.acceptedAnswer,
      descriptor: preferPartDescriptor(fromTsv.label, part.descriptor),
    };
  });

  for (const fromTsv of parsedByKey.values()) {
    const pk = fromTsv.key.trim().toLowerCase();
    if (seen.has(pk)) continue;
    parts.push({
      ...defaultPart(parts.length),
      key: fromTsv.key,
      label: fromTsv.key,
      descriptor: fromTsv.label?.trim() || `${fromTsv.key}.`,
      acceptedAnswer: trimAcceptedAnswer(fromTsv.answer),
    });
  }

  parts.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));

  const rowType = parts.length >= 2 ? "long_answer" : "short_answer";

  return {
    ...next,
    type: rowType,
    parts,
    marks:
      parts.length >= 2 ? totalMarksForRow(parts, row.marks) : Math.max(1, row.marks),
  };
}

function partKeyFromSlotKey(key: string): string {
  const match = String(key ?? "")
    .trim()
    .match(/^q?\d+\s*[-_.]?\s*([a-z]+)$/i);
  if (!match?.[1]) return "a";
  const part = match[1].toLowerCase();
  return part === "mcq" ? "a" : part;
}

function slotsToParsedMap(
  slots: ReturnType<typeof answerSlotsFromSolutionTsv>,
): Map<
  number,
  ParsedAnswerQuestion & {
    marksByPart: Map<string, number>;
    examSection?: string;
    examLocalNumber?: number;
  }
> {
  const map = new Map<
    number,
    ParsedAnswerQuestion & {
      marksByPart: Map<string, number>;
      examSection?: string;
      examLocalNumber?: number;
    }
  >();

  for (const slot of slots) {
    const qn = questionNumberFromSlotKey(slot.key);
    if (!qn) continue;
    const existing = map.get(qn) ?? {
      questionNumber: qn,
      parts: [],
      marksByPart: new Map<string, number>(),
      examSection: slot.examSection,
      examLocalNumber: slot.examLocalNumber,
    };

    if (slot.examSection && !existing.examSection) {
      existing.examSection = slot.examSection;
      existing.examLocalNumber = slot.examLocalNumber;
    }

    if (isMcqSlotKey(slot.key)) {
      existing.mcqAnswer = slot.acceptedAnswer.trim();
      existing.marksByPart.set("mcq", slot.marks ?? 1);
      if (slot.questionStem?.trim()) {
        existing.questionText = slot.questionStem.trim();
      }
    } else {
      const pk = partKeyFromSlotKey(slot.key);
      if (STEM_PART_KEYS.has(pk)) {
        existing.questionText =
          slot.descriptor?.trim() || slot.questionStem?.trim() || existing.questionText;
        if (slot.acceptedAnswer.trim()) {
          existing.parts.push({
            key: pk,
            label: slot.descriptor?.trim() || pk,
            answer: slot.acceptedAnswer.trim(),
            order: existing.parts.length,
          });
        }
      } else {
        existing.parts.push({
          key: pk,
          label: slot.descriptor?.trim() || `${pk})`,
          answer: slot.acceptedAnswer.trim(),
          order: existing.parts.length,
        });
        existing.marksByPart.set(pk, slot.marks ?? 1);
      }
    }
    map.set(qn, existing);
  }

  for (const entry of map.values()) {
    entry.parts.sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
  }
  return map;
}

function applyMarksFromTsv(row: ExamImportRow, marksByPart: Map<string, number>): ExamImportRow {
  if (row.type === "mcq") {
    const mcqMarks = marksByPart.get("mcq");
    return mcqMarks ? { ...row, marks: mcqMarks } : row;
  }
  const parts = row.parts.map((part) => {
    const mk = marksByPart.get(part.key.trim().toLowerCase());
    return mk ? { ...part, marks: mk } : part;
  });
  return {
    ...row,
    parts,
    marks: parts.length >= 2 ? totalMarksForRow(parts, row.marks) : row.marks,
  };
}

/** Paste template: PDF supplies figures; TSV supplies wording + answers. */
export const EXAM_IMPORT_TSV_TEMPLATE = `question\tpart\tquestion_text\tanswer\tmarks
1\tstem\tThe table below displays the average sleep time, in hours, for a sample of 19 mammals.\t\t0
1\ta\tWhich of the two variables is a nominal variable?\tnominal\t1
1\tb\tDetermine the mean and standard deviation of average sleep time for this sample.\t8.5\t1
1\tc\tWhat percentage of mammals have average sleep time less than a human?\t52.6\t1
1\td\tBy how many hours will the range increase when the bat is added?\t5.1\t1
2\ta\tShow that a boxplot from this five-number summary will not display outliers.\t\t1`;

function buildRowFromTsvParsed(
  qNum: number,
  parsed: ParsedAnswerQuestion & {
    marksByPart: Map<string, number>;
    examSection?: string;
    examLocalNumber?: number;
  },
  pdfSkeleton?: ExamImportRow,
): ExamImportRow {
  const parts = parsed.parts
    .filter((p) => !STEM_PART_KEYS.has(p.key.trim().toLowerCase()))
    .map((p, index) => ({
      ...defaultPart(index),
      key: p.key,
      label: p.key,
      descriptor: p.label?.trim() || `${p.key}.`,
      acceptedAnswer: trimAcceptedAnswer(p.answer),
      marks: parsed.marksByPart.get(p.key.trim().toLowerCase()) ?? 1,
    }));

  const isMcq = Boolean(parsed.mcqAnswer?.trim()) && parts.length === 0;
  const rowType = isMcq
    ? "mcq"
    : parts.length >= 2
      ? "long_answer"
      : "short_answer";

  return {
    id: `q${qNum}`,
    selected: true,
    questionNumber: qNum,
    pageNumber: pdfSkeleton?.pageNumber ?? 1,
    pageNumbers: pdfSkeleton?.pageNumbers,
    question: parsed.questionText?.trim()
      ? normalizeQuestionMathText(parsed.questionText.trim())
      : "",
    examSection: pdfSkeleton?.examSection ?? parsed.examSection,
    examLocalNumber: pdfSkeleton?.examLocalNumber ?? parsed.examLocalNumber,
    marks:
      parts.length >= 2
        ? totalMarksForRow(parts, pdfSkeleton?.marks ?? 1)
        : Math.max(1, pdfSkeleton?.marks ?? 1),
    type: rowType,
    imageDataUrl: pdfSkeleton?.imageDataUrl ?? "",
    sourceImageDataUrl: pdfSkeleton?.sourceImageDataUrl ?? pdfSkeleton?.imageDataUrl,
    imageDataUrls: pdfSkeleton?.imageDataUrls,
    imagePageNumber: pdfSkeleton?.imagePageNumber ?? pdfSkeleton?.pageNumber,
    crop: FULL_CROP,
    cropApplied: false,
    cropping: false,
    useImage: Boolean(pdfSkeleton?.imageDataUrl),
    parts,
    mcqOptions: pdfSkeleton?.mcqOptions ?? defaultMcqOptions(),
    correctAnswer: parsed.mcqAnswer?.trim().toUpperCase() ?? "",
  };
}

/** Build import rows from TSV alone (no PDF). */
export function buildExamImportRowsFromTsv(tsvText: string): ExamImportRow[] {
  const byQuestion = slotsToParsedMap(answerSlotsFromSolutionTsv(tsvText));
  return [...byQuestion.entries()]
    .sort(([a], [b]) => a - b)
    .map(([qNum, parsed]) => buildRowFromTsvParsed(qNum, parsed));
}

/** TSV owns all wording; PDF skeleton only supplies pages/images. */
export function applyTsvToExamImportRows(
  pdfSkeletonRows: ExamImportRow[],
  tsvText: string,
): { rows: ExamImportRow[]; report: QuestionImportMatchReport } {
  const slots = answerSlotsFromSolutionTsv(tsvText);
  const byQuestion = slotsToParsedMap(slots);

  const emptyReport: QuestionImportMatchReport = {
    tsvRows: slots.length,
    matchedQuestions: 0,
    pdfQuestions: pdfSkeletonRows.length,
    awaitingTsv: pdfSkeletonRows.length,
    unmatchedTsv: [],
    incompleteQuestions: [],
  };

  if (!byQuestion.size) {
    return { rows: pdfSkeletonRows, report: emptyReport };
  }

  const pdfByNum = new Map<number, ExamImportRow>();
  for (let i = 0; i < pdfSkeletonRows.length; i++) {
    const row = pdfSkeletonRows[i]!;
    const qNum = row.questionNumber ?? questionNumberFromId(row.id) ?? i + 1;
    pdfByNum.set(qNum, row);
  }

  const tsvRows: ExamImportRow[] = [];
  const matchedQuestionNums = new Set<number>();

  for (const [qNum, parsed] of [...byQuestion.entries()].sort(([a], [b]) => a - b)) {
    tsvRows.push(buildRowFromTsvParsed(qNum, parsed, pdfByNum.get(qNum)));
    matchedQuestionNums.add(qNum);
  }

  let rows: ExamImportRow[];
  if (pdfSkeletonRows.length > 0) {
    const tsvByNum = new Map<number, ExamImportRow>();
    for (const row of tsvRows) {
      const qNum = row.questionNumber ?? questionNumberFromId(row.id);
      if (qNum != null && qNum > 0) tsvByNum.set(qNum, row);
    }

    rows = [];
    const seenPdf = new Set<number>();
    const sortedSkeleton = [...pdfSkeletonRows].sort((a, b) => {
      const qa = a.questionNumber ?? questionNumberFromId(a.id) ?? 0;
      const qb = b.questionNumber ?? questionNumberFromId(b.id) ?? 0;
      return qa - qb;
    });

    for (const skeleton of sortedSkeleton) {
      const qNum =
        skeleton.questionNumber ?? questionNumberFromId(skeleton.id) ?? rows.length + 1;
      seenPdf.add(qNum);
      const fromTsv = tsvByNum.get(qNum);
      rows.push(
        fromTsv ?? {
          ...skeleton,
          question: "",
          parts: [],
          selected: skeleton.selected ?? true,
        },
      );
    }

    for (const [qNum, row] of [...tsvByNum.entries()].sort(([a], [b]) => a - b)) {
      if (!seenPdf.has(qNum)) rows.push(row);
    }
  } else {
    rows = tsvRows;
  }

  const pdfQuestionNums = new Set(pdfByNum.keys());

  const unmatchedTsv: QuestionImportMatchReport["unmatchedTsv"] = [];
  for (const slot of slots) {
    const qn = questionNumberFromSlotKey(slot.key);
    if (!qn || !pdfQuestionNums.has(qn)) {
      unmatchedTsv.push({
        question: qn ?? 0,
        part: partKeyFromSlotKey(slot.key),
        answer: slot.acceptedAnswer,
      });
    }
  }

  const incompleteQuestions: QuestionImportMatchReport["incompleteQuestions"] = [];
  for (const row of rows) {
    const qNum =
      row.questionNumber ??
      questionNumberFromId(row.id) ??
      rows.indexOf(row) + 1;
    const parsed = byQuestion.get(qNum);
    if (!parsed) continue;

    if (row.type === "mcq") {
      if (!row.correctAnswer.trim()) {
        incompleteQuestions.push({
          question: qNum,
          missingParts: ["mcq"],
          filledParts: [],
        });
      }
      continue;
    }

    const expected = parsed.parts
      .filter((p) => !STEM_PART_KEYS.has(p.key.trim().toLowerCase()))
      .map((p) => p.key);
    const filled = row.parts
      .filter((p) => p.acceptedAnswer.trim())
      .map((p) => p.key.trim().toLowerCase());
    const missing = expected.filter((k) => !filled.includes(k.toLowerCase()));
    if (missing.length) {
      incompleteQuestions.push({
        question: qNum,
        missingParts: missing,
        filledParts: filled,
      });
    }
  }

  const tsvFilledOnPdf = pdfSkeletonRows.length
    ? rows.filter((row) => {
        const qNum = row.questionNumber ?? questionNumberFromId(row.id);
        return qNum != null && matchedQuestionNums.has(qNum);
      }).length
    : matchedQuestionNums.size;

  return {
    rows,
    report: {
      tsvRows: slots.length,
      matchedQuestions: matchedQuestionNums.size,
      pdfQuestions: pdfSkeletonRows.length,
      awaitingTsv: Math.max(0, pdfSkeletonRows.length - tsvFilledOnPdf),
      unmatchedTsv,
      incompleteQuestions,
    },
  };
}

export function assignImportFigurePage(
  current: { imageDataUrl?: string; sourceImageDataUrl?: string; crop?: CropRect },
  pageImageDataUrl: string,
  pageNumber: number,
): Pick<
  ExamImportPart,
  "imageDataUrl" | "sourceImageDataUrl" | "imagePageNumber" | "crop" | "cropApplied" | "cropping"
> {
  return {
    imagePageNumber: pageNumber,
    sourceImageDataUrl: pageImageDataUrl,
    imageDataUrl: pageImageDataUrl,
    crop: FULL_CROP,
    cropApplied: false,
    cropping: false,
  };
}

export async function cropImportFigure(
  sourceImageDataUrl: string,
  crop: CropRect,
): Promise<string> {
  return cropImageDataUrl(sourceImageDataUrl, crop);
}

export function applyAnswerTextToRows(
  rows: ExamImportRow[],
  answerText: string,
): ExamImportRow[] {
  const byQuestion = parseAnswerKeyDocument(answerText);
  if (byQuestion.size > 0) {
    return rows.map((row, index) => {
      const qNum =
        row.questionNumber ??
        questionNumberFromId(row.id) ??
        index + 1;
      const parsed = byQuestion.get(qNum);
      if (!parsed) return row;
      return applyParsedToRow(row, parsed);
    });
  }

  const byQuestionBlocks = splitSolutionsByQuestionNumber(answerText);
  const positionalBlocks = [...byQuestionBlocks.entries()].sort((a, b) => a[0] - b[0]);

  return rows.map((row, index) => {
    const qNum =
      row.questionNumber ??
      questionNumberFromId(row.id) ??
      index + 1;
    let block = byQuestionBlocks.get(qNum);
    if (!block && positionalBlocks.length === rows.length) {
      block = positionalBlocks[index]?.[1];
    }
    if (!block?.trim()) return row;

    const parsed = parsePastedAnswers(block);
    return applyParsedToRow(row, parsed);
  });
}

export function applySharedPageCrop(
  rows: ExamImportRow[],
  row: ExamImportRow,
  cropped: string,
  urls?: string[],
): ExamImportRow[] {
  return rows.map((r) => {
    const sharesPageFigure =
      r.pageNumber === row.pageNumber && r.useImage && row.useImage;
    if (!sharesPageFigure && r.id !== row.id) return r;
    const nextUrls = urls ?? r.imageDataUrls;
    return {
      ...r,
      imageDataUrl: cropped,
      ...(nextUrls ? { imageDataUrls: nextUrls } : {}),
      ...(sharesPageFigure && !r.sourceImageDataUrl
        ? { sourceImageDataUrl: row.sourceImageDataUrl ?? row.imageDataUrl }
        : {}),
      crop: FULL_CROP,
      cropping: false,
      cropApplied: true,
    };
  });
}

export async function cropImportRow(
  rows: ExamImportRow[],
  row: ExamImportRow,
  crop: CropRect,
): Promise<ExamImportRow[]> {
  const source = row.sourceImageDataUrl ?? row.imageDataUrl;
  const cropped = await cropImageDataUrl(source, crop);
  const urls = row.imageDataUrls?.length
    ? row.imageDataUrls.map((url, idx) => (idx === 0 ? cropped : url))
    : undefined;
  return applySharedPageCrop(rows, row, cropped, urls);
}

export function importRowToQuestionDraft(
  row: ExamImportRow,
  topic: string,
): QuestionDraft {
  const base = createEmptyQuestionDraft();
  const isMcq = row.type === "mcq" && row.mcqOptions.every((o) => o.trim());
  const multipart = !isMcq && row.parts.length >= 2;
  const stem = normalizeQuestionMathText(stripMainPartPrefix(row.question.trim()));

  let draft: QuestionDraft = {
    ...base,
    type: isMcq ? "mcq" : row.type,
    question: stem || (row.useImage ? "See figure." : ""),
    passage: row.passage?.trim() ?? "",
    topic,
    marks: row.marks,
    imageUrls: row.useImage && row.imageDataUrl ? [row.imageDataUrl] : [],
    options: isMcq ? [...row.mcqOptions] : base.options,
    correctAnswer: row.correctAnswer.trim().toUpperCase().slice(0, 1),
    multipartEnabled: multipart,
    labelDiagramEnabled: false,
    answerParts: multipart
      ? row.parts.map((p, i) => ({
          key: p.key || partLetterForIndex(i),
          label: p.descriptor || `${partLetterForIndex(i)})`,
          placeholder: p.placeholder,
          marks: p.marks,
          acceptedAnswer: p.acceptedAnswer,
          imageUrl: p.imageDataUrl,
        }))
      : base.answerParts,
    acceptedAnswers: multipart
      ? ""
      : row.parts.map((p) => p.acceptedAnswer).filter(Boolean).join("\n"),
  };

  if (row.parts.some((p) => p.acceptedAnswer.trim())) {
    const parsed: ParsedAnswerQuestion = {
      questionNumber: row.questionNumber ?? 1,
      parts: row.parts.map((p, order) => ({
        key: p.key || partLetterForIndex(order),
        label: p.descriptor,
        answer: p.acceptedAnswer,
        order,
      })),
      mcqAnswer: row.correctAnswer || undefined,
    };
    draft = applyParsedAnswerToQuestion(draft, parsed);
  }

  return draft;
}

export function importRowsToQuestionDrafts(
  rows: ExamImportRow[],
  topic: string,
): QuestionDraft[] {
  return rows.filter((r) => r.selected).map((r) => importRowToQuestionDraft(r, topic));
}
