/**
 * VCE Mathematical Methods — four Areas of Study (topic labels match the study design,
 * without “Unit 1/2” in the name). Used for question.topic + practice filters + overviews.
 */

export const METHODS_AREA_OF_STUDY_TOPICS = [
  "Functions, relations and graphs",
  "Algebra, number and structure",
  "Calculus",
  "Data analysis, probability and statistics",
] as const;

export type MethodsAreaOfStudyTopic = (typeof METHODS_AREA_OF_STUDY_TOPICS)[number];

const TOPIC_SET = new Set<string>(METHODS_AREA_OF_STUDY_TOPICS);

/** Map free-text / legacy labels (lowercase normalized) → canonical area title. */
const TITLE_ALIASES: Record<string, MethodsAreaOfStudyTopic> = {
  calculus: "Calculus",
  "functions & graphs": "Functions, relations and graphs",
  trigonometry: "Functions, relations and graphs",
  trigonometric: "Functions, relations and graphs",
  algebra: "Algebra, number and structure",
  probability: "Data analysis, probability and statistics",
  statistics: "Data analysis, probability and statistics",
  "data analysis": "Data analysis, probability and statistics",
  functions: "Functions, relations and graphs",
  graphs: "Functions, relations and graphs",
  "section a": "Functions, relations and graphs",
  "section b": "Algebra, number and structure",
  "section c": "Calculus",
  "section d": "Data analysis, probability and statistics",
  general: "Algebra, number and structure",
};

function norm(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Strip legacy `Unit 1 —` / `Unit 2 —` prefixes from topic picker values. */
export function stripMethodsUnitPrefix(topic: string): string {
  const t = String(topic ?? "").trim();
  const m = t.match(/^unit\s*[12]\s*[—–-]\s*(.+)$/i);
  return m ? m[1].trim() : t;
}

function scoreArea(blob: string): Record<MethodsAreaOfStudyTopic, number> {
  const s = blob.toLowerCase();
  const n = (re: RegExp, w = 2) => (re.test(s) ? w : 0);

  let fun =
    n(/\basymptote\b/i) +
    n(/\bperiodicity\b|\bperiod\b|\bamplitude\b/i) +
    n(/\bsin\s*\(|\bcos\s*\(|\btan\s*\(|\barcsin\b|\barccos\b|\barctan\b/i, 3) +
    n(/\bcomposite\b|\bf\s*∘\s*g/i) +
    n(/\binverse function\b|\binverse of\b/i) +
    n(/\blog_(?:e|a)?\s*\(|\bln\s*\(/i, 2) +
    n(/\be\^|\\bexp\b/i, 2) +
    n(/\bunit circle\b|\bradian\b|\barc length\b/i) +
    n(/\bdomain\b|\brange\b|\bco-?domain\b/i) +
    n(/\bgraph of\b|\btransform\b|\bdilation\b|\breflection\b|\btranslation\b/i) +
    n(/\bf\s*:\s*r\s*→\s*r\b/) +
    n(/\bwhich.*graph\b|\brepresents the graph\b/i, 2);

  let alg =
    n(/\bsimultaneous\b|\bsystem of equations\b/i, 3) +
    n(/\bnewton'?s method\b|\bbisection\b/i, 3) +
    n(/\bfactor theorem\b|\bremainder theorem\b|\brational root\b/i, 2) +
    n(/\bpolynomial equation\b|\bsolve for\s+k\b/i, 2) +
    n(/\bexponent law\b|\blogarithm law\b|\bsolve.*exponential\b/i, 2) +
    n(/\bsubstitut\w+\b|\bequivalent expression\b/i) +
    n(/\bparameter\s+k\b|\bcontaining the parameter\b/i, 2) +
    n(/\bmatrix\b|\btranspose\b/i) +
    n(/\balgorithm\b|\bwhile\b.*\bprint\b/i, 2) +
    n(/\bax\s*\+\s*by\b|\blinear equations\b/i, 2);

  let cal =
    n(/\bderivative\b|\bdifferentiat\b/i, 3) +
    n(/\btrapezium rule\b|\btrapezoidal\b/i, 4) +
    n(/\bintegral\b|\banti-?differentiat\b/i, 3) +
    n(/\bgradient\b|\btangent\b/i, 2) +
    n(/\brate of change\b|\binstantaneous\b/i, 2) +
    n(/\bstationary\b|\binflection\b|\blocal max\b|\blocal min\b/i, 2) +
    n(/\blimit\b.*\bh\s*→\s*0\b|\bf'\s*\(|\bf\s*prime\b/i, 2) +
    n(/\bcentral difference\b/i, 3);

  let data =
    n(/\bconfidence interval\b|\b95%\b.*\binterval\b/i, 3) +
    n(/\bPr\s*\(/i, 3) +
    n(/\bprobability\b/i, 2) +
    n(/\bexpected value\b|\bmean\b.*\bsample\b|\bvariance\b/i) +
    n(/\brandom sample\b|\bhouseholds\b.*\bproportion\b/i, 2) +
    n(/\bindependent event\b|\bmutually exclusive\b|\bconditional probability\b/i, 2) +
    n(/\bvenn\b|\btree diagram\b/i, 2) +
    n(/\bbinomial\b|\bnormal distribution\b/i, 2) +
    n(/\bwith(?:out)? replacement\b/i, 2) +
    n(/\bsimulation\b.*\bestimat/i, 2);

  return {
    "Functions, relations and graphs": fun,
    "Algebra, number and structure": alg,
    Calculus: cal,
    "Data analysis, probability and statistics": data,
  };
}

function pickMax(scores: Record<MethodsAreaOfStudyTopic, number>): MethodsAreaOfStudyTopic {
  let best: MethodsAreaOfStudyTopic = "Functions, relations and graphs";
  let v = -1;
  for (const k of METHODS_AREA_OF_STUDY_TOPICS) {
    if (scores[k] > v) {
      v = scores[k];
      best = k;
    }
  }
  return best;
}

/**
 * Assign every Methods question one of the four Areas of Study from sheet topic + stimulus text.
 */
export function inferMethodsAreaOfStudy(
  rawTopic: unknown,
  question: string,
  passage?: string,
): MethodsAreaOfStudyTopic {
  const topicRaw = String(rawTopic ?? "").trim();
  const titleFromUnit = stripMethodsUnitPrefix(topicRaw);
  if (TOPIC_SET.has(titleFromUnit)) {
    return titleFromUnit as MethodsAreaOfStudyTopic;
  }
  if (TOPIC_SET.has(topicRaw)) {
    return topicRaw as MethodsAreaOfStudyTopic;
  }

  const alias = TITLE_ALIASES[norm(topicRaw)];
  if (alias) return alias;

  const blob = `${topicRaw}\n${question}\n${passage ?? ""}`;
  return pickMax(scoreArea(blob));
}
