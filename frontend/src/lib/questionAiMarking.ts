import { AI_FETCH_TIMEOUT_MS, apiFetch } from "@/lib/api";
import { API_PATHS } from "@/lib/constants";
import { compressDataUrlIfLarge, prepareHandwritingForMarking } from "@/lib/imageCompressor";
import {
  collectHandwritingImages,
  handwritingAllowedForSubject,
  isHandwritingValue,
} from "@/lib/handwritingMode";
import { isAutoMarkableAnswer } from "@/lib/utils";
import type { AnswerPart, Question } from "@/lib/subjects";

/** Maths subjects: smart marking only for genuinely open-ended long-answer items. */
export const MATHS_SUBJECT_IDS = new Set([
  "methods",
  "general-maths",
  "specialist-maths",
  "demo",
]);

export function isMathsSubject(subjectId?: string): boolean {
  const sid = String(subjectId ?? "").trim().toLowerCase();
  return MATHS_SUBJECT_IDS.has(sid);
}

export function acceptedAnswersNeedAiMarking(acceptedAnswers: string[]): boolean {
  const accepted = acceptedAnswers.map((a) => String(a ?? "").trim()).filter(Boolean);
  if (!accepted.length) return false;
  if (accepted.every((a) => /see marking guide/i.test(a))) return true;
  if (accepted.every((a) => isAutoMarkableAnswer(a))) return false;
  return true;
}

function isLongType(questionType?: Question["type"] | string): boolean {
  const t = String(questionType ?? "");
  return t === "long" || t === "long_answer";
}

/** OpenAI text marking: long-answer questions only (handwriting uses a separate path). */
export function shouldUseAiMarking(input: {
  questionText: string;
  partLabels?: string[];
  acceptedAnswers?: string[];
  questionType?: Question["type"] | string;
  subjectId?: string;
}): boolean {
  const type = input.questionType;
  const accepted = input.acceptedAnswers ?? [];

  if (type === "mcq") return false;
  if (!isLongType(type)) return false;

  if (isMathsSubject(input.subjectId)) {
    return acceptedAnswersNeedAiMarking(accepted);
  }
  return true;
}

/** Diagram-label slots use exact matching — not OpenAI. */
export function shouldUseAiForFigureLabels(_parts?: AnswerPart[]): boolean {
  return false;
}

/** Admin toggle wins when set; otherwise infer from stem / answers / type. */
export function resolveAiMarking(input: {
  useAiMarking?: boolean | null;
  questionText: string;
  partLabels?: string[];
  acceptedAnswers?: string[];
  questionType?: Question["type"] | string;
  subjectId?: string;
}): boolean {
  if (input.useAiMarking === false) return false;
  if (!isLongType(input.questionType)) return false;
  if (input.useAiMarking === true) return true;
  return shouldUseAiMarking(input);
}

export function inferUseAiMarkingForImport(input: {
  type: string;
  questionText: string;
  partLabels?: string[];
  acceptedAnswers?: string[];
  subjectId?: string;
}): boolean {
  if (input.type === "mcq") return false;
  return shouldUseAiMarking({
    questionText: input.questionText,
    partLabels: input.partLabels,
    acceptedAnswers: input.acceptedAnswers,
    questionType: input.type === "long_answer" ? "long" : "short",
    subjectId: input.subjectId,
  });
}

import type { AiMarkPartResult } from "@/components/quiz/AiMarkingFeedbackPanel";
import { handwritingMarkUserError, sanitizeUserFacingError } from "@/lib/userFacingErrors";

export type SmartMarkResult = {
  correct: boolean;
  scorePercent: number;
  feedback: string;
  correctAnswers?: string[];
  partResults?: AiMarkPartResult[];
};

export type SmartMarkQuestionPayload = {
  type: string;
  question: string;
  topic?: string;
  marks: number;
  guidance?: string;
  acceptedAnswers?: string[];
  answerParts?: Array<{
    key?: string;
    label: string;
    marks?: number;
    acceptedAnswer?: string;
  }>;
};

export async function requestSmartMark(
  subjectId: string,
  questionKey: string,
  input: {
    responseText?: string;
    responseImages?: string[];
    studentParts?: string[];
    question: SmartMarkQuestionPayload;
  },
): Promise<SmartMarkResult | null> {
  try {
    const handwritingImages = (input.responseImages ?? []).filter(isHandwritingValue);
    const compressedImages = handwritingImages.length
      ? await Promise.all(
          handwritingImages.map((img) => prepareHandwritingForMarking(img)),
        )
      : undefined;
    const responseText =
      input.responseText && !isHandwritingValue(input.responseText)
        ? input.responseText
        : undefined;
    const studentParts = input.studentParts
      ?.map((part) => String(part ?? "").trim())
      .filter((part) => part.length > 0);

    const ai = await apiFetch<{
      mark: SmartMarkResult;
    }>(API_PATHS.written.mark(subjectId, questionKey), {
      method: "POST",
      timeoutMs: AI_FETCH_TIMEOUT_MS,
      body: JSON.stringify({
        responseText,
        responseImages: compressedImages,
        studentParts,
        question: input.question,
      }),
    });
    return ai?.mark ?? null;
  } catch (err) {
    throw new Error(
      sanitizeUserFacingError(
        err instanceof Error ? err.message : err,
        "Could not mark your answer. Try again.",
      ),
    );
  }
}

export async function requestHandwritingMark(
  subjectId: string,
  questionKey: string,
  input: {
    answer: string;
    parts: string[];
    isMultipart: boolean;
    question: SmartMarkQuestionPayload;
  },
): Promise<SmartMarkResult | null> {
  if (!handwritingAllowedForSubject(subjectId)) return null;
  const images = collectHandwritingImages(input.answer, input.parts, input.isMultipart);
  if (!images.length) return null;
  try {
    return await requestSmartMark(subjectId, questionKey, {
      responseImages: images,
      question: input.question,
    });
  } catch (err) {
    throw new Error(handwritingMarkUserError(err instanceof Error ? err.message : err));
  }
}

/** Prepend what we read from the drawing when the model returns it. */
function enrichPartWithInterpretation(part: AiMarkPartResult): AiMarkPartResult {
  const read = String(part.studentAnswerRead ?? "").trim();
  const fb = String(part.partFeedback ?? "").trim();
  if (!read) return part;
  const line = `• We read your drawing as: ${read}`;
  if (fb.includes(read)) return part;
  return { ...part, partFeedback: fb ? `${line}\n${fb}` : line };
}

/** Fill in correct answers / feedback when the model omits them. */
export function enrichHandwritingMarkResult(
  ai: SmartMarkResult,
  expectedAnswers: string[],
): SmartMarkResult {
  const answers = expectedAnswers.map((a) => String(a ?? "").trim()).filter(Boolean);
  let enriched: SmartMarkResult = { ...ai };

  if (!ai.correct && !ai.correctAnswers?.length && answers.length) {
    enriched = { ...enriched, correctAnswers: answers };
  }

  if (answers.length) {
    if (enriched.partResults?.length) {
      enriched = {
        ...enriched,
        partResults: enriched.partResults.map((p, idx) =>
          enrichPartWithInterpretation({
            ...p,
            correctAnswer: p.correctAnswer ?? answers[p.index ?? idx],
          }),
        ),
      };
    } else if (!ai.correct && answers.length > 1) {
      enriched = {
        ...enriched,
        partResults: answers.map((ans, index) => ({
          index,
          correct: false,
          marksAwarded: 0,
          correctAnswer: ans,
        })),
      };
    }
    // Ensure every multipart slot has a partResults row for inline UI.
    if (answers.length > 1 && enriched.partResults?.length) {
      const byIndex = new Map(enriched.partResults.map((p) => [p.index, p]));
      enriched = {
        ...enriched,
        partResults: answers.map((ans, index) => {
          const existing = byIndex.get(index);
          if (existing) return existing;
          return {
            index,
            correct: Boolean(ai.correct),
            marksAwarded: 0,
            correctAnswer: ans,
            partFeedback: ai.correct
              ? "• Your working and answer look correct."
              : undefined,
          };
        }),
      };
    }
  }

  if (!String(enriched.feedback ?? "").trim() && !ai.correct) {
    const ans = enriched.correctAnswers ?? answers;
    enriched = {
      ...enriched,
      feedback: ans.length
        ? `• Incorrect.\n• Correct answer: ${ans.join("; ")}`
        : `• Incorrect. Review the model solution.`,
    };
  }

  return enriched;
}

export function buildFallbackHandwritingMark(
  expectedAnswers: string[],
): SmartMarkResult {
  const answers = expectedAnswers.map((a) => String(a ?? "").trim()).filter(Boolean);
  return {
    correct: false,
    scorePercent: 0,
    feedback: answers.length
      ? `• Could not read your drawing right now.\n• Correct answer: ${answers.join("; ")}`
      : `• Could not read your drawing. Try again.`,
    correctAnswers: answers.length ? answers : undefined,
    partResults: answers.map((ans, index) => ({
      index,
      correct: false,
      marksAwarded: 0,
      correctAnswer: ans,
      partFeedback: `• Could not read your drawing right now.\n• Model answer for this part: ${ans}`,
    })),
  };
}

export function partMarkAt(
  ai: SmartMarkResult | null | undefined,
  index: number,
): AiMarkPartResult | undefined {
  return ai?.partResults?.find((p) => p.index === index);
}

export function buildSmartMarkPayload(
  question: {
    type?: Question["type"] | string;
    question: string;
    topic?: string;
    marks?: number;
    guidance?: string;
    acceptedAnswers?: string[];
    answerParts?: AnswerPart[];
  },
  options: {
    marks: number;
    partDescriptors?: string[];
    partMarks?: number[];
    expectedAnswers?: string[];
    configuredParts?: AnswerPart[];
  },
): SmartMarkQuestionPayload {
  const { marks, partMarks = [], expectedAnswers = [], configuredParts = [] } = options;
  return {
    type: question.type === "long" ? "long_answer" : "short_answer",
    question: question.question,
    topic: question.topic,
    marks,
    guidance: question.guidance,
    acceptedAnswers: [
      ...(Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers : []),
    ].filter(Boolean),
    answerParts:
      configuredParts.length >= 2
        ? configuredParts.map((p, idx) => ({
            key: p.key,
            label: p.label,
            marks: partMarks[idx] ?? p.marks,
            acceptedAnswer: expectedAnswers[idx],
          }))
        : undefined,
  };
}
