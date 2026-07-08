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
  /** Free: daily short-answer AI marks. Premium: unlimited (limit null). */
  shortAiMarks: PremiumUsageQuota;
  /** @deprecated Alias of shortAiMarks for older UI. */
  proseAiMarks: PremiumUsageQuota;
  handwritingAiMarks: PremiumUsageQuota;
  englishEssays: PremiumUsageQuota;
  longAnswer?: { requiresPremium: boolean };
  questionHelp: { requiresPremium: boolean };
};

/** Mirrors backend free-tier defaults (functions/lib/premium.ts). */
export const FREE_DAILY_SHORT_AI_LIMIT = 3;
export const FREE_ENGLISH_ESSAY_LIMIT = 1;
export const FREE_ENGLISH_ESSAY_WINDOW_DAYS = 3;

/** @deprecated Long answers are Premium-only. */
export const FREE_DAILY_LONG_ANSWER_LIMIT = 0;
/** @deprecated Drawn LA marking is Premium-only. */
export const FREE_DAILY_DRAWN_WORKING_LIMIT = 0;

export async function fetchPremiumUsage(): Promise<PremiumUsageSummary> {
  const data = await apiFetch<PremiumUsageSummary>(API_PATHS.premium.usage);
  const short =
    data.shortAiMarks ??
    data.proseAiMarks ?? {
      used: 0,
      limit: FREE_DAILY_SHORT_AI_LIMIT,
      windowDays: 1,
    };
  return {
    ...data,
    shortAiMarks: short,
    proseAiMarks: data.proseAiMarks ?? short,
  };
}

export function freeShortAiRemaining(usage: PremiumUsageSummary | null | undefined): number {
  if (usage?.isPremium) return Number.POSITIVE_INFINITY;
  if (!usage) return FREE_DAILY_SHORT_AI_LIMIT;
  const q = usage.shortAiMarks ?? usage.proseAiMarks;
  const limit = q.limit ?? FREE_DAILY_SHORT_AI_LIMIT;
  return Math.max(0, limit - q.used);
}

export function formatFreePlanSummary(_usage: PremiumUsageSummary | null): string {
  return [
    `Unlimited MCQ & short answers.`,
    `${FREE_DAILY_SHORT_AI_LIMIT} short-answer AI marks/day, then keyword matching + generic feedback.`,
    "No long-answer practice.",
    `${FREE_ENGLISH_ESSAY_LIMIT} English essay every ${FREE_ENGLISH_ESSAY_WINDOW_DAYS} days.`,
    "No Ask AI · exams not included.",
  ].join(" ");
}

export function formatCompactFreePlanDescription(): string {
  return `${FREE_DAILY_SHORT_AI_LIMIT} SA AI marks/day then match-only · no long answers · ${FREE_ENGLISH_ESSAY_LIMIT} essay / ${FREE_ENGLISH_ESSAY_WINDOW_DAYS} days · no Ask AI`;
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
    id: "short-answer-marking",
    label: "Short-answer AI marking",
    description: "AI feedback on short answers",
    free: "3 / day",
    premium: "Unlimited",
  },
  {
    id: "short-answer-match",
    label: "Short-answer after AI quota",
    description: "Keyword match + generic feedback",
    free: "Unlimited",
    premium: "N/A (AI unlimited)",
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
