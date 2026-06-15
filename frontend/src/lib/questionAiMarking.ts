import { apiFetch } from "@/lib/api";
import { API_PATHS } from "@/lib/constants";
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

/** Strip $...$ for verb detection in maths stems. */
function stripLatexForDetection(text: string): string {
  return String(text ?? "")
    .replace(/\$[^$]*\$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const OPEN_ENDED_STEM_RE =
  /\b(explain|prove|show\s+that|justify|verify|discuss|outline|identify|describe|compare|evaluate|comment|analyse|analyze|deduce|demonstrate|interpret|suggest|account\s+for|give\s+reasons|how\s+does|how\s+do|why\s+does|why\s+do|why\s+is|why\s+are|what\s+evidence|in\s+words|argue|assess|examine|sketch\s+the\s+graph\s+of|state\s+a\s+sequence)\b/i;

export function questionStemNeedsAiMarking(
  questionText: string,
  partLabels: string[] = [],
): boolean {
  const texts = [questionText, ...partLabels].map(stripLatexForDetection).filter(Boolean);
  return texts.some((t) => OPEN_ENDED_STEM_RE.test(t));
}

export function acceptedAnswersNeedAiMarking(acceptedAnswers: string[]): boolean {
  const accepted = acceptedAnswers.map((a) => String(a ?? "").trim()).filter(Boolean);
  if (!accepted.length) return false;
  if (accepted.every((a) => /see marking guide/i.test(a))) return true;
  if (accepted.every((a) => isAutoMarkableAnswer(a))) return false;
  return true;
}

function isShortType(questionType?: Question["type"] | string): boolean {
  const t = String(questionType ?? "");
  return t === "short" || t === "short_answer";
}

function isLongType(questionType?: Question["type"] | string): boolean {
  const t = String(questionType ?? "");
  return t === "long" || t === "long_answer";
}

/** Whether smart marking should run (open-ended stem, prose rubric, or long type). */
export function shouldUseAiMarking(input: {
  questionText: string;
  partLabels?: string[];
  acceptedAnswers?: string[];
  questionType?: Question["type"] | string;
  subjectId?: string;
}): boolean {
  const partLabels = input.partLabels ?? [];
  const type = input.questionType;
  const accepted = input.acceptedAnswers ?? [];

  if (type === "mcq") return false;

  if (isMathsSubject(input.subjectId)) {
    if (isShortType(type)) return false;
    if (!isLongType(type)) return false;
    if (questionStemNeedsAiMarking(input.questionText, partLabels)) return true;
    return acceptedAnswersNeedAiMarking(accepted);
  }

  if (questionStemNeedsAiMarking(input.questionText, partLabels)) return true;
  if (isLongType(type)) return true;
  if (acceptedAnswersNeedAiMarking(accepted)) return true;
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
  const inferred = shouldUseAiMarking(input);
  if (input.useAiMarking === false) return false;
  if (isMathsSubject(input.subjectId)) return inferred;
  if (input.useAiMarking === true) return true;
  return inferred;
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
    responseText: string;
    studentParts?: string[];
    question: SmartMarkQuestionPayload;
  },
): Promise<{
  correct: boolean;
  scorePercent: number;
  feedback: string;
  partResults?: { index: number; correct: boolean }[];
} | null> {
  try {
    const ai = await apiFetch<{
      mark: {
        correct: boolean;
        scorePercent: number;
        feedback: string;
        partResults?: { index: number; correct: boolean }[];
      };
    }>(API_PATHS.written.mark(subjectId, questionKey), {
      method: "POST",
      body: JSON.stringify({
        responseText: input.responseText,
        studentParts: input.studentParts,
        question: input.question,
      }),
    });
    return ai?.mark ?? null;
  } catch {
    return null;
  }
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
