import { AI_FETCH_TIMEOUT_MS, apiFetch } from "@/lib/api";
import { API_PATHS } from "@/lib/constants";
import { compressDataUrlIfLarge, prepareHandwritingForMarking } from "@/lib/imageCompressor";
import {
  collectHandwritingImages,
  handwritingAllowedForSubject,
  isHandwritingValue,
} from "@/lib/handwritingMode";
import type { AnswerPart, Question } from "@/lib/subjects";
import {
  qualifiesForOpenAiHandwriting,
  qualifiesForOpenAiMarking,
} from "@/lib/wordedQuestion";

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

export { acceptedAnswersNeedAiMarking, qualifiesForOpenAiHandwriting } from "@/lib/wordedQuestion";

function isLongType(questionType?: Question["type"] | string): boolean {
  const t = String(questionType ?? "");
  return t === "long" || t === "long_answer";
}

/** OpenAI text marking: long worded questions only (explain / discuss / prove / similar). */
export function shouldUseAiMarking(input: {
  questionText: string;
  partLabels?: string[];
  acceptedAnswers?: string[];
  questionType?: Question["type"] | string;
  subjectId?: string;
}): boolean {
  void input.subjectId;
  return qualifiesForOpenAiMarking({
    questionText: input.questionText,
    questionType: input.questionType,
    partLabels: input.partLabels,
    acceptedAnswers: input.acceptedAnswers,
  });
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
import type { MarkBreakdown, MarkStepResult } from "@/lib/markBreakdown";
import { handwritingMarkUserError, sanitizeUserFacingError } from "@/lib/userFacingErrors";
import { isDemoMathsSubject } from "@/lib/handwritingMode";
import {
  buildWrongAnswerBullets,
  bulletsToFeedbackText,
} from "@/lib/wrongAnswerFeedback";
import { normalizeFeedbackMathText } from "@/lib/questionMathText";

export type SmartMarkResult = {
  correct: boolean;
  scorePercent: number;
  feedback: string;
  correctAnswers?: string[];
  partResults?: AiMarkPartResult[];
  stepResults?: MarkStepResult[];
  marksAwarded?: number;
  maxMarks?: number;
};

export type SmartMarkQuestionPayload = {
  type: string;
  question: string;
  topic?: string;
  marks: number;
  guidance?: string;
  acceptedAnswers?: string[];
  markBreakdown?: MarkBreakdown;
  answerParts?: Array<{
    key?: string;
    label: string;
    marks?: number;
    acceptedAnswer?: string;
  }>;
};

function normalizeSmartMarkFeedback(result: SmartMarkResult): SmartMarkResult {
  return {
    ...result,
    feedback: normalizeFeedbackMathText(result.feedback ?? ""),
    correctAnswers: result.correctAnswers?.map((a) => normalizeFeedbackMathText(a)),
    partResults: result.partResults?.map((p) => ({
      ...p,
      partFeedback: p.partFeedback
        ? normalizeFeedbackMathText(p.partFeedback)
        : p.partFeedback,
      correctAnswer: p.correctAnswer
        ? normalizeFeedbackMathText(p.correctAnswer)
        : p.correctAnswer,
      studentAnswerRead: p.studentAnswerRead
        ? normalizeFeedbackMathText(p.studentAnswerRead)
        : p.studentAnswerRead,
    })),
    stepResults: result.stepResults?.map((s) => ({
      ...s,
      label: normalizeFeedbackMathText(s.label),
      model: s.model ? normalizeFeedbackMathText(s.model) : s.model,
      studentText: s.studentText ? normalizeFeedbackMathText(s.studentText) : s.studentText,
      feedback: s.feedback ? normalizeFeedbackMathText(s.feedback) : s.feedback,
    })),
  };
}

function mapApiMarkToSmartMark(mark: {
  correct?: boolean;
  scorePercent?: number;
  feedback?: string;
  correctAnswers?: string[];
  partResults?: AiMarkPartResult[];
  stepResults?: MarkStepResult[];
  marksAwarded?: number;
  maxMarks?: number;
}): SmartMarkResult {
  return normalizeSmartMarkFeedback({
    correct: Boolean(mark.correct),
    scorePercent: Number(mark.scorePercent ?? 0),
    feedback: String(mark.feedback ?? ""),
    correctAnswers: mark.correctAnswers,
    partResults: mark.partResults,
    stepResults: mark.stepResults,
    marksAwarded: mark.marksAwarded,
    maxMarks: mark.maxMarks,
  });
}

export async function requestSmartMark(
  subjectId: string,
  questionKey: string,
  input: {
    responseText?: string;
    responseImages?: string[];
    studentParts?: string[];
    studentSteps?: string[];
    question: SmartMarkQuestionPayload;
  },
): Promise<SmartMarkResult | null> {
  const q = input.question;
  const handwritingImages = (input.responseImages ?? []).filter(isHandwritingValue);
  const demoHandwritingMark =
    handwritingImages.length > 0 && isDemoMathsSubject(subjectId);
  const breakdownMark =
    (input.studentSteps?.some((s) => String(s ?? "").trim()) ?? false) &&
    Boolean(input.question.markBreakdown?.steps?.length);
  if (
    !qualifiesForOpenAiMarking({
      questionText: q.question,
      questionType: q.type,
      partLabels: q.answerParts?.map((p) => p.label),
      acceptedAnswers: q.acceptedAnswers,
    }) &&
    !demoHandwritingMark &&
    !breakdownMark
  ) {
    return null;
  }

  try {
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
        studentSteps: input.studentSteps,
        markBreakdown: input.question.markBreakdown,
        question: input.question,
      }),
    });
    const mark = ai?.mark ?? null;
    return mark ? mapApiMarkToSmartMark(mark) : null;
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
  if (
    !qualifiesForOpenAiHandwriting({
      questionText: input.question.question,
      partLabels: input.question.answerParts?.map((p) => p.label),
      acceptedAnswers: input.question.acceptedAnswers,
    }) &&
    !isDemoMathsSubject(subjectId)
  ) {
    return null;
  }
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
  return part;
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
        ? bulletsToFeedbackText(
            buildWrongAnswerBullets({
              studentAnswer: "",
              expectedAnswers: ans,
            }),
          )
        : `• Incorrect. Review the model solution and compare each step of your method.`,
    };
  }

  return normalizeSmartMarkFeedback(enriched);
}

/** Add client-side diagnosis when smart-marking feedback is thin. */
export function enrichSmartMarkResult(
  ai: SmartMarkResult,
  input: {
    studentAnswer: string;
    studentParts?: string[];
    expectedAnswers: string[];
    guidance?: string;
    questionText?: string;
  },
): SmartMarkResult {
  if (ai.correct) return ai;

  const answers = input.expectedAnswers.map((a) => String(a ?? "").trim()).filter(Boolean);
  let enriched: SmartMarkResult = { ...ai };

  if (!ai.correctAnswers?.length && answers.length) {
    enriched = { ...enriched, correctAnswers: answers };
  }

  const feedback = String(enriched.feedback ?? "").trim();
  const supplemental = buildWrongAnswerBullets({
    studentAnswer: input.studentAnswer,
    expectedAnswers: answers,
    guidance: input.guidance,
    questionText: input.questionText,
  });
  const supplementalText = bulletsToFeedbackText(supplemental);

  if (!feedback) {
    enriched = { ...enriched, feedback: supplementalText };
  } else if (feedback.length < 160 && supplementalText) {
    enriched = {
      ...enriched,
      feedback: `${feedback}\n${supplementalText}`,
    };
  }

  if (enriched.partResults?.length && input.studentParts?.length) {
    enriched = {
      ...enriched,
      partResults: enriched.partResults.map((part) => {
        if (part.correct) return part;
        const idx = part.index;
        const expected = part.correctAnswer ?? answers[idx];
        const student = String(input.studentParts?.[idx] ?? "").trim();
        const partFb = String(part.partFeedback ?? "").trim();
        const extra = buildWrongAnswerBullets({
          studentAnswer: student,
          expectedAnswers: expected ? [expected] : [],
          guidance: input.guidance,
          questionText: input.questionText,
        });
        const extraText = bulletsToFeedbackText(extra);
        if (!partFb) return { ...part, partFeedback: extraText };
        if (partFb.length < 120 && extraText) {
          return { ...part, partFeedback: `${partFb}\n${extraText}` };
        }
        return part;
      }),
    };
  }

  return normalizeSmartMarkFeedback(enriched);
}

export function buildFallbackHandwritingMark(
  expectedAnswers: string[],
): SmartMarkResult {
  const answers = expectedAnswers.map((a) => String(a ?? "").trim()).filter(Boolean);
  return {
    correct: false,
    scorePercent: 0,
    feedback:
      "• We could not read your drawing clearly — try darker strokes and a larger final answer.\n" +
      (answers.length
        ? `• Model answers: ${answers.join("; ")}`
        : "• Try submitting again after lifting your stylus or finger from the pad."),
    correctAnswers: answers.length ? answers : undefined,
    partResults: answers.map((ans, index) => ({
      index,
      correct: false,
      marksAwarded: 0,
      correctAnswer: ans,
      partFeedback:
        `• We could not read this part clearly — check your strokes are dark enough to scan.\n` +
        `• Model answer for this part: ${ans}`,
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
    markBreakdown?: SmartMarkQuestionPayload["markBreakdown"];
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
    markBreakdown: (question as { markBreakdown?: SmartMarkQuestionPayload["markBreakdown"] })
      .markBreakdown,
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
