/**
 * VCE Mathematical Methods Units 3 & 4 — fourteen scored topics.
 * Used for `question.topic`, practice filters, and overviews.
 */

export const METHODS_TOPICS = [
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
] as const;

export type MethodsTopic = (typeof METHODS_TOPICS)[number];

/** @deprecated Use METHODS_TOPICS */
export const METHODS_AREA_OF_STUDY_TOPICS = METHODS_TOPICS;

/** @deprecated Use MethodsTopic */
export type MethodsAreaOfStudyTopic = MethodsTopic;

const TOPIC_SET = new Set<string>(METHODS_TOPICS);

const LEGACY_TOPIC_MAP: Record<string, MethodsTopic> = {
  "functions, relations and graphs": "Functions and transformations",
  "algebra, number and structure": "Algebra and equations",
  calculus: "Differential calculus",
  "data analysis, probability and statistics": "Discrete random variables",
  "functions & graphs": "Functions and transformations",
  trigonometry: "Circular functions",
  trigonometric: "Circular functions",
  algebra: "Algebra and equations",
  probability: "Discrete random variables",
  statistics: "Sampling and sample proportions",
  "differential calculus": "Differential calculus",
  "integral calculus": "Integral calculus",
  integration: "Integral calculus",
  differentiation: "Differential calculus",
  optimisation: "Applications of differentiation",
  optimization: "Applications of differentiation",
  binomial: "Discrete random variables",
  normal: "The normal distribution",
  "confidence interval": "Confidence intervals for proportions",
  exponential: "Exponential and logarithmic functions",
  logarithm: "Exponential and logarithmic functions",
  polynomial: "Polynomial, power and rational functions",
  rational: "Polynomial, power and rational functions",
};

const TITLE_ALIASES: Record<string, MethodsTopic> = {
  ...LEGACY_TOPIC_MAP,
  "functions and transformations": "Functions and transformations",
  "polynomial, power and rational functions": "Polynomial, power and rational functions",
  "exponential and logarithmic functions": "Exponential and logarithmic functions",
  "circular functions": "Circular functions",
  "algebra and equations": "Algebra and equations",
  "applications of differentiation": "Applications of differentiation",
  "applications of integration": "Applications of integration",
  "discrete random variables": "Discrete random variables",
  "continuous random variables": "Continuous random variables",
  "the normal distribution": "The normal distribution",
  "sampling and sample proportions": "Sampling and sample proportions",
  "confidence intervals for proportions": "Confidence intervals for proportions",
};

function norm(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function stripMethodsUnitPrefix(topic: string): string {
  let t = String(topic ?? "").trim();
  const m34 = t.match(/^unit\s*[34]\s*[—–-]\s*(.+)$/i);
  if (m34) t = m34[1].trim();
  const m12 = t.match(/^unit\s*[12]\s*[—–-]\s*(.+)$/i);
  if (m12) t = m12[1].trim();
  const m2 = t.match(/^area\s*of\s*study\s*\d+\s*[—–:.]?\s*(.+)$/i);
  if (m2) t = m2[1].trim();
  return t;
}

function canonicalMatch(s: string): MethodsTopic | null {
  const t = String(s ?? "").trim();
  if (!t) return null;
  if (TOPIC_SET.has(t)) return t as MethodsTopic;
  const n = norm(t);
  for (const k of METHODS_TOPICS) {
    if (norm(k) === n) return k;
  }
  return LEGACY_TOPIC_MAP[n] ?? null;
}

const HEADING_ROUTE: { re: RegExp; topic: MethodsTopic }[] = [
  { re: /^functions\s+and\s+transformations\b/i, topic: "Functions and transformations" },
  { re: /^polynomial|^power\s+and\s+rational|^rational\s+function/i, topic: "Polynomial, power and rational functions" },
  { re: /^exponential|^logarithmic/i, topic: "Exponential and logarithmic functions" },
  { re: /^circular|^trigonometric/i, topic: "Circular functions" },
  { re: /^algebra\s+and\s+equations\b/i, topic: "Algebra and equations" },
  { re: /^differential\s+calculus\b/i, topic: "Differential calculus" },
  { re: /^applications\s+of\s+differentiation\b|^optimis/i, topic: "Applications of differentiation" },
  { re: /^integral\s+calculus\b/i, topic: "Integral calculus" },
  { re: /^applications\s+of\s+integration\b/i, topic: "Applications of integration" },
  { re: /^discrete\s+random/i, topic: "Discrete random variables" },
  { re: /^continuous\s+random/i, topic: "Continuous random variables" },
  { re: /^normal\s+distribution|^the\s+normal\b/i, topic: "The normal distribution" },
  { re: /^sampling\s+and\s+sample/i, topic: "Sampling and sample proportions" },
  { re: /^confidence\s+intervals?\s+for\s+proportions/i, topic: "Confidence intervals for proportions" },
];

function routeHeading(text: string): MethodsTopic | null {
  const n = norm(text);
  if (!n) return null;
  for (const { re, topic } of HEADING_ROUTE) {
    if (re.test(n)) return topic;
  }
  return null;
}

function scoreTopics(blob: string): Record<MethodsTopic, number> {
  const s = blob.toLowerCase();
  const n = (re: RegExp, w = 2) => (re.test(s) ? w : 0);

  const transforms =
    n(/\bcomposite\b|\binverse\s+function\b|\bdomain\b|\brange\b/i, 3) +
    n(/\btransformation\b|\bdilation\b|\breflection\b|\btranslation\b/i, 4) +
    n(/\by\s*=\s*af\s*\(/i, 3);

  const poly =
    n(/\bcubic\b|\bquartic\b|\bfactor\s+theorem\b|\bmultiplicity\b/i, 4) +
    n(/\brational\s+function\b|\bhyperbola\b|\btruncus\b|\bvertical\s+asymptote\b/i, 4) +
    n(/\bpower\s+function\b|\by\s*=\s*x\s*\^/i, 2);

  const expLog =
    n(/\blog\s*law\b|\bln\s*\(|\blogarithm\b/i, 4) +
    n(/\bexponential\s+growth\b|\bexponential\s+decay\b|\by\s*=\s*a\s*\^?\s*x/i, 4);

  const circular =
    n(/\bamplitude\b|\bperiod\b|\bphase\s+shift\b/i, 4) +
    n(/\bsin\s*\(|\bcos\s*\(|\btan\s*\(|\btrigonometric\s+equation\b/i, 3) +
    n(/\bunit\s+circle\b|\bexact\s+value\b.*\bsin\b/i, 2);

  const algebra =
    n(/\bsimultaneous\b|\bfactoris|\brearrang/i, 3) +
    n(/\bsolve\s+for\s+k\b|\bparameter\b/i, 2) +
    n(/\binequalit/i, 2);

  const diff =
    n(/\bderivative\b|\bdifferentiat\b|\bdy\/dx\b/i, 4) +
    n(/\bstationary\s+point\b|\bfirst\s+derivative\b/i, 3) +
    n(/\btangent\b|\bnormal\b.*\bline\b/i, 2);

  const appDiff =
    n(/\boptimis|\bmaximum\b.*\bminimum\b|\bcritical\s+point\b/i, 5) +
    n(/\brate\s+of\s+change\b.*\bcontext\b|\bmaximum\s+area\b/i, 3);

  const integral =
    n(/\banti-?deriv|\bdefinite\s+integral\b|\barea\s+under\b/i, 5) +
    n(/\barea\s+between\s+curves\b/i, 4);

  const appInt =
    n(/\bprobability\s+density\b|\bpdf\b|\btotal\s+probability\b.*\bintegrat/i, 4) +
    n(/\baccumulated\b.*\bintegrat/i, 3);

  const discrete =
    n(/\bbinomial\b|\bdiscrete\s+random\b|\be\s*\(\s*x\s*\)\b.*\bvar\b/i, 5) +
    n(/\bprobability\s+distribution\s+table\b/i, 3);

  const continuous =
    n(/\bprobability\s+density\s+function\b|\bcumulative\s+distribution\b|\bmedian\b.*\bdensity/i, 5) +
    n(/\bcontinuous\s+random\b/i, 4);

  const normal =
    n(/\bnormal\s+distribution\b|\bz-?score\b|\bstandardis/i, 5) +
    n(/\bbell\s+shaped\b|\bpercentile\b.*\bnormal\b/i, 3);

  const sampling =
    n(/\bsample\s+proportion\b|\bsampling\s+variability\b|\bpopulation\s+proportion\b/i, 5) +
    n(/\brandom\s+sample\b.*\bproportion\b/i, 3);

  const confProp =
    n(/\bconfidence\s+interval\b.*\bproportion\b|\bmargin\s+of\s+error\b.*\bproportion\b/i, 5) +
    n(/\b95\s*%\s+confidence\b.*\bproportion\b/i, 4);

  return {
    "Functions and transformations": transforms,
    "Polynomial, power and rational functions": poly,
    "Exponential and logarithmic functions": expLog,
    "Circular functions": circular,
    "Algebra and equations": algebra,
    "Differential calculus": diff,
    "Applications of differentiation": appDiff,
    "Integral calculus": integral,
    "Applications of integration": appInt,
    "Discrete random variables": discrete,
    "Continuous random variables": continuous,
    "The normal distribution": normal,
    "Sampling and sample proportions": sampling,
    "Confidence intervals for proportions": confProp,
  };
}

const TIE_PRIORITY: MethodsTopic[] = [
  "Confidence intervals for proportions",
  "Sampling and sample proportions",
  "The normal distribution",
  "Continuous random variables",
  "Discrete random variables",
  "Applications of integration",
  "Integral calculus",
  "Applications of differentiation",
  "Differential calculus",
  "Circular functions",
  "Exponential and logarithmic functions",
  "Polynomial, power and rational functions",
  "Functions and transformations",
  "Algebra and equations",
];

function pickBestPositive(scores: Record<MethodsTopic, number>): MethodsTopic | null {
  let max = 0;
  for (const k of METHODS_TOPICS) {
    if (scores[k] > max) max = scores[k];
  }
  if (max <= 0) return null;
  for (const k of TIE_PRIORITY) {
    if (scores[k] === max) return k;
  }
  return null;
}

export function inferMethodsAreaOfStudy(
  rawTopic: unknown,
  question: string,
  passage?: string,
): MethodsTopic {
  const topicRaw = String(rawTopic ?? "").trim();
  const stripped = stripMethodsUnitPrefix(topicRaw);

  const direct = canonicalMatch(topicRaw) ?? canonicalMatch(stripped);
  if (direct) return direct;

  const alias = TITLE_ALIASES[norm(stripped)] ?? TITLE_ALIASES[norm(topicRaw)];
  if (alias) return alias;

  const fromHeading = routeHeading(stripped) ?? routeHeading(topicRaw);
  if (fromHeading) return fromHeading;

  const blob = `${topicRaw}\n${question}\n${passage ?? ""}`;
  const fromBlob = pickBestPositive(scoreTopics(blob));
  if (fromBlob) return fromBlob;

  const fromBody = pickBestPositive(scoreTopics(`${question}\n${passage ?? ""}`));
  if (fromBody) return fromBody;

  return "Algebra and equations";
}

export function methodsPracticeTopicOptions(): string[] {
  return ["all", ...METHODS_TOPICS];
}
