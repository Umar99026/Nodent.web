/**
 * VCE Specialist Mathematics Units 3 & 4 — twelve scored topics.
 * Used for `question.topic`, practice filters, and overviews.
 */

export const SPECIALIST_MATHS_TOPICS = [
  "Logic and proof",
  "Complex numbers and algebra",
  "Functions, relations and graphs",
  "Differential calculus",
  "Integral calculus",
  "Differential equations",
  "Kinematics",
  "Vectors in two and three dimensions",
  "Lines and planes in 3D",
  "Vector calculus",
  "Random variables and sampling",
  "Confidence intervals",
] as const;

export type SpecialistMathsTopic = (typeof SPECIALIST_MATHS_TOPICS)[number];

/** @deprecated Use SPECIALIST_MATHS_TOPICS */
export const SPECIALIST_MATHS_AREA_OF_STUDY_TOPICS = SPECIALIST_MATHS_TOPICS;

/** @deprecated Use SpecialistMathsTopic */
export type SpecialistMathsAreaOfStudyTopic = SpecialistMathsTopic;

const TOPIC_SET = new Set<string>(SPECIALIST_MATHS_TOPICS);

/** Legacy Units 1–2 / sheet labels → Units 3 & 4 topic. */
const LEGACY_TOPIC_MAP: Record<string, SpecialistMathsTopic> = {
  "proof and number": "Logic and proof",
  "graph theory": "Logic and proof",
  "logic and algorithms": "Logic and proof",
  logic: "Logic and proof",
  proof: "Logic and proof",
  "complex numbers": "Complex numbers and algebra",
  complex: "Complex numbers and algebra",
  "sequences and series": "Complex numbers and algebra",
  combinatorics: "Logic and proof",
  matrices: "Vectors in two and three dimensions",
  "simulation, sampling and sampling distributions": "Random variables and sampling",
  trigonometry: "Functions, relations and graphs",
  transformations: "Functions, relations and graphs",
  "vectors in the plane": "Vectors in two and three dimensions",
  calculus: "Differential calculus",
  "differential calculus": "Differential calculus",
  "integral calculus": "Integral calculus",
  integration: "Integral calculus",
  "differential equations": "Differential equations",
  kinematics: "Kinematics",
  mechanics: "Kinematics",
  "vectors in two and three dimensions": "Vectors in two and three dimensions",
  "lines and planes in 3d": "Lines and planes in 3D",
  "lines and planes in 3D": "Lines and planes in 3D",
  "vector calculus": "Vector calculus",
  "random variables and sampling": "Random variables and sampling",
  "probability and statistics: random variables and sampling": "Random variables and sampling",
  statistics: "Random variables and sampling",
  probability: "Random variables and sampling",
  "confidence intervals": "Confidence intervals",
  "functions, relations and graphs": "Functions, relations and graphs",
};

const TITLE_ALIASES: Record<string, SpecialistMathsTopic> = {
  ...LEGACY_TOPIC_MAP,
  "logic and proof": "Logic and proof",
  "complex numbers and algebra": "Complex numbers and algebra",
  "partial fractions": "Functions, relations and graphs",
  "related rates": "Differential calculus",
  "implicit differentiation": "Differential calculus",
  "integration by parts": "Integral calculus",
  "euler's method": "Differential equations",
  "eulers method": "Differential equations",
  "slope field": "Differential equations",
  "dot product": "Vectors in two and three dimensions",
  "cross product": "Vectors in two and three dimensions",
  "sample mean": "Random variables and sampling",
};

function norm(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function stripSpecialistMathsUnitPrefix(topic: string): string {
  let t = String(topic ?? "").trim();
  const m34 = t.match(/^unit\s*[34]\s*[—–-]\s*(.+)$/i);
  if (m34) t = m34[1].trim();
  const m12 = t.match(/^unit\s*[12]\s*[—–-]\s*(.+)$/i);
  if (m12) t = m12[1].trim();
  const m2 = t.match(/^area\s*of\s*study\s*\d+\s*[—–:.]?\s*(.+)$/i);
  if (m2) t = m2[1].trim();
  return t;
}

function canonicalMatch(s: string): SpecialistMathsTopic | null {
  const t = String(s ?? "").trim();
  if (!t) return null;
  if (TOPIC_SET.has(t)) return t as SpecialistMathsTopic;
  const n = norm(t);
  for (const k of SPECIALIST_MATHS_TOPICS) {
    if (norm(k) === n) return k;
  }
  return LEGACY_TOPIC_MAP[n] ?? null;
}

const HEADING_ROUTE: { re: RegExp; topic: SpecialistMathsTopic }[] = [
  { re: /^logic\s+and\s+proof\b|^proof\s+and\s+number\b/i, topic: "Logic and proof" },
  { re: /^complex\s+numbers/i, topic: "Complex numbers and algebra" },
  { re: /^functions[,\s]+relations/i, topic: "Functions, relations and graphs" },
  { re: /^differential\s+calculus\b/i, topic: "Differential calculus" },
  { re: /^integral\s+calculus\b|^integration\b/i, topic: "Integral calculus" },
  { re: /^differential\s+equations?\b/i, topic: "Differential equations" },
  { re: /^kinematics\b|^mechanics\b/i, topic: "Kinematics" },
  { re: /^vectors\s+in\s+(?:two|2)\s+and\s+(?:three|3)/i, topic: "Vectors in two and three dimensions" },
  { re: /^lines\s+and\s+planes/i, topic: "Lines and planes in 3D" },
  { re: /^vector\s+calculus\b/i, topic: "Vector calculus" },
  { re: /^random\s+variables|^probability\s+and\s+statistics/i, topic: "Random variables and sampling" },
  { re: /^confidence\s+intervals?\b/i, topic: "Confidence intervals" },
];

function routeHeading(text: string): SpecialistMathsTopic | null {
  const n = norm(text);
  if (!n) return null;
  for (const { re, topic } of HEADING_ROUTE) {
    if (re.test(n)) return topic;
  }
  return null;
}

function scoreTopics(sIn: string): Record<SpecialistMathsTopic, number> {
  const s = sIn.toLowerCase();
  const n = (re: RegExp, w = 2) => (re.test(s) ? w : 0);

  const logic =
    n(/\bmathematical\s+induction\b|\bproof\s+by\s+contradiction\b|\bcontrapositive\b/i, 5) +
    n(/\bcounter-?example\b|\bquantifier\b|\bnegation\b|\bimplication\b/i, 3) +
    n(/\bprove\b|\bdivisib|\binequalit.*prove\b/i, 2);

  const complex =
    n(/\bargand\b|\bde\s+moivre\b|\bcomplex\s+root\b|\bconjugate\s+root\b/i, 5) +
    n(/\bmodulus\b.*\bargument\b|\bcartesian\s+form\b.*\bcomplex\b/i, 4) +
    n(/\bpolynomial\b.*\bcomplex\b|\bfactor\s+theorem\b/i, 3);

  const functions =
    n(/\bpartial\s+fractions?\b|\brational\s+function\b|\bvertical\s+asymptote\b/i, 5) +
    n(/\boblique\s+asymptote\b|\bpoint\s+of\s+inflection\b|\bquotient\s+function\b/i, 3) +
    n(/\babsolute\s+value\b.*\bgraph\b|\breciprocal\s+function\b/i, 2);

  const diff =
    n(/\bimplicit\s+differentiation\b|\brelated\s+rates\b/i, 5) +
    n(/\bchain\s+rule\b|\bproduct\s+rule\b|\bquotient\s+rule\b/i, 3) +
    n(/\binverse\s+circular\b.*\bderiv|\bderivative\b/i, 2);

  const integral =
    n(/\bintegration\s+by\s+parts\b|\breduction\s+formula\b/i, 5) +
    n(/\bvolume\s+of\s+revolution\b|\bsurface\s+area\s+of\s+revolution\b|\barc\s+length\b/i, 4) +
    n(/\bsubstitution\b.*\bintegrat|\bpartial\s+fractions?\b.*\bintegrat/i, 3);

  const de =
    n(/\bdifferential\s+equation\b|\bslope\s+field\b|\beuler'?s\s+method\b/i, 5) +
    n(/\bseparation\s+of\s+variables\b|\bverify\s+.*\bsolution\b/i, 3);

  const kinematics =
    n(/\brectilinear\s+motion\b|\bvelocity[-\s]time\s+graph\b/i, 5) +
    n(/\bdisplacement\b.*\bvelocity\b|\bacceleration\b.*\bposition\b/i, 3) +
    n(/\bparticle\b.*\bmotion\b|\bat\s+rest\b/i, 2);

  const vectors =
    n(/\bcross\s+product\b|\bscalar\s+triple\s+product\b/i, 5) +
    n(/\bdot\s+product\b|\bprojection\b.*\bvector\b/i, 4) +
    n(/\bi\s*,\s*j\s*,\s*k\b|\bunit\s+vector\b/i, 2);

  const linesPlanes =
    n(/\bvector\s+equation\s+of\s+(?:a\s+)?line\b|\bparametric\s+equation\b.*\bline\b/i, 5) +
    n(/\bnormal\s+vector\b.*\bplane\b|\bcartesian\s+equation\b.*\bplane\b/i, 4) +
    n(/\bdistance\s+from\s+a\s+point\s+to\s+a\s+plane\b/i, 3);

  const vectorCalc =
    n(/\bposition\s+vector\b.*\btime\b|\bvector\s+function\b/i, 4) +
    n(/\bdifferentiat.*\bvector\b|\bintegrat.*\bvector\b.*\bcomponent\b/i, 4) +
    n(/\br\s*\(\s*t\s*\)\s*,\s*v\s*\(\s*t\s*\)/i, 3);

  const randomVar =
    n(/\blinear\s+combination\b.*\brandom\s+variable\b|\be\s*\(\s*a\s*x\s*\+\s*b\s*y\s*\)/i, 5) +
    n(/\bvariance\b.*\bindependent\b|\bsampling\s+distribution\b/i, 4) +
    n(/\bsimulation\b.*\bsample\s+mean\b/i, 3);

  const confidence =
    n(/\bconfidence\s+interval\b|\bmargin\s+of\s+error\b/i, 5) +
    n(/\bstandard\s+error\b|\b95\s*%\s+confidence\b/i, 4) +
    n(/\bconfidence\s+level\b/i, 3);

  return {
    "Logic and proof": logic,
    "Complex numbers and algebra": complex,
    "Functions, relations and graphs": functions,
    "Differential calculus": diff,
    "Integral calculus": integral,
    "Differential equations": de,
    Kinematics: kinematics,
    "Vectors in two and three dimensions": vectors,
    "Lines and planes in 3D": linesPlanes,
    "Vector calculus": vectorCalc,
    "Random variables and sampling": randomVar,
    "Confidence intervals": confidence,
  };
}

const TIE_PRIORITY: SpecialistMathsTopic[] = [
  "Confidence intervals",
  "Random variables and sampling",
  "Vector calculus",
  "Lines and planes in 3D",
  "Vectors in two and three dimensions",
  "Kinematics",
  "Differential equations",
  "Integral calculus",
  "Differential calculus",
  "Complex numbers and algebra",
  "Functions, relations and graphs",
  "Logic and proof",
];

function pickBestPositive(
  scores: Record<SpecialistMathsTopic, number>,
): SpecialistMathsTopic | null {
  let max = 0;
  for (const k of SPECIALIST_MATHS_TOPICS) {
    if (scores[k] > max) max = scores[k];
  }
  if (max <= 0) return null;
  for (const k of TIE_PRIORITY) {
    if (scores[k] === max) return k;
  }
  return null;
}

const PARENT_AREAS = new Set(
  [
    "Algebra, number and structure",
    "Data analysis, probability and statistics",
    "Discrete mathematics",
    "Functions, relations and graphs",
    "Space and measurement",
    "Calculus",
  ].map(norm),
);

function legacySheetLabel(topicRaw: string): SpecialistMathsTopic | null {
  const t = norm(stripSpecialistMathsUnitPrefix(topicRaw));
  if (!t) return null;
  if (LEGACY_TOPIC_MAP[t]) return LEGACY_TOPIC_MAP[t];
  const fromHeading = routeHeading(t);
  if (fromHeading) return fromHeading;
  if (PARENT_AREAS.has(t)) return null;
  return null;
}

export function inferSpecialistMathsAreaOfStudy(
  rawTopic: unknown,
  question: string,
  passage?: string,
): SpecialistMathsTopic {
  const topicRaw = String(rawTopic ?? "").trim();
  const stripped = stripSpecialistMathsUnitPrefix(topicRaw);

  const direct = canonicalMatch(topicRaw) ?? canonicalMatch(stripped);
  if (direct) return direct;

  const alias = TITLE_ALIASES[norm(stripped)] ?? TITLE_ALIASES[norm(topicRaw)];
  if (alias) return alias;

  const fromHeading = routeHeading(stripped) ?? routeHeading(topicRaw);
  if (fromHeading) return fromHeading;

  const fromLegacy = legacySheetLabel(topicRaw);
  if (fromLegacy) return fromLegacy;

  const blob = `${topicRaw}\n${question}\n${passage ?? ""}`;
  const fromBlob = pickBestPositive(scoreTopics(blob));
  if (fromBlob) return fromBlob;

  const fromBody = pickBestPositive(scoreTopics(`${question}\n${passage ?? ""}`));
  if (fromBody) return fromBody;

  return "Logic and proof";
}

/** Units 3 & 4 labels for practice / quiz topic filters. */
export function specialistMathsPracticeTopicOptions(): string[] {
  return ["all", ...SPECIALIST_MATHS_TOPICS];
}
