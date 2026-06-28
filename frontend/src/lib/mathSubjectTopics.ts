/**
 * Google Sheets `topic` column: use ONE of these strings per row, exactly as written
 * (same spelling and spacing). The app matches this to filters and analytics.
 *
 * Replace or extend lists when you paste your official topic breakdowns.
 */
import { SPECIALIST_MATHS_TOPICS } from "@/lib/specialistMathsAreaTopic";

export const GOOGLE_SHEETS_TOPIC_LABELS: Record<string, readonly string[]> = {
  methods: [
    "Functions and transformations",
    "Polynomial, power and rational functions",
    "Exponential and logarithmic functions",
    "Circular functions",
    "Algebra and equations",
    "Differential calculus",
    "Applications of differentiation",
    "Integral calculus",
    "Applications of integration",
    "Discrete random variables",
    "Continuous random variables",
    "The normal distribution",
    "Sampling and sample proportions",
    "Confidence intervals for proportions",
  ],
  "general-maths": [
    "Data analysis",
    "Recursion and financial modelling",
    "Matrices",
    "Networks and decision mathematics",
  ],
  "specialist-maths": [...SPECIALIST_MATHS_TOPICS],
};

/** Demo sandbox uses the same topic taxonomy as General Mathematics. */
export function topicTaxonomySubjectId(subjectId: string): string {
  const sid = String(subjectId ?? "").trim().toLowerCase();
  return sid === "demo" ? "general-maths" : sid;
}
