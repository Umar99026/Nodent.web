/**
 * English essay marking via OpenAI (gpt-4o-mini by default).
 * Kept separate from Gemini/Grok marking to control cost per essay.
 *
 * Env:
 *   OPENAI_API_KEY          (required for English essay marking)
 *   OPENAI_ENGLISH_MODEL    (optional, default gpt-4o-mini)
 *
 * Cost controls (~fractions of a cent per essay on gpt-4o-mini):
 *   - Cheap model, low temperature
 *   - Truncated prompt/essay input
 *   - Tight max output tokens
 *   - Short feedback strings in the response schema
 */

import { formatSubjectMarkingContextBlock, type SubjectMarkingContext } from "./openai";

export type EnglishOpenAiEnv = {
  OPENAI_API_KEY?: string;
  OPENAI_ENGLISH_MODEL?: string;
};

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_ENGLISH_MODEL = "gpt-4o-mini";

/** ~$0.001 or less per essay on gpt-4o-mini at typical essay lengths. */
const MAX_OUTPUT_TOKENS = 380;
const MAX_PROMPT_CHARS = 1200;
const MAX_ESSAY_CHARS = 3500;
const MAX_SUMMARY_CHARS = 400;
const MAX_CRITERION_FEEDBACK_CHARS = 220;
const MAX_HIGHLIGHT_FEEDBACK_CHARS = 180;
const MAX_HIGHLIGHTS = 4;

function trim(s: string | undefined): string {
  return String(s ?? "").trim();
}

export function englishAiConfigured(env: EnglishOpenAiEnv): boolean {
  return !!trim(env.OPENAI_API_KEY);
}

export function englishAiModel(env: EnglishOpenAiEnv): string {
  return trim(env.OPENAI_ENGLISH_MODEL) || DEFAULT_ENGLISH_MODEL;
}

function requireEnglishApiKey(env: EnglishOpenAiEnv): string {
  const key = trim(env.OPENAI_API_KEY);
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");
  return key;
}

export type EnglishCriterionKey = "structure" | "evidence" | "expression" | "relevance";

export type EnglishCriterionScore = {
  score: number;
  feedback: string;
};

export type EnglishHighlight = {
  quote: string;
  type: "strength" | "improvement";
  criterion?: EnglishCriterionKey;
  feedback: string;
};

export type EnglishScoreInput = {
  promptText: string;
  responseText: string;
  subjectContext?: SubjectMarkingContext;
};

export type EnglishScoreResult = {
  score: number;
  summary: string;
  criteria: Record<EnglishCriterionKey, EnglishCriterionScore>;
  highlights: EnglishHighlight[];
};

const ENGLISH_CRITERIA_RUBRIC =
  "Score structure, evidence, expression, relevance (each 0-10, one short sentence feedback). Overall score 0-10. Up to 4 highlights with exact quotes.";

function clampCriterionScore(raw: unknown): number {
  return Math.min(10, Math.max(0, Math.round(Number(raw ?? 0))));
}

function parseCriterionRow(raw: unknown): EnglishCriterionScore {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    score: clampCriterionScore(row.score),
    feedback: String(row.feedback ?? "").trim().slice(0, MAX_CRITERION_FEEDBACK_CHARS),
  };
}

function parseEnglishHighlights(raw: unknown): EnglishHighlight[] {
  if (!Array.isArray(raw)) return [];
  const validCriteria = new Set<EnglishCriterionKey>([
    "structure",
    "evidence",
    "expression",
    "relevance",
  ]);
  return raw
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const row = item as Record<string, unknown>;
      const quote = String(row.quote ?? "").trim().slice(0, 300);
      const typeRaw = String(row.type ?? "").trim().toLowerCase();
      const type = typeRaw === "strength" ? "strength" : typeRaw === "improvement" ? "improvement" : null;
      if (!quote || !type) return null;
      const criterionRaw = String(row.criterion ?? "").trim().toLowerCase() as EnglishCriterionKey;
      const criterion = validCriteria.has(criterionRaw) ? criterionRaw : undefined;
      const feedback = String(row.feedback ?? "").trim().slice(0, MAX_HIGHLIGHT_FEEDBACK_CHARS);
      if (!feedback) return null;
      return { quote, type, criterion, feedback };
    })
    .filter((h): h is EnglishHighlight => h != null)
    .slice(0, MAX_HIGHLIGHTS);
}

async function openAiChatJson(
  apiKey: string,
  model: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
): Promise<Record<string, unknown>> {
  const res = await fetch(OPENAI_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      max_tokens: MAX_OUTPUT_TOKENS,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error (${res.status}): ${errText.slice(0, 600)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[];
    error?: { message?: string };
  };
  if (data.error?.message) {
    throw new Error(`OpenAI error: ${String(data.error.message).slice(0, 600)}`);
  }

  const content = String(data.choices?.[0]?.message?.content ?? "").trim();
  if (!content) throw new Error("OpenAI returned an empty response.");

  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error("OpenAI returned invalid JSON.");
  }
}

export async function scoreEnglishResponse(
  env: EnglishOpenAiEnv,
  input: EnglishScoreInput,
): Promise<EnglishScoreResult> {
  const apiKey = requireEnglishApiKey(env);
  const model = englishAiModel(env);
  const promptText = String(input.promptText ?? "").trim().slice(0, MAX_PROMPT_CHARS);
  const responseText = String(input.responseText ?? "").trim().slice(0, MAX_ESSAY_CHARS);

  const parsed = await openAiChatJson(apiKey, model, [
    {
      role: "system",
      content: `VCE English essay assessor. ${ENGLISH_CRITERIA_RUBRIC}${formatSubjectMarkingContextBlock(input.subjectContext)}
Return compact JSON only: {"score":0-10,"summary":"max 2 short sentences","criteria":{"structure":{"score":0-10,"feedback":"one sentence"},"evidence":{...},"expression":{...},"relevance":{...}},"highlights":[{"quote":"exact substring","type":"strength"|"improvement","criterion":"structure"|...,"feedback":"one sentence"}]}`,
    },
    {
      role: "user",
      content: JSON.stringify({
        prompt: promptText || "(No prompt — assess on its own terms.)",
        response: responseText,
      }),
    },
  ]);

  const criteria = {
    structure: parseCriterionRow((parsed.criteria as Record<string, unknown> | undefined)?.structure),
    evidence: parseCriterionRow((parsed.criteria as Record<string, unknown> | undefined)?.evidence),
    expression: parseCriterionRow((parsed.criteria as Record<string, unknown> | undefined)?.expression),
    relevance: parseCriterionRow((parsed.criteria as Record<string, unknown> | undefined)?.relevance),
  };
  const score = Math.min(10, Math.max(0, Math.round(Number(parsed.score ?? 0))));
  return {
    score,
    summary: String(parsed.summary ?? parsed.feedback ?? "").trim().slice(0, MAX_SUMMARY_CHARS),
    criteria,
    highlights: parseEnglishHighlights(parsed.highlights),
  };
}
