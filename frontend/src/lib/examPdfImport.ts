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
import {
  normalizeMcqOptions,
  partLetterForIndex,
  stripMainPartPrefix,
} from "@/lib/questionDisplay";
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
  if (q.detectedParts && q.detectedParts.length >= 2) {
    return q.detectedParts.map((p, index) => ({
      key: partLetterForIndex(index),
      label: partLetterForIndex(index),
      descriptor: p.descriptor.trim(),
      placeholder: "Type your answer…",
      acceptedAnswer: "",
      marks: p.marks && p.marks > 0 ? p.marks : 1,
      imageDataUrl: p.imageDataUrl,
    }));
  }
  return [defaultPart(0)];
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

  return {
    id: q.id,
    selected: true,
    questionNumber: questionNumberFromId(q.id),
    pageNumber: q.pageNumber,
    pageNumbers: q.pageNumbers,
    question: mcq.question,
    marks:
      mcq.type === "mcq"
        ? 1
        : parts.length >= 2
          ? totalMarksForRow(parts, q.marks ?? 1)
          : Math.max(1, q.marks ?? 1),
    type: mcq.type,
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
  },
): Promise<{ rows: ExamImportRow[]; errors: string[]; source: "nodent" | "generic" }> {
  const isNodent = await quickDetectNodentPdf(file);
  if (isNodent) {
    const { questions, errors } = await parseNodentPdfToQuestions(file, {
      onProgress: options?.onProgress,
    });
    return { rows: questions.map(nodentToRow), errors, source: "nodent" };
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

function applyParsedToRow(row: ExamImportRow, parsed: ParsedAnswerQuestion): ExamImportRow {
  if (row.type === "mcq") {
    const letter = parsed.mcqAnswer?.trim().toUpperCase();
    if (letter && /^[A-D]$/.test(letter)) {
      return { ...row, correctAnswer: letter };
    }
    const first = parsed.parts[0]?.answer?.trim().toUpperCase();
    if (first && /^[A-D]$/.test(first)) {
      return { ...row, correctAnswer: first };
    }
    return row;
  }

  if (!parsed.parts.length) return row;

  let parts = row.parts.length ? [...row.parts] : [defaultPart(0)];
  while (parts.length < parsed.parts.length) {
    const parsedPart = parsed.parts[parts.length];
    const letter = partLetterForIndex(parts.length);
    parts.push({
      ...defaultPart(parts.length),
      key: letter,
      label: letter,
      descriptor: parsedPart?.label?.trim() || "",
    });
  }

  const updated = parts.map((part, index) => {
    const answer = trimAcceptedAnswer(parsed.parts[index]?.answer);
    const parsedLabel = parsed.parts[index]?.label?.trim();
    return {
      ...part,
      acceptedAnswer: answer || part.acceptedAnswer,
      descriptor:
        part.descriptor?.trim() ||
        (parsedLabel && !/^[a-z][.)]?\s*$/i.test(parsedLabel) ? parsedLabel : part.descriptor),
    };
  });

  return {
    ...row,
    parts: updated,
    marks:
      updated.length >= 2 ? totalMarksForRow(updated, row.marks) : Math.max(1, row.marks),
  };
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
