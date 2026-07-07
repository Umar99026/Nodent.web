import { apiFetch } from "@/lib/api";
import { API_PATHS } from "@/lib/constants";

export type PremiumUsageQuota = {
  used: number;
  limit: number | null;
  windowDays: number;
};

export type PremiumUsageSummary = {
  isPremium: boolean;
  practiceExams: PremiumUsageQuota;
  proseAiMarks: PremiumUsageQuota;
  handwritingAiMarks: PremiumUsageQuota;
  englishEssays: PremiumUsageQuota;
  questionHelp: { requiresPremium: boolean };
};

export async function fetchPremiumUsage(): Promise<PremiumUsageSummary> {
  return apiFetch<PremiumUsageSummary>(API_PATHS.premium.usage);
}

/** Mirrors backend free-tier defaults (functions/lib/premium.ts). */
export const FREE_DAILY_LONG_ANSWER_LIMIT = 3;
export const FREE_DAILY_DRAWN_WORKING_LIMIT = 3;
export const FREE_ENGLISH_ESSAY_LIMIT = 1;
export const FREE_ENGLISH_ESSAY_WINDOW_DAYS = 3;

export function formatFreePlanSummary(usage: PremiumUsageSummary | null): string {
  const prose = usage?.proseAiMarks.limit ?? FREE_DAILY_LONG_ANSWER_LIMIT;
  const handwriting = usage?.handwritingAiMarks.limit ?? FREE_DAILY_DRAWN_WORKING_LIMIT;
  const essays = usage?.englishEssays.limit ?? FREE_ENGLISH_ESSAY_LIMIT;
  const essayWindow = usage?.englishEssays.windowDays ?? FREE_ENGLISH_ESSAY_WINDOW_DAYS;

  return [
    "Short answers use instant keyword matching.",
    `Free includes ${prose} long-answer mark${prose === 1 ? "" : "s"}/day,`,
    `${essays} English essay every ${essayWindow} days,`,
    `and ${handwriting} drawn-working mark${handwriting === 1 ? "" : "s"}/day.`,
    "No Ask AI.",
  ].join(" ");
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
    id: "practice-exams",
    label: "Past practice exams",
    description: "Full exam papers online",
    free: "Not included",
    premium: "Unlimited",
    freeExcluded: true,
  },
  {
    id: "long-answer-ai",
    label: "Long-answer AI marking",
    description: "Written maths responses",
    free: "3 / day",
    premium: "Unlimited",
  },
  {
    id: "english-essay",
    label: "English essay marking",
    description: "AI feedback on essays",
    free: "1 / 3 days",
    premium: "Unlimited",
  },
  {
    id: "handwriting-ai",
    label: "Drawn working-out marking",
    description: "Handwriting and stylus answers",
    free: "3 / day",
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
