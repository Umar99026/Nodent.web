import { apiFetchAdmin } from "@/lib/api";
import { API_PATHS, STORAGE_KEYS } from "@/lib/constants";
import {
  buildAnswerPartsPayload,
  emptyMultipartParts,
  type MultipartPartDraft,
} from "@/components/admin/MultipartAnswerPartsEditor";
import {
  compressFigureDataUrl,
  DB_SAFE_DATA_URL_CHARS,
} from "@/lib/imageCompressor";
import { refreshQuestionBankAfterSave } from "@/lib/adminQuestionSave";
import { inferUseAiMarkingForImport } from "@/lib/questionAiMarking";
import { partHasOverlay, flattenPartAcceptedAnswers, marksFromParts, partUsesFigureLabels, partUsesInlineInputs, inlineInputsForPart } from "@/lib/diagramLabels";
import { normalizeAcceptedAnswerForStorage } from "@/lib/utils";

export type QuestionDraftType = "mcq" | "short_answer" | "long_answer";

export type QuestionDraft = {
  id: string;
  type: QuestionDraftType;
  question: string;
  passage: string;
  topic: string;
  marks: number;
  imageUrls: string[];
  options: string[];
  correctAnswer: string;
  acceptedAnswers: string;
  multipartEnabled: boolean;
  /** Input boxes overlaid on the diagram image (label tables, diagrams, etc.). */
  labelDiagramEnabled: boolean;
  answerParts: MultipartPartDraft[];
  guidance: string;
};

export type AssessmentDraft = {
  id: string;
  title: string;
  subjectId: string;
  topic: string;
  sharedPassage: string;
  groupId: string;
  questions: QuestionDraft[];
  /** UI-only label; the PDF is not persisted in the draft. */
  pdfFileName?: string;
  updatedAt: string;
};

function newId(): string {
  return crypto.randomUUID();
}

export function createEmptyQuestionDraft(): QuestionDraft {
  return {
    id: newId(),
    type: "mcq",
    question: "",
    passage: "",
    topic: "",
    marks: 1,
    imageUrls: [],
    options: ["", "", "", ""],
    correctAnswer: "",
    acceptedAnswers: "",
    multipartEnabled: false,
    labelDiagramEnabled: false,
    answerParts: emptyMultipartParts(2),
    guidance: "",
  };
}

export function createEmptyAssessmentDraft(): AssessmentDraft {
  return {
    id: newId(),
    title: "Untitled assessment",
    subjectId: "demo",
    topic: "General",
    sharedPassage: "",
    groupId: `assessment-${Date.now()}`,
    questions: [],
    updatedAt: new Date().toISOString(),
  };
}

/** Blank manual editor — never restored from localStorage. */
export function createManualDraftTemplate(subjectId = "demo"): AssessmentDraft {
  return {
    ...createEmptyAssessmentDraft(),
    subjectId,
  };
}

export type CreatePagePrefs = {
  subjectId: string;
};

/** Only subject is remembered. Manual questions/intro are never persisted. */
export function loadCreatePagePrefs(): CreatePagePrefs {
  const defaults: CreatePagePrefs = { subjectId: "demo" };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.createDraft);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<AssessmentDraft & CreatePagePrefs>;
    const prefs: CreatePagePrefs = {
      subjectId:
        typeof parsed.subjectId === "string" && parsed.subjectId.trim()
          ? parsed.subjectId
          : defaults.subjectId,
    };
    // Overwrite legacy blobs that stored full exam text / questions.
    saveCreatePagePrefs(prefs);
    return prefs;
  } catch {
    saveCreatePagePrefs(defaults);
    return defaults;
  }
}

export function saveCreatePagePrefs(prefs: CreatePagePrefs): void {
  try {
    localStorage.setItem(STORAGE_KEYS.createDraft, JSON.stringify(prefs));
  } catch {
    // ignore quota errors for tiny prefs blob
  }
}

export function clearAssessmentDraft(subjectId = "demo"): AssessmentDraft {
  return createManualDraftTemplate(subjectId);
}

export function questionDraftMarks(q: QuestionDraft): number {
  if (
    ((q.type === "long_answer" || q.type === "short_answer") && q.multipartEnabled) ||
    q.labelDiagramEnabled
  ) {
    if (q.answerParts.length) {
      return marksFromParts(q.answerParts);
    }
  }
  return q.marks;
}

export function assessmentTotalMarks(draft: AssessmentDraft): number {
  return draft.questions.reduce((sum, q) => sum + questionDraftMarks(q), 0);
}

function isDataUrl(url: string): boolean {
  return /^data:/i.test(url.trim());
}

async function safeCompressDataUrl(url: string): Promise<string> {
  if (!isDataUrl(url)) return url;
  if (url.length <= DB_SAFE_DATA_URL_CHARS) return url;
  return compressFigureDataUrl(url);
}

/** Shrink embedded page images so publish payloads stay under API limits. */
async function compressQuestionDraft(q: QuestionDraft): Promise<QuestionDraft> {
  const imageUrls = q.imageUrls.length
    ? await Promise.all(q.imageUrls.map((u) => safeCompressDataUrl(u)))
    : q.imageUrls;

  const answerParts = q.answerParts.length
    ? await Promise.all(
        q.answerParts.map(async (part) => ({
          ...part,
          imageUrl:
            part.imageUrl && isDataUrl(part.imageUrl)
              ? await safeCompressDataUrl(part.imageUrl)
              : part.imageUrl,
        })),
      )
    : q.answerParts;

  return { ...q, imageUrls, answerParts };
}

export type PublishValidationError = { questionIndex: number; message: string };

export function validateAssessmentDraft(draft: AssessmentDraft): PublishValidationError[] {
  const errors: PublishValidationError[] = [];

  if (!draft.subjectId.trim()) {
    errors.push({ questionIndex: -1, message: "Select a subject." });
  }
  if (!draft.questions.length) {
    errors.push({ questionIndex: -1, message: "Add at least one question." });
  }

  draft.questions.forEach((q, i) => {
    const hasPassage =
      Boolean(q.passage.trim()) || Boolean(draft.sharedPassage.trim());
    const hasImages = q.imageUrls.length > 0;
    const validParts = q.answerParts.filter((p) => p.label.trim());
    const hasMultipart =
      (q.type === "long_answer" || q.type === "short_answer") &&
      q.multipartEnabled &&
      validParts.length >= 2;
    const hasLegacyDiagramLabels =
      q.labelDiagramEnabled &&
      q.imageUrls.length > 0 &&
      validParts.length >= 1 &&
      validParts.every((p) => partHasOverlay(p));

    if (!q.question.trim() && !hasPassage && !hasImages && !hasMultipart && !hasLegacyDiagramLabels) {
      errors.push({
        questionIndex: i,
        message: "Add question text, a passage, images, or answer parts.",
      });
      return;
    }

    if (q.type === "mcq") {
      if (q.options.some((o) => !o.trim())) {
        errors.push({ questionIndex: i, message: "All four MCQ options are required." });
      }
      if (!q.correctAnswer) {
        errors.push({ questionIndex: i, message: "Select the correct MCQ answer." });
      }
    }

    if (q.type === "short_answer" && !q.multipartEnabled) {
      const answers = q.acceptedAnswers
        .split("\n")
        .map((a) => a.trim())
        .filter(Boolean);
      if (!answers.length) {
        errors.push({ questionIndex: i, message: "At least one accepted answer is required." });
      }
    }

    if (q.type === "long_answer" && !q.multipartEnabled) {
      const answers = q.acceptedAnswers
        .split("\n")
        .map((a) => a.trim())
        .filter(Boolean);
      if (!answers.length) {
        errors.push({ questionIndex: i, message: "At least one accepted answer is required." });
      }
    }

    if (q.labelDiagramEnabled) {
      if (!q.imageUrls[0]?.trim()) {
        errors.push({ questionIndex: i, message: "Upload a diagram image to label." });
      }
      if (validParts.length < 1) {
        errors.push({ questionIndex: i, message: "Add at least one label on the diagram." });
      } else if (!validParts.every((p) => partHasOverlay(p))) {
        errors.push({ questionIndex: i, message: "Each label must be placed on the diagram." });
      } else if (validParts.some((p) => !(p.acceptedAnswer ?? "").trim())) {
        errors.push({
          questionIndex: i,
          message: "Each diagram label needs a correct answer.",
        });
      }
    } else if (q.multipartEnabled && (q.type === "short_answer" || q.type === "long_answer")) {
      if (validParts.length < 2) {
        errors.push({
          questionIndex: i,
          message: "Add at least two answer parts (use “Add part” for more).",
        });
      } else {
        for (const part of q.answerParts) {
          if (partUsesInlineInputs(part)) {
            const boxes = inlineInputsForPart(part);
            if (!boxes.length) {
              errors.push({
                questionIndex: i,
                message: "Each part with input boxes needs at least one box.",
              });
              break;
            }
            if (boxes.some((box) => !(box.acceptedAnswer ?? "").trim())) {
              errors.push({
                questionIndex: i,
                message: "Each input box needs a correct answer.",
              });
              break;
            }
          } else if (partUsesFigureLabels(part)) {
            if (!part.labelOverlays?.every((overlay) => partHasOverlay(overlay))) {
              errors.push({
                questionIndex: i,
                message: "Each input box on a part figure must be placed on the image.",
              });
              break;
            }
            if (part.labelOverlays.some((overlay) => !(overlay.acceptedAnswer ?? "").trim())) {
              errors.push({
                questionIndex: i,
                message: "Each input box on a part figure needs a correct answer.",
              });
              break;
            }
          } else if (!(part.acceptedAnswer ?? "").trim()) {
            errors.push({
              questionIndex: i,
              message: "Each part needs an accepted answer for auto-marking.",
            });
            break;
          }
        }
      }
    }
  });

  return errors;
}

function normalizeAnswerPartsForStorage(parts: MultipartPartDraft[]): MultipartPartDraft[] {
  return parts.map((part) => ({
    ...part,
    acceptedAnswer: normalizeAcceptedAnswerForStorage(part.acceptedAnswer ?? ""),
    inlineInputs: part.inlineInputs?.map((box) => ({
      ...box,
      acceptedAnswer: normalizeAcceptedAnswerForStorage(box.acceptedAnswer ?? ""),
    })),
    labelOverlays: part.labelOverlays?.map((overlay) => ({
      ...overlay,
      acceptedAnswer: normalizeAcceptedAnswerForStorage(overlay.acceptedAnswer ?? ""),
    })),
  }));
}

function normalizeAcceptedList(answers: string[]): string[] {
  return answers.map(normalizeAcceptedAnswerForStorage).filter(Boolean);
}

function attachUseAiMarking(
  body: Record<string, unknown>,
  draft: AssessmentDraft,
  q: QuestionDraft,
): void {
  if (q.type === "mcq") return;
  if (q.answerParts.some((part) => partUsesInlineInputs(part))) {
    body.useAiMarking = false;
    return;
  }
  const accepted =
    q.multipartEnabled || q.labelDiagramEnabled
      ? flattenPartAcceptedAnswers(q.answerParts)
      : q.acceptedAnswers
          .split("\n")
          .map((a) => a.trim())
          .filter(Boolean);
  body.useAiMarking = inferUseAiMarkingForImport({
    type: q.type,
    questionText: [q.question, q.passage, draft.sharedPassage].filter(Boolean).join("\n"),
    partLabels: q.answerParts.map((p) => p.label),
    acceptedAnswers: accepted,
    subjectId: draft.subjectId,
  });
}

function buildQuestionPayload(
  draft: AssessmentDraft,
  q: QuestionDraft,
  options?: { omitGroupId?: boolean },
): Record<string, unknown> {
  const topic = (q.topic.trim() || draft.topic.trim() || "General").slice(0, 120);
  const passage =
    q.passage.trim() ||
    draft.sharedPassage.trim() ||
    undefined;

  const body: Record<string, unknown> = {
    subjectId: draft.subjectId,
    type: q.type,
    question: q.question.trim() || (q.multipartEnabled ? "See figure." : ""),
    topic,
  };

  if (!options?.omitGroupId && draft.groupId.trim()) {
    body.groupId = draft.groupId;
  }

  if (passage) body.passage = passage;
  if (q.imageUrls.length) body.imageUrls = q.imageUrls;

  if (q.type === "mcq") {
    body.options = q.options.map((o) => o.trim());
    body.correctAnswer = q.correctAnswer;
    body.marks = q.marks;
    return body;
  }

  attachUseAiMarking(body, draft, q);

  if (q.type === "short_answer") {
    if (q.labelDiagramEnabled || q.multipartEnabled) {
      const answerParts = normalizeAnswerPartsForStorage(q.answerParts);
      const payloadParts = buildAnswerPartsPayload(answerParts);
      body.answerParts = payloadParts;
      body.acceptedAnswers = normalizeAcceptedList(flattenPartAcceptedAnswers(answerParts));
      body.marks = marksFromParts(answerParts) || q.marks;
      return body;
    }
    body.acceptedAnswers = normalizeAcceptedList(
      q.acceptedAnswers
        .split("\n")
        .map((a) => a.trim())
        .filter(Boolean),
    );
    body.marks = q.marks;
    return body;
  }

  if (q.guidance.trim()) body.guidance = q.guidance.trim();

  if (q.labelDiagramEnabled || q.multipartEnabled) {
    const answerParts = normalizeAnswerPartsForStorage(q.answerParts);
    const payloadParts = buildAnswerPartsPayload(answerParts);
    body.answerParts = payloadParts;
    body.acceptedAnswers = normalizeAcceptedList(flattenPartAcceptedAnswers(answerParts));
    body.marks = marksFromParts(answerParts) || q.marks;
    return body;
  }

  body.acceptedAnswers = normalizeAcceptedList(
    q.acceptedAnswers
      .split("\n")
      .map((a) => a.trim())
      .filter(Boolean),
  );
  body.marks = q.marks;
  return body;
}

export type PublishResult = {
  imported: number;
  skipped: number;
  errors: { index: number; message: string }[];
};

export async function publishAssessmentDraft(
  draft: AssessmentDraft,
): Promise<PublishResult> {
  const compressedQuestions = await Promise.all(
    draft.questions.map((q) => compressQuestionDraft(q)),
  );

  const rows = compressedQuestions.map((q) =>
    buildQuestionPayload(draft, q),
  );

  const result = await apiFetchAdmin<PublishResult & { ok?: boolean }>(
    API_PATHS.admin.questionsBulk,
    {
      method: "POST",
      body: JSON.stringify({ questions: rows }),
    },
  );

  await refreshQuestionBankAfterSave();

  return {
    imported: result.imported ?? 0,
    skipped: result.skipped ?? 0,
    errors: result.errors ?? [],
  };
}

/** Import parsed PDF questions into the practice bank — one row per question, no exam grouping. */
export async function publishQuestionDraftsToPracticeBank(
  subjectId: string,
  defaultTopic: string,
  questions: QuestionDraft[],
): Promise<PublishResult> {
  if (!subjectId.trim()) {
    return { imported: 0, skipped: 0, errors: [{ index: -1, message: "Select a subject." }] };
  }
  if (!questions.length) {
    return { imported: 0, skipped: 0, errors: [{ index: -1, message: "Select at least one question." }] };
  }

  const draftStub: AssessmentDraft = {
    ...createEmptyAssessmentDraft(),
    subjectId: subjectId.trim(),
    topic: defaultTopic.trim() || "General",
  };

  const compressed = await Promise.all(questions.map((q) => compressQuestionDraft(q)));
  const CHUNK = 2;
  let imported = 0;
  let skipped = 0;
  const errors: { index: number; message: string }[] = [];

  for (let start = 0; start < compressed.length; start += CHUNK) {
    const chunk = compressed.slice(start, start + CHUNK);
    const rows = chunk.map((q) => buildQuestionPayload(draftStub, q, { omitGroupId: true }));

    try {
      const result = await apiFetchAdmin<PublishResult & { ok?: boolean }>(
        API_PATHS.admin.questionsBulk,
        {
          method: "POST",
          body: JSON.stringify({ questions: rows }),
        },
      );
      imported += result.imported ?? 0;
      skipped += result.skipped ?? 0;
      for (const err of result.errors ?? []) {
        errors.push({ index: start + err.index, message: err.message });
      }
    } catch (e) {
      errors.push({
        index: start,
        message: e instanceof Error ? e.message : "Import failed.",
      });
    }
  }

  if (imported > 0) {
    await refreshQuestionBankAfterSave();
  }

  return { imported, skipped, errors };
}

export const QUESTION_TYPE_LABELS: Record<QuestionDraftType, string> = {
  mcq: "Multiple choice",
  short_answer: "Short answer",
  long_answer: "Long answer",
};
