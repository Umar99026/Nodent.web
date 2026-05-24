/**
 * VCE General Mathematics Units 3 & 4 — four scored topics (Year 12).
 * Used for `question.topic`, practice filters, dropdowns, and overviews.
 */

export const GENERAL_MATHS_AREA_OF_STUDY_TOPICS = [
  "Data analysis",
  "Recursion and financial modelling",
  "Matrices",
  "Networks and decision mathematics",
] as const;

export type GeneralMathsAreaOfStudyTopic =
  (typeof GENERAL_MATHS_AREA_OF_STUDY_TOPICS)[number];

const TOPIC_SET = new Set<string>(GENERAL_MATHS_AREA_OF_STUDY_TOPICS);

/** Legacy Units 1–2 / sheet labels → Units 3 & 4 topic. */
const LEGACY_TOPIC_MAP: Record<string, GeneralMathsAreaOfStudyTopic> = {
  "data analysis, probability and statistics": "Data analysis",
  "algebra, number and structure": "Recursion and financial modelling",
  "functions, relations and graphs": "Data analysis",
  "discrete mathematics": "Matrices",
  "space and measurement": "Data analysis",
  statistics: "Data analysis",
  finance: "Recursion and financial modelling",
  sequences: "Recursion and financial modelling",
  recurrence: "Recursion and financial modelling",
  matrices: "Matrices",
  matrix: "Matrices",
  networks: "Networks and decision mathematics",
  graphs: "Networks and decision mathematics",
  measurement: "Data analysis",
  trigonometry: "Data analysis",
};

/** Lowercase normalised free-text / sheet labels → canonical title. */
const TITLE_ALIASES: Record<string, GeneralMathsAreaOfStudyTopic> = {
  "data analysis": "Data analysis",
  statistics: "Data analysis",
  "time series": "Data analysis",
  correlation: "Data analysis",
  regression: "Data analysis",
  finance: "Recursion and financial modelling",
  "financial modelling": "Recursion and financial modelling",
  "financial modeling": "Recursion and financial modelling",
  recursion: "Recursion and financial modelling",
  sequences: "Recursion and financial modelling",
  "compound interest": "Recursion and financial modelling",
  loans: "Recursion and financial modelling",
  annuities: "Recursion and financial modelling",
  depreciation: "Recursion and financial modelling",
  matrices: "Matrices",
  matrix: "Matrices",
  "transition matrix": "Matrices",
  "leslie matrix": "Matrices",
  networks: "Networks and decision mathematics",
  "decision mathematics": "Networks and decision mathematics",
  "graph theory": "Networks and decision mathematics",
  "critical path": "Networks and decision mathematics",
};

const SUBTOPIC_ROUTE: { re: RegExp; topic: GeneralMathsAreaOfStudyTopic }[] = [
  {
    re: /time\s+series|seasonal\s+(?:index|adjust)|moving\s+average|deseasonal|smoothing/i,
    topic: "Data analysis",
  },
  {
    re: /scatter\s*plot|correlation\s+coefficient|regression|residual|box\s*plot|interquartile|five[-\s]?number/i,
    topic: "Data analysis",
  },
  {
    re: /compound\s+interest|reducing[-\s]?balance|annuit|perpetuit|depreciat|recurrence\s+relation|first[-\s]?order/i,
    topic: "Recursion and financial modelling",
  },
  {
    re: /arithmetic\s+sequence|geometric\s+sequence|common\s+(?:difference|ratio)/i,
    topic: "Recursion and financial modelling",
  },
  {
    re: /transition\s+matrix|leslie\s+matrix|steady\s+state|markov/i,
    topic: "Matrices",
  },
  {
    re: /\bmatrix\b|\bmatrices\b|scalar\s+multiplication|matrix\s+multiplication/i,
    topic: "Matrices",
  },
  {
    re: /minimum\s+spanning\s+tree|kruskal|prim'?s?\s+algorithm|dijkstra|eulerian|hamiltonian|critical\s+path/i,
    topic: "Networks and decision mathematics",
  },
  {
    re: /spanning\s+tree|shortest\s+path|bipartite|scheduling|float|slack|vertices?\s+and\s+edges?/i,
    topic: "Networks and decision mathematics",
  },
];

function norm(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

/** Strip `Unit 3 —` / `Unit 4 —` / `Area of study 1` style prefixes. */
export function stripGeneralMathsUnitPrefix(topic: string): string {
  let t = String(topic ?? "").trim();
  const m1 = t.match(/^unit\s*[34]\s*[—–-]\s*(.+)$/i);
  if (m1) t = m1[1].trim();
  const m2 = t.match(/^unit\s*[12]\s*[—–-]\s*(.+)$/i);
  if (m2) t = m2[1].trim();
  const m3 = t.match(/^area\s*of\s*study\s*\d+\s*[—–:.]?\s*(.+)$/i);
  if (m3) t = m3[1].trim();
  return t;
}

function canonicalMatch(s: string): GeneralMathsAreaOfStudyTopic | null {
  const t = String(s ?? "").trim();
  if (!t) return null;
  if (TOPIC_SET.has(t)) return t as GeneralMathsAreaOfStudyTopic;
  const n = norm(t);
  if (TOPIC_SET.has(n)) return n as GeneralMathsAreaOfStudyTopic;
  for (const k of GENERAL_MATHS_AREA_OF_STUDY_TOPICS) {
    if (norm(k) === n) return k;
  }
  const legacy = LEGACY_TOPIC_MAP[n];
  if (legacy) return legacy;
  return null;
}

function routeSubtopicHeading(text: string): GeneralMathsAreaOfStudyTopic | null {
  const n = norm(text);
  if (!n) return null;
  for (const { re, topic } of SUBTOPIC_ROUTE) {
    if (re.test(n)) return topic;
  }
  return null;
}

function scoreFromText(sIn: string): Record<GeneralMathsAreaOfStudyTopic, number> {
  const s = sIn.toLowerCase();
  const n = (re: RegExp, w = 2) => (re.test(s) ? w : 0);

  const data =
    n(/\btime\s+series\b|\bseasonal\b|\bmoving\s+average\b|\bdeseasonal/i, 4) +
    n(/\bscatter\s*plot\b|\bcorrelation\b|\br\s*=\s*[-0-9.]+|\bregression\b|\bresiduals?\b/i, 4) +
    n(/\bbox\s*plot\b|\binterquartile\b|\biqr\b|\bfive[-\s]?number\b|\boutlier\b/i, 3) +
    n(/\bhistogram\b|\bstem[-\s]?and[-\s]?leaf|\bcategorical\b|\bdiscrete\s+data\b|\bcontinuous\s+data\b/i, 2) +
    n(/\bstandard\s+deviation\b|\bmean\b|\bmedian\b|\bmode\b|\bquartiles?\b/i, 2) +
    n(/\bextrapolation\b|\binterpolation\b|\bline\s+of\s+(?:best\s+)?fit\b/i, 3) +
    n(/\btransform(?:ation)?s?\s+to\s+linearity\b|\blog\s*scale\b/i, 2);

  const recursion =
    n(/\bcompound\s+interest\b|\bA\s*=\s*P\s*\(\s*1\s*\+\s*r\s*\)/i, 5) +
    n(/\brecurrence\s+relation\b|\bfirst[-\s]?order\b|\bexplicit\s+rule\b/i, 4) +
    n(/\barithmetic\s+sequence\b|\bgeometric\s+sequence\b|\bcommon\s+(?:difference|ratio)\b/i, 4) +
    n(/\bannuit|\bperpetuit|\breducing[-\s]?balance\s+loan\b|\bloan\s+balance\b/i, 4) +
    n(/\bdepreciat|\bflat[-\s]?rate\b|\binvestment\b|\bregular\s+deposit\b/i, 3) +
    n(/\binterest\s+rate\b|\brepayment\b|\bprincipal\b/i, 2);

  const matrices =
    n(/\btransition\s+matrix\b|\bleslie\s+matrix\b|\bsteady\s+state\b|\bmarkov\b/i, 5) +
    n(/\bmatrix\s+multiplication\b|\bidentity\s+matrix\b|\binverse\s+matrix\b/i, 4) +
    n(/\bmatrices\b|\bmatrix\b|\bscalar\s+multiple\b/i, 3) +
    n(/\b\d\s*×\s*\d\b|\brow\s+by\s+column\b|\border\s+of\s+a\s+matrix\b/i, 2);

  const networks =
    n(/\bminimum\s+spanning\s+tree\b|\bkruskal\b|\bprim\b/i, 5) +
    n(/\bdijkstra\b|\bshortest\s+path\b/i, 4) +
    n(/\beulerian\b|\bhamiltonian\b/i, 4) +
    n(/\bcritical\s+path\b|\bfloat\b|\bslack\b|\bearliest\s+start\b|\blatest\s+start\b/i, 5) +
    n(/\bspanning\s+tree\b|\bweighted\s+graph\b|\bvertex\b|\bedge\b|\bdegree\s+of\b/i, 2) +
    n(/\bbipartite\b|\bmatching\b|\bscheduling\b/i, 3);

  return {
    "Data analysis": Math.max(0, data),
    "Recursion and financial modelling": Math.max(0, recursion),
    Matrices: Math.max(0, matrices),
    "Networks and decision mathematics": Math.max(0, networks),
  };
}

const TIE_PRIORITY: GeneralMathsAreaOfStudyTopic[] = [
  "Networks and decision mathematics",
  "Matrices",
  "Recursion and financial modelling",
  "Data analysis",
];

function pickBestPositive(
  scores: Record<GeneralMathsAreaOfStudyTopic, number>,
): GeneralMathsAreaOfStudyTopic | null {
  let max = 0;
  for (const k of GENERAL_MATHS_AREA_OF_STUDY_TOPICS) {
    if (scores[k] > max) max = scores[k];
  }
  if (max <= 0) return null;
  for (const k of TIE_PRIORITY) {
    if (scores[k] === max) return k;
  }
  return null;
}

function legacySheetLabel(topicRaw: string): GeneralMathsAreaOfStudyTopic | null {
  const n = norm(stripGeneralMathsUnitPrefix(topicRaw));
  if (!n || n === "general") return null;
  if (LEGACY_TOPIC_MAP[n]) return LEGACY_TOPIC_MAP[n];
  if (TITLE_ALIASES[n]) return TITLE_ALIASES[n];

  if (/^statistics|^stat\b|data\s+analysis|scatter|correlation|regression|box\s*plot|time\s+series/.test(n)) {
    return "Data analysis";
  }
  if (/finance|recursion|sequence|interest|depreciation|annuit|loan|investment|compound/.test(n)) {
    return "Recursion and financial modelling";
  }
  if (/^matrix|matrices|transition|leslie/.test(n)) {
    return "Matrices";
  }
  if (/network|spanning|euler|hamilton|dijkstra|critical\s+path|graph\s+theory|vertex|vertices/.test(n)) {
    return "Networks and decision mathematics";
  }
  return null;
}

/**
 * Assign every General Mathematics question one of the four Units 3 & 4 topics.
 */
export function inferGeneralMathsAreaOfStudy(
  rawTopic: unknown,
  question: string,
  passage?: string,
): GeneralMathsAreaOfStudyTopic {
  const topicRaw = String(rawTopic ?? "").trim();
  const stripped = stripGeneralMathsUnitPrefix(topicRaw);

  const direct = canonicalMatch(topicRaw) ?? canonicalMatch(stripped);
  if (direct) return direct;

  const alias = TITLE_ALIASES[norm(stripped)] ?? TITLE_ALIASES[norm(topicRaw)];
  if (alias) return alias;

  const fromHeading =
    routeSubtopicHeading(stripped) ?? routeSubtopicHeading(topicRaw);
  if (fromHeading) return fromHeading;

  const fromLegacy = legacySheetLabel(topicRaw);
  if (fromLegacy) return fromLegacy;

  const blob = `${topicRaw}\n${question}\n${passage ?? ""}`;
  const fromBlob = pickBestPositive(scoreFromText(blob));
  if (fromBlob) return fromBlob;

  const fromBody = pickBestPositive(scoreFromText(`${question}\n${passage ?? ""}`));
  if (fromBody) return fromBody;

  return "Data analysis";
}

/** Canonical Units 3 & 4 labels for practice / quiz topic filters (`all` + four topics). */
export function generalMathsPracticeTopicOptions(): string[] {
  return ["all", ...GENERAL_MATHS_AREA_OF_STUDY_TOPICS];
}
