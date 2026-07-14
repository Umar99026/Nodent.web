import { useEffect, useMemo, useState } from "react";
import { AI_FETCH_TIMEOUT_MS, apiFetch } from "@/lib/api";
import { API_PATHS } from "@/lib/constants";
import type { MarkBreakdown, MarkStepResult } from "@/lib/markBreakdown";
import type { Question } from "@/lib/subjects";
import { buildWorkedSolutionSteps } from "@/lib/wrongAnswerFeedback";

type WorkedSolutionResponse = {
  markBreakdown?: MarkBreakdown;
};

const memoryCache = new Map<string, MarkStepResult[]>();
const inFlightRequests = new Map<string, Promise<{ breakdown: MarkBreakdown; steps: MarkStepResult[] }>>();

function cacheKey(subjectId: string, questionKey: string): string {
  return `nodent_worked_solution:${subjectId}:${questionKey}`;
}

function textFingerprint(text: string): string {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function readCached(key: string): MarkStepResult[] {
  const memory = memoryCache.get(key);
  if (memory?.length) return memory;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as MarkBreakdown;
    const steps = buildWorkedSolutionSteps(parsed);
    if (steps.length) memoryCache.set(key, steps);
    return steps;
  } catch {
    return [];
  }
}

function writeCached(key: string, breakdown: MarkBreakdown, steps: MarkStepResult[]): void {
  memoryCache.set(key, steps);
  try {
    sessionStorage.setItem(key, JSON.stringify(breakdown));
  } catch {
    // Session cache is optional.
  }
}

function questionPayload(question: Question): Record<string, unknown> {
  const acceptedAnswers =
    question.type === "mcq"
      ? [question.answer]
      : question.type === "short"
        ? question.acceptedAnswers
        : question.acceptedAnswers ?? (question.answer ? [question.answer] : []);
  return {
    id: question.id,
    type: question.type,
    question: question.question,
    passage: question.passage,
    topic: question.topic,
    marks: question.marks,
    guidance: question.guidance,
    options: question.type === "mcq" ? question.options : undefined,
    answer: question.type === "mcq" ? question.answer : undefined,
    acceptedAnswers,
    answerParts: question.answerParts,
  };
}

function requestWorkedSolution(
  key: string,
  subjectId: string,
  questionKey: string,
  question: Question,
): Promise<{ breakdown: MarkBreakdown; steps: MarkStepResult[] }> {
  const existing = inFlightRequests.get(key);
  if (existing) return existing;
  const request = apiFetch<WorkedSolutionResponse>(
    API_PATHS.written.solution(subjectId, questionKey),
    {
      method: "POST",
      timeoutMs: AI_FETCH_TIMEOUT_MS,
      body: JSON.stringify({ question: questionPayload(question) }),
    },
  ).then((result) => {
    const breakdown = result.markBreakdown;
    const steps = buildWorkedSolutionSteps(breakdown);
    if (!breakdown || !steps.length) throw new Error("The worked solution was empty.");
    writeCached(key, breakdown, steps);
    return { breakdown, steps };
  }).finally(() => inFlightRequests.delete(key));
  inFlightRequests.set(key, request);
  return request;
}

export function useWorkedSolution(input: {
  question: Question;
  subjectId?: string;
  questionKey?: string;
  enabled: boolean;
}) {
  const { question, enabled } = input;
  const subjectId = String(input.subjectId ?? "").trim() || "practice";
  const questionKey =
    String(input.questionKey ?? "").trim() || `question_${textFingerprint(question.question)}`;
  const authoredSteps = useMemo(
    () => buildWorkedSolutionSteps(question.markBreakdown, question.guidance),
    [question.markBreakdown, question.guidance],
  );
  const key = cacheKey(subjectId, questionKey);
  const cachedSteps = useMemo(() => (key ? readCached(key) : []), [key]);
  const [generated, setGenerated] = useState<{ key: string; steps: MarkStepResult[] }>({
    key: "",
    steps: [],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authoredSteps.length || !enabled) return;
    if (cachedSteps.length) return;

    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const { steps } = await requestWorkedSolution(key, subjectId, questionKey, question);
        if (!cancelled) {
          setGenerated({ key, steps });
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not generate worked steps.");
        }
      }
    };
    void load().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [authoredSteps.length, cachedSteps.length, enabled, key, question, questionKey, subjectId]);

  const generatedSteps = generated.key === key ? generated.steps : [];

  return {
    steps: authoredSteps.length
      ? authoredSteps
      : cachedSteps.length
        ? cachedSteps
        : generatedSteps,
    loading: !authoredSteps.length && loading,
    error,
  };
}
