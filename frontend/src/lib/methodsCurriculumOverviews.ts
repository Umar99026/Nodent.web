/**
 * VCE Mathematical Methods Units 3 & 4 — fourteen topic summaries.
 * Markdown for CurriculumOverview / RichQuestionContent (KaTeX via remark-math).
 */

import {
  METHODS_TOPICS,
  type MethodsTopic,
  stripMethodsUnitPrefix,
} from "@/lib/methodsAreaTopic";
import type { Question } from "@/lib/subjects";
import { topicHasQuestionsInBank } from "@/lib/practiceQuestions";
import {
  METHODS_ALGEBRA,
  METHODS_APP_DIFF,
  METHODS_APP_INTEGRAL,
  METHODS_CI_AND_EXAM,
  METHODS_CIRCULAR,
  METHODS_CONTINUOUS,
  METHODS_DIFF_CALC,
  METHODS_DISCRETE,
  METHODS_EXP_LOG,
  METHODS_FUNCTIONS_TRANSFORMATIONS,
  METHODS_INTEGRAL,
  METHODS_NORMAL,
  METHODS_POLYNOMIAL,
  METHODS_SAMPLING,
} from "@/lib/methodsStudyGuideSections";

export { METHODS_TOPICS, type MethodsTopic };
/** @deprecated */
export const METHODS_AREA_OF_STUDY_TOPICS = METHODS_TOPICS;
/** @deprecated */
export type MethodsAreaOfStudyTopic = MethodsTopic;
/** @deprecated */
export const METHODS_STUDY_DESIGN_TOPICS = METHODS_TOPICS;

const norm = (s: string) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const TOPIC_ALIASES: Record<string, MethodsTopic> = {
  "functions, relations and graphs": "Functions and transformations",
  calculus: "Differential calculus",
  "algebra, number and structure": "Algebra and equations",
  probability: "Discrete random variables",
  statistics: "Sampling and sample proportions",
  trigonometry: "Circular functions",
};

function compose(header: string, area: string, body: string): string {
  return `${header}

**Area:** ${area}

---

${body}`;
}

const MARKDOWN: Record<MethodsTopic, string> = {
  "Functions and transformations": compose(
    "## Functions and transformations",
    "Functions, relations and graphs",
    METHODS_FUNCTIONS_TRANSFORMATIONS,
  ),

  "Polynomial, power and rational functions": compose(
    "## Polynomial, power and rational functions",
    "Functions, relations and graphs",
    METHODS_POLYNOMIAL,
  ),

  "Exponential and logarithmic functions": compose(
    "## Exponential and logarithmic functions",
    "Functions, relations and graphs",
    METHODS_EXP_LOG,
  ),

  "Circular functions": compose(
    "## Circular functions",
    "Functions, relations and graphs",
    METHODS_CIRCULAR,
  ),

  "Algebra and equations": compose(
    "## Algebra and equations",
    "Algebra",
    METHODS_ALGEBRA,
  ),

  "Differential calculus": compose(
    "## Differential calculus",
    "Calculus",
    METHODS_DIFF_CALC,
  ),

  "Applications of differentiation": compose(
    "## Applications of differentiation",
    "Calculus",
    METHODS_APP_DIFF,
  ),

  "Integral calculus": compose(
    "## Integral calculus",
    "Calculus",
    METHODS_INTEGRAL,
  ),

  "Applications of integration": compose(
    "## Applications of integration",
    "Calculus",
    METHODS_APP_INTEGRAL,
  ),

  "Discrete random variables": compose(
    "## Discrete random variables",
    "Probability and statistics",
    METHODS_DISCRETE,
  ),

  "Continuous random variables": compose(
    "## Continuous random variables",
    "Probability and statistics",
    METHODS_CONTINUOUS,
  ),

  "The normal distribution": compose(
    "## The normal distribution",
    "Probability and statistics",
    METHODS_NORMAL,
  ),

  "Sampling and sample proportions": compose(
    "## Sampling and sample proportions",
    "Probability and statistics",
    METHODS_SAMPLING,
  ),

  "Confidence intervals for proportions": compose(
    "## Confidence intervals for proportions",
    "Probability and statistics",
    METHODS_CI_AND_EXAM,
  ),
};

export function getMethodsCurriculumOverview(topic: string): string | null {
  const t0 = String(topic ?? "").trim();
  if (!t0) return null;
  const t = stripMethodsUnitPrefix(t0);

  if (Object.prototype.hasOwnProperty.call(MARKDOWN, t)) {
    return MARKDOWN[t as MethodsTopic];
  }

  const n = norm(t);
  const alias = TOPIC_ALIASES[n] ?? TOPIC_ALIASES[norm(t0)];
  if (alias) return MARKDOWN[alias] ?? null;

  for (const k of METHODS_TOPICS) {
    if (norm(k) === n || norm(k) === norm(t0)) return MARKDOWN[k];
  }
  return null;
}

export function topicExistsInQuestionBank(
  topic: string,
  questions: Question[],
  subjectId: string,
): boolean {
  return topicHasQuestionsInBank(topic, subjectId, questions);
}
