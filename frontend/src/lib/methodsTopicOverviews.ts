import raw from "./data/methodsTopicOverviews.raw.json";

export type MethodsTopicOverviewMap = Record<string, string>;

export const METHODS_TOPIC_OVERVIEWS: MethodsTopicOverviewMap = raw;

const FUZZY_SKIP_KEYS = new Set<string>(["General Maths 34 September Lecture"]);

/**
 * Coarse topic labels from Sheets / filters → closest lecture-note key in the bundle.
 * Adjust when your sheet topic wording changes.
 */
const METHODS_SHEET_TOPIC_DEFAULTS: Record<string, string> = {
  calculus: "Composite Functions",
  "functions & graphs": "Key Features of Graphs",
  trigonometry: "Circular Functions",
  algebra: "Polynomial Equations",
  probability: "Binomial Distribution",
  functions: "Composite Functions",
  graphs: "Key Features of Graphs",
};

function norm(s: string) {
  return String(s ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function significantWords(s: string): string[] {
  const STOP = new Set([
    "the",
    "and",
    "for",
    "from",
    "with",
    "that",
    "this",
    "into",
    "are",
    "was",
  ]);
  return norm(s)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1 && !STOP.has(w));
}

function fixOddApostrophes(text: string) {
  return text.replace(/\bEuler s\b/g, "Euler's").replace(/\bNewton s\b/g, "Newton's");
}

function scoreTopicToKey(topic: string, key: string): number {
  const t = norm(topic);
  const k = norm(key);
  if (t === k) return 100_000;
  if (t.length >= 4 && (k.includes(t) || t.includes(k))) return 50_000 + Math.min(t.length, k.length);
  const tw = significantWords(topic);
  const kwArr = significantWords(key);
  const kws = new Set(kwArr);

  let score = 0;
  for (const w of tw) {
    if (kws.has(w)) {
      score += 1_000;
      continue;
    }
    for (const kw2 of kwArr) {
      if (kw2.includes(w) || w.includes(kw2)) {
        score += 400;
        break;
      }
    }
  }
  return score;
}

export function resolveMethodsOverviewKey(topic: string): string | null {
  const t = norm(topic);
  if (!t || t === "all") return null;

  const sheetDefault = METHODS_SHEET_TOPIC_DEFAULTS[t];
  if (sheetDefault && METHODS_TOPIC_OVERVIEWS[sheetDefault]) return sheetDefault;

  let bestKey: string | null = null;
  let best = -1;
  for (const key of Object.keys(METHODS_TOPIC_OVERVIEWS)) {
    if (FUZZY_SKIP_KEYS.has(key)) continue;
    const s = scoreTopicToKey(topic, key);
    if (s > best) {
      best = s;
      bestKey = key;
    }
  }

  if (!bestKey) return null;

  // Avoid weak accidental matches for very short or generic topics unless exact/substring already handled.
  if (best < 100_000) {
    const tw = significantWords(topic);
    if (tw.length >= 2 && best < 800) return null;
    if (tw.length === 1 && best < 400) return null;
  }

  return bestKey;
}

export function getMethodsTopicOverviewMarkdown(topic: string): string | null {
  const key = resolveMethodsOverviewKey(topic);
  if (!key) return null;
  const body = METHODS_TOPIC_OVERVIEWS[key];
  if (!body) return null;
  return fixOddApostrophes(body);
}
