/**
 * VCE General Mathematics Units 3 & 4 — four topic summaries.
 * Markdown for CurriculumOverview / RichQuestionContent (KaTeX via remark-math).
 */

import {
  GENERAL_MATHS_AREA_OF_STUDY_TOPICS,
  type GeneralMathsAreaOfStudyTopic,
  stripGeneralMathsUnitPrefix,
} from "@/lib/generalMathsAreaTopic";
import {
  GENERAL_OVERVIEW_BIG_PICTURE,
  GENERAL_OVERVIEW_DATA,
  GENERAL_OVERVIEW_MATRICES,
  GENERAL_OVERVIEW_NETWORKS,
  GENERAL_OVERVIEW_RECURSION,
} from "@/lib/generalMathsOverviewSections";

export { GENERAL_MATHS_AREA_OF_STUDY_TOPICS, type GeneralMathsAreaOfStudyTopic };

const norm = (s: string) =>
  String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

const TOPIC_ALIASES: Record<string, GeneralMathsAreaOfStudyTopic> = {
  statistics: "Data analysis",
  "data analysis, probability and statistics": "Data analysis",
  finance: "Recursion and financial modelling",
  sequences: "Recursion and financial modelling",
  recursion: "Recursion and financial modelling",
  matrices: "Matrices",
  matrix: "Matrices",
  networks: "Networks and decision mathematics",
  graphs: "Networks and decision mathematics",
  "discrete mathematics": "Matrices",
  "algebra, number and structure": "Recursion and financial modelling",
  "functions, relations and graphs": "Data analysis",
  "space and measurement": "Data analysis",
};

function compose(header: string, area: string, body: string): string {
  return `${header}

**Area:** ${area}

---

${body}`;
}

const MARKDOWN: Record<GeneralMathsAreaOfStudyTopic, string> = {
  "Data analysis": compose(
    "## Data analysis",
    "Data analysis",
    `${GENERAL_OVERVIEW_BIG_PICTURE}

---

${GENERAL_OVERVIEW_DATA}`,
  ),

  "Recursion and financial modelling": compose(
    "## Recursion and financial modelling",
    "Recursion and financial modelling",
    `**Sequences** where each term depends on the previous term — used heavily in **finance**, loans, and investments.

${GENERAL_OVERVIEW_RECURSION}`,
  ),

  Matrices: compose(
    "## Matrices",
    "Matrices",
    `Organising numbers in **arrays** to model transitions, networks, and systems.

${GENERAL_OVERVIEW_MATRICES}`,
  ),

  "Networks and decision mathematics": compose(
    "## Networks and decision mathematics",
    "Networks and decision mathematics",
    `**Graphs**, **paths**, **optimisation**, and **scheduling**.

${GENERAL_OVERVIEW_NETWORKS}`,
  ),
};

export function getGeneralMathsCurriculumOverview(topic: string): string | null {
  const t0 = String(topic ?? "").trim();
  if (!t0) return null;
  const t = stripGeneralMathsUnitPrefix(t0);

  if (Object.prototype.hasOwnProperty.call(MARKDOWN, t)) {
    return MARKDOWN[t as GeneralMathsAreaOfStudyTopic];
  }

  const n = norm(t);
  const alias = TOPIC_ALIASES[n] ?? TOPIC_ALIASES[norm(t0)];
  if (alias) return MARKDOWN[alias] ?? null;

  for (const k of GENERAL_MATHS_AREA_OF_STUDY_TOPICS) {
    if (norm(k) === n || norm(k) === norm(t0)) return MARKDOWN[k];
  }
  return null;
}
