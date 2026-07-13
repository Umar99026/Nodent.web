import { apiFetch } from "@/lib/api";
import { API_PATHS } from "@/lib/constants";

export type PremiumUsageQuota = {
  used: number;
  limit: number | null;
  windowDays: number;
  requiresPremium?: boolean;
};

export type PremiumUsageSummary = {
  isPremium: boolean;
  practiceExams: PremiumUsageQuota;
  /** Shared daily detailed-feedback allowance for typed or drawn answers. */
  aiResponses?: PremiumUsageQuota;
  /** @deprecated Alias of handwritingAiMarks retained for older clients. */
  shortAiMarks: PremiumUsageQuota;
  /** @deprecated Alias of shortAiMarks for older UI. */
  proseAiMarks: PremiumUsageQuota;
  /** @deprecated Alias of aiResponses. */
  handwritingAiMarks: PremiumUsageQuota;
  englishEssays: PremiumUsageQuota;
  longAnswer?: { requiresPremium: boolean };
  questionHelp: { requiresPremium: boolean };
};

/** Mirrors backend free-tier defaults (functions/lib/premium.ts). */
export const FREE_DAILY_AI_RESPONSE_LIMIT = 3;
/** @deprecated Use FREE_DAILY_AI_RESPONSE_LIMIT. */
export const FREE_DAILY_DRAWING_AI_LIMIT = FREE_DAILY_AI_RESPONSE_LIMIT;
/** @deprecated Use FREE_DAILY_DRAWING_AI_LIMIT. */
export const FREE_DAILY_SHORT_AI_LIMIT = FREE_DAILY_DRAWING_AI_LIMIT;
export const FREE_ENGLISH_ESSAY_LIMIT = 1;
export const FREE_ENGLISH_ESSAY_WINDOW_DAYS = 3;

/** @deprecated Long answers are Premium-only. */
export const FREE_DAILY_LONG_ANSWER_LIMIT = 0;
/** @deprecated Drawn LA marking is Premium-only. */
export const FREE_DAILY_DRAWN_WORKING_LIMIT = 0;

export async function fetchPremiumUsage(): Promise<PremiumUsageSummary> {
  const data = await apiFetch<PremiumUsageSummary>(API_PATHS.premium.usage);
  const drawing =
    data.aiResponses ??
    data.handwritingAiMarks ??
    data.shortAiMarks ??
    data.proseAiMarks ?? {
      used: 0,
      limit: FREE_DAILY_DRAWING_AI_LIMIT,
      windowDays: 1,
    };
  return {
    ...data,
    aiResponses: drawing,
    handwritingAiMarks: drawing,
    shortAiMarks: drawing,
    proseAiMarks: drawing,
  };
}

export function freeAiResponsesRemaining(usage: PremiumUsageSummary | null | undefined): number {
  if (usage?.isPremium) return Number.POSITIVE_INFINITY;
  if (!usage) return FREE_DAILY_AI_RESPONSE_LIMIT;
  const q = usage.aiResponses ?? usage.handwritingAiMarks ?? usage.shortAiMarks ?? usage.proseAiMarks;
  const limit = q.limit ?? FREE_DAILY_AI_RESPONSE_LIMIT;
  return Math.max(0, limit - q.used);
}

/** @deprecated Use freeAiResponsesRemaining. */
export function freeDrawingAiRemaining(usage: PremiumUsageSummary | null | undefined): number {
  return freeAiResponsesRemaining(usage);
}

/** @deprecated Use freeDrawingAiRemaining. */
export function freeShortAiRemaining(usage: PremiumUsageSummary | null | undefined): number {
  return freeDrawingAiRemaining(usage);
}

export function formatFreePlanSummary(usage: PremiumUsageSummary | null): string {
  void usage;
  return [
    "Unlimited MCQ and typed short-answer practice.",
    `${FREE_DAILY_AI_RESPONSE_LIMIT} detailed AI responses/day for typed or drawn answers.`,
    "After the AI allowance, typed answers continue with instant matching and basic feedback.",
    "No long-answer practice.",
    `${FREE_ENGLISH_ESSAY_LIMIT} English essay every ${FREE_ENGLISH_ESSAY_WINDOW_DAYS} days.`,
    "No Ask AI · exams not included.",
  ].join(" ");
}

export function formatCompactFreePlanDescription(): string {
  return `${FREE_DAILY_AI_RESPONSE_LIMIT} detailed AI responses/day (typed or drawn) · unlimited typed instant matching afterwards · no long answers · ${FREE_ENGLISH_ESSAY_LIMIT} essay / ${FREE_ENGLISH_ESSAY_WINDOW_DAYS} days · no Ask AI`;
}

export type PremiumFeatureRow = {
  id: string;
  label: string;
  description: string;
  free: string;
  premium: string;
  freeExcluded?: boolean;
};

export const PREMIUM_FEATURE_ROWS: PremiumFeatureRow[] = [
  {
    id: "topic-practice",
    label: "Topic practice",
    description: "MCQ and short-answer by topic",
    free: "Unlimited",
    premium: "Unlimited",
  },
  {
    id: "ai-response-marking",
    label: "Detailed AI feedback",
    description: "AI marks typed answers or scans handwritten answers",
    free: "3 / day",
    premium: "Unlimited",
  },
  {
    id: "typed-answer-match",
    label: "Typed short answers",
    description: "First 3 get detailed AI feedback; then instant matching continues",
    free: "Unlimited",
    premium: "Unlimited",
  },
  {
    id: "long-answer",
    label: "Long-answer questions",
    description: "Full working, mark breakdown, drawn answers",
    free: "Not included",
    premium: "Unlimited",
    freeExcluded: true,
  },
  {
    id: "practice-exams",
    label: "Past practice exams",
    description: "Full exam papers online",
    free: "Not included",
    premium: "Unlimited",
    freeExcluded: true,
  },
  {
    id: "english-essay",
    label: "English essay marking",
    description: "AI feedback on essays",
    free: "1 / 3 days",
    premium: "Unlimited",
  },
  {
    id: "question-help",
    label: "Ask AI",
    description: "AI tutor hints per question",
    free: "Not included",
    premium: "Unlimited",
    freeExcluded: true,
  },
];
