/**
 * VCE Specialist Mathematics Units 3 & 4 — twelve topic summaries.
 * Markdown for CurriculumOverview / RichQuestionContent (KaTeX via remark-math).
 */

import {
  SPECIALIST_MATHS_TOPICS,
  type SpecialistMathsTopic,
  stripSpecialistMathsUnitPrefix,
} from "@/lib/specialistMathsAreaTopic";
import {
  SPECIALIST_OVERVIEW_CI,
  SPECIALIST_OVERVIEW_COMPLEX,
  SPECIALIST_OVERVIEW_DE,
  SPECIALIST_OVERVIEW_DIFF_CALC,
  SPECIALIST_OVERVIEW_FUNCTIONS,
  SPECIALIST_OVERVIEW_INTEGRAL,
  SPECIALIST_OVERVIEW_KINEMATICS,
  SPECIALIST_OVERVIEW_LINES_PLANES,
  SPECIALIST_OVERVIEW_LOGIC,
  SPECIALIST_OVERVIEW_RANDOM,
  SPECIALIST_OVERVIEW_VECTOR_CALC,
  SPECIALIST_OVERVIEW_VECTORS,
} from "@/lib/specialistMathsOverviewSections";

export { SPECIALIST_MATHS_TOPICS, type SpecialistMathsTopic };
/** @deprecated */
export const SPECIALIST_MATHS_AREA_OF_STUDY_TOPICS = SPECIALIST_MATHS_TOPICS;
/** @deprecated */
export type SpecialistMathsAreaOfStudyTopic = SpecialistMathsTopic;

const norm = (s: string) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const TOPIC_ALIASES: Record<string, SpecialistMathsTopic> = {
  "proof and number": "Logic and proof",
  "graph theory": "Logic and proof",
  "logic and algorithms": "Logic and proof",
  "complex numbers": "Complex numbers and algebra",
  calculus: "Differential calculus",
  statistics: "Random variables and sampling",
  probability: "Random variables and sampling",
  "probability and statistics: random variables and sampling": "Random variables and sampling",
};

function compose(header: string, area: string, body: string): string {
  return `${header}

**Area:** ${area}

---

${body}`;
}

const MARKDOWN: Record<SpecialistMathsTopic, string> = {
  "Logic and proof": compose(
    "## Logic and proof",
    "Discrete mathematics",
    `Making mathematical arguments precise — statements, proof styles, and induction.

${SPECIALIST_OVERVIEW_LOGIC}`,
  ),

  "Complex numbers and algebra": compose(
    "## Complex numbers and algebra",
    "Algebra, number and structure",
    `Complex arithmetic, polar form, De Moivre’s theorem, and roots.

${SPECIALIST_OVERVIEW_COMPLEX}`,
  ),

  "Functions, relations and graphs": compose(
    "## Functions, relations and graphs",
    "Functions, relations and graphs",
    `Rational functions, partial fractions, parametric and polar graphs.

${SPECIALIST_OVERVIEW_FUNCTIONS}`,
  ),

  "Differential calculus": compose(
    "## Differential calculus",
    "Calculus",
    `Advanced differentiation — rules, implicit differentiation, and related rates.

${SPECIALIST_OVERVIEW_DIFF_CALC}`,
  ),

  "Integral calculus": compose(
    "## Integral calculus",
    "Calculus",
    `Integration techniques and when to use them.

${SPECIALIST_OVERVIEW_INTEGRAL}`,
  ),

  "Differential equations": compose(
    "## Differential equations",
    "Calculus",
    `Equations involving derivatives — modelling and separable solutions.

${SPECIALIST_OVERVIEW_DE}`,
  ),

  Kinematics: compose(
    "## Kinematics",
    "Calculus / mechanics",
    `Position, velocity and acceleration linked by calculus.

${SPECIALIST_OVERVIEW_KINEMATICS}`,
  ),

  "Vectors in two and three dimensions": compose(
    "## Vectors in two and three dimensions",
    "Space and measurement",
    `Vector operations, dot product, projection, and cross product.

${SPECIALIST_OVERVIEW_VECTORS}`,
  ),

  "Lines and planes in 3D": compose(
    "## Lines and planes in 3D",
    "Space and measurement",
    `Lines and planes in 3D, normals, and distances.

${SPECIALIST_OVERVIEW_LINES_PLANES}`,
  ),

  "Vector calculus": compose(
    "## Vector calculus",
    "Space and measurement",
    `Vector functions of time and parametric motion.

${SPECIALIST_OVERVIEW_VECTOR_CALC}`,
  ),

  "Random variables and sampling": compose(
    "## Random variables and sampling",
    "Data analysis, probability and statistics",
    `Random variables, binomial and normal models, and sample means.

${SPECIALIST_OVERVIEW_RANDOM}`,
  ),

  "Confidence intervals": compose(
    "## Confidence intervals",
    "Data analysis, probability and statistics",
    `Estimate a population mean — plus exam strategy and key formulas.

${SPECIALIST_OVERVIEW_CI}`,
  ),
};

export function getSpecialistMathsCurriculumOverview(topic: string): string | null {
  const t0 = String(topic ?? "").trim();
  if (!t0) return null;
  const t = stripSpecialistMathsUnitPrefix(t0);

  if (Object.prototype.hasOwnProperty.call(MARKDOWN, t)) {
    return MARKDOWN[t as SpecialistMathsTopic];
  }

  const n = norm(t);
  const alias = TOPIC_ALIASES[n] ?? TOPIC_ALIASES[norm(t0)];
  if (alias) return MARKDOWN[alias] ?? null;

  for (const k of SPECIALIST_MATHS_TOPICS) {
    if (norm(k) === n || norm(k) === norm(t0)) return MARKDOWN[k];
  }
  return null;
}
