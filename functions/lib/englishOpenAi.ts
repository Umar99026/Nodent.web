/**
 * English essay marking via Gemini, with OpenAI as a fallback.
 *
 * Env:
 *   GEMINI_API_KEY          (preferred)
 *   GEMINI_API_KEY_2        (optional fallback Gemini key)
 *   GEMINI_ENGLISH_MODEL    (optional, default gemini-2.5-flash)
 *   OPENAI_API_KEY          (optional fallback provider)
 *   OPENAI_ENGLISH_MODEL    (optional, default gpt-4o-mini)
 *
 * Cost controls (~fractions of a cent per essay on gpt-4o-mini):
 *   - Cheap model, low temperature
 *   - Truncated prompt/essay input
 *   - Tight max output tokens
 *   - Short feedback strings in the response schema
 */

import { formatSubjectMarkingContextBlock, type SubjectMarkingContext } from "./openai";
import { aiLiveCallsDisabled, aiRequestTimeoutMs, type AiSafetyEnv } from "./aiSafety";

export type EnglishOpenAiEnv = AiSafetyEnv & {
  GEMINI_API_KEY?: string;
  GEMINI_API_KEY_2?: string;
  GEMINI_ENGLISH_MODEL?: string;
  OPENAI_API_KEY?: string;
  OPENAI_ENGLISH_MODEL?: string;
  OPENAI_INPUT_USD_PER_MILLION?: string;
  OPENAI_CACHED_INPUT_USD_PER_MILLION?: string;
  OPENAI_OUTPUT_USD_PER_MILLION?: string;
};

const OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_ENGLISH_MODEL = "gpt-4o-mini";
const DEFAULT_GEMINI_ENGLISH_MODEL = "gemini-2.5-flash";

/** ~$0.001 or less per essay on gpt-4o-mini at typical essay lengths. */
const MAX_OUTPUT_TOKENS = 900;
const MAX_PROMPT_CHARS = 1200;
const MAX_ESSAY_CHARS = 3500;
const MAX_SUMMARY_CHARS = 400;
const MAX_CRITERION_FEEDBACK_CHARS = 220;
const MAX_HIGHLIGHT_FEEDBACK_CHARS = 180;
const MAX_HIGHLIGHTS = 6;

const ENGLISH_RESPONSE_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "integer", minimum: 0, maximum: 10 },
    summary: { type: "string" },
    criteria: {
      type: "object",
      properties: {
        structure: { $ref: "#/$defs/criterion" },
        evidence: { $ref: "#/$defs/criterion" },
        expression: { $ref: "#/$defs/criterion" },
        relevance: { $ref: "#/$defs/criterion" },
      },
      required: ["structure", "evidence", "expression", "relevance"],
    },
    highlights: {
      type: "array",
      maxItems: MAX_HIGHLIGHTS,
      items: {
        type: "object",
        properties: {
          quote: { type: "string" },
          type: { type: "string", enum: ["strength", "improvement"] },
          criterion: {
            type: "string",
            enum: ["structure", "evidence", "expression", "relevance"],
          },
          feedback: { type: "string" },
        },
        required: ["quote", "type", "criterion", "feedback"],
      },
    },
  },
  required: ["score", "summary", "criteria", "highlights"],
  $defs: {
    criterion: {
      type: "object",
      properties: {
        score: { type: "integer", minimum: 0, maximum: 10 },
        feedback: { type: "string" },
      },
      required: ["score", "feedback"],
    },
  },
} as const;

function trim(s: string | undefined): string {
  return String(s ?? "").trim();
}

function parseProviderJson(content: string, provider: string): Record<string, unknown> {
  const cleaned = String(content ?? "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const candidates = [cleaned];
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
  }
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try the extracted object before reporting a provider-format error.
    }
  }
  throw new Error(`${provider} returned invalid English marking JSON.`);
}

export function englishAiConfigured(env: EnglishOpenAiEnv): boolean {
  return !!trim(env.GEMINI_API_KEY) || !!trim(env.GEMINI_API_KEY_2) || !!trim(env.OPENAI_API_KEY);
}

export function englishAiModel(env: EnglishOpenAiEnv): string {
  return trim(env.OPENAI_ENGLISH_MODEL) || DEFAULT_ENGLISH_MODEL;
}

export function englishAiReservationDetails(env: EnglishOpenAiEnv): {
  provider: "gemini" | "openai";
  model: string;
} {
  if (trim(env.GEMINI_API_KEY) || trim(env.GEMINI_API_KEY_2)) {
    return {
      provider: "gemini",
      model: trim(env.GEMINI_ENGLISH_MODEL) || DEFAULT_GEMINI_ENGLISH_MODEL,
    };
  }
  return { provider: "openai", model: englishAiModel(env) };
}

/** A useful user-facing category without leaking provider payloads or credentials. */
export function englishAiUserMessage(error: unknown): string {
  const message = String(error instanceof Error ? error.message : error);
  if (/abort|timeout/i.test(message)) {
    return "Essay marking timed out. Please retry.";
  }
  if (/\b429\b|quota|rate.?limit|capacity|overload/i.test(message)) {
    return "Essay marking is temporarily at capacity. Please retry shortly.";
  }
  if (/\b(401|403)\b|api.?key|permission/i.test(message)) {
    return "Essay marking is temporarily unavailable because its AI connection was rejected.";
  }
  if (/\b404\b|model.+(?:missing|not found|unavailable)/i.test(message)) {
    return "The configured essay-marking model is temporarily unavailable.";
  }
  if (/invalid.+json|empty.+response|max_tokens|finish reason/i.test(message)) {
    return "The AI could not finish a valid essay mark. Please retry.";
  }
  return "Essay marking failed. Please retry.";
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

export type EnglishAiTelemetry = {
  timestamp: string;
  route: string;
  feature: string;
  userId: number;
  provider: "openai";
  model: string;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  totalTokens: number;
  latencyMs: number;
  success: boolean;
  estimatedCostUsd: number;
  errorCode?: string;
};

export type EnglishAiRequestContext = {
  route: string;
  feature: string;
  userId: number;
  onOpenAiRequest?: (event: EnglishAiTelemetry) => void;
};

export type EnglishScoreResult = {
  score: number;
  summary: string;
  criteria: Record<EnglishCriterionKey, EnglishCriterionScore>;
  highlights: EnglishHighlight[];
};

const ENGLISH_CRITERIA_RUBRIC =
  "Score structure, evidence, expression, and relevance (each 0-10, with concise actionable feedback). Overall score 0-10. Return 4-6 exact-quote highlights. Unless the response is too short to support them, include at least 2 strengths AND at least 2 improvements. Improvement highlights must identify a specific weakness and explain how to revise it. A response containing only strengths is invalid.";

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
  env: EnglishOpenAiEnv,
  apiKey: string,
  model: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  context?: EnglishAiRequestContext,
): Promise<Record<string, unknown>> {
  if (aiLiveCallsDisabled(env)) throw new Error("AI calls are disabled in this environment.");
  const approximateInputTokens = Math.ceil(
    messages.reduce((sum, message) => sum + message.content.length, 0) / 4,
  );
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), aiRequestTimeoutMs(env));
    let status = 0;
    try {
      const res = await fetch(OPENAI_CHAT_URL, {
        method: "POST",
        signal: controller.signal,
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
      status = res.status;
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`OpenAI error (${res.status}): ${errText.slice(0, 300)}`);
      }
      const data = (await res.json()) as {
        choices?: { message?: { content?: string | null } }[];
        error?: { message?: string };
        usage?: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          prompt_tokens_details?: { cached_tokens?: number };
        };
      };
      if (data.error?.message) throw new Error(`OpenAI error: ${String(data.error.message).slice(0, 300)}`);
      const content = String(data.choices?.[0]?.message?.content ?? "").trim();
      if (!content) throw new Error("OpenAI returned an empty response.");
      const parsed = parseProviderJson(content, "OpenAI");
      const inputTokens = Number(data.usage?.prompt_tokens ?? approximateInputTokens);
      const cachedInputTokens = Number(data.usage?.prompt_tokens_details?.cached_tokens ?? 0);
      const outputTokens = Number(data.usage?.completion_tokens ?? Math.ceil(content.length / 4));
      const totalTokens = Number(data.usage?.total_tokens ?? inputTokens + outputTokens);
      emitOpenAiTelemetry(env, context, {
        model, inputTokens, cachedInputTokens, outputTokens, totalTokens,
        latencyMs: Date.now() - started, success: true,
      });
      return parsed;
    } catch (error) {
      lastError = error;
      emitOpenAiTelemetry(env, context, {
        model,
        inputTokens: approximateInputTokens,
        cachedInputTokens: 0,
        outputTokens: 0,
        totalTokens: approximateInputTokens,
        latencyMs: Date.now() - started,
        success: false,
        errorCode: error instanceof DOMException && error.name === "AbortError"
          ? "timeout"
          : status ? `http_${status}` : "request_failed",
      });
      const retryable = status === 408 || status === 409 || status === 429 || status >= 500 ||
        (error instanceof DOMException && error.name === "AbortError");
      if (!retryable || attempt === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** attempt));
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("OpenAI request failed.");
}

function price(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function emitOpenAiTelemetry(
  env: EnglishOpenAiEnv,
  context: EnglishAiRequestContext | undefined,
  usage: Omit<EnglishAiTelemetry, "timestamp" | "route" | "feature" | "userId" | "provider" | "estimatedCostUsd">,
): void {
  const modelLc = usage.model.toLowerCase();
  const defaults = modelLc.includes("gpt-4o-mini")
    ? { input: 0.15, cached: 0.075, output: 0.6 }
    : modelLc.startsWith("gpt-4o")
      ? { input: 2.5, cached: 1.25, output: 10 }
      : { input: 5, cached: 2.5, output: 20 };
  const uncachedInput = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  const estimatedCostUsd =
    (uncachedInput * price(env.OPENAI_INPUT_USD_PER_MILLION, defaults.input) +
      usage.cachedInputTokens * price(env.OPENAI_CACHED_INPUT_USD_PER_MILLION, defaults.cached) +
      usage.outputTokens * price(env.OPENAI_OUTPUT_USD_PER_MILLION, defaults.output)) / 1_000_000;
  const event: EnglishAiTelemetry = {
    timestamp: new Date().toISOString(),
    route: context?.route ?? "unknown",
    feature: context?.feature ?? "english_marking",
    userId: context?.userId ?? 0,
    provider: "openai",
    ...usage,
    estimatedCostUsd,
  };
  console.log(JSON.stringify({ event: "ai_request", ...event }));
  context?.onOpenAiRequest?.(event);
}

async function geminiChatJson(
  env: EnglishOpenAiEnv,
  apiKey: string,
  model: string,
  messages: { role: "system" | "user" | "assistant"; content: string }[],
): Promise<Record<string, unknown>> {
  if (aiLiveCallsDisabled(env)) throw new Error("AI calls are disabled in this environment.");
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n");
  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), aiRequestTimeoutMs(env));
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          responseMimeType: "application/json",
          responseJsonSchema: ENGLISH_RESPONSE_SCHEMA,
          // Gemini 2.5 otherwise uses dynamic hidden thinking, which can consume the
          // entire capped output budget before producing the JSON the user needs.
          thinkingConfig: /^gemini-2\.5-/i.test(model) ? { thinkingBudget: 0 } : undefined,
        },
      }),
    },
  ).finally(() => clearTimeout(timeout));

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Gemini English error (${res.status}): ${detail.slice(0, 600)}`);
  }
  const data = (await res.json()) as {
    candidates?: {
      finishReason?: string;
      content?: { parts?: { text?: string }[] };
    }[];
    error?: { message?: string };
  };
  if (data.error?.message) throw new Error(`Gemini English error: ${data.error.message}`);
  const candidate = data.candidates?.[0];
  const content = candidate?.content?.parts
    ?.map((part) => String(part.text ?? "").trim())
    .filter(Boolean)
    .join("\n");
  if (!content) {
    throw new Error(
      `Gemini returned an empty English marking response (finish reason: ${candidate?.finishReason ?? "unknown"}).`,
    );
  }

  return parseProviderJson(content, "Gemini");
}

type EnglishChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

async function callEnglishProvider(
  env: EnglishOpenAiEnv,
  messages: EnglishChatMessage[],
  context?: EnglishAiRequestContext,
): Promise<Record<string, unknown>> {
  const geminiKeys = [
    ...new Set([trim(env.GEMINI_API_KEY), trim(env.GEMINI_API_KEY_2)].filter(Boolean)),
  ];
  let lastGeminiError: unknown;
  const preferredGeminiModel = trim(env.GEMINI_ENGLISH_MODEL) || DEFAULT_GEMINI_ENGLISH_MODEL;
  for (let index = 0; index < geminiKeys.length; index += 1) {
    const apiKey = geminiKeys[index]!;
    try {
      return await geminiChatJson(
        env,
        apiKey,
        preferredGeminiModel,
        messages,
      );
    } catch (error) {
      lastGeminiError = error;
      const message = String(error instanceof Error ? error.message : error);
      const retryable = /\b(401|403|408|409|429|5\d\d)\b|quota|rate.?limit|overload|capacity|abort|timeout/i.test(message);
      if (!retryable || index === geminiKeys.length - 1) break;
      console.warn("[english-marking] Gemini key failed; trying the next configured key.");
    }
  }

  // One cheap, capped fallback model attempt handles a temporarily unavailable
  // primary model or an exhausted primary-model quota without an unbounded retry loop.
  const geminiFailure = String(
    lastGeminiError instanceof Error ? lastGeminiError.message : lastGeminiError ?? "",
  );
  const canTryLiteFallback = geminiKeys.length > 0 &&
    preferredGeminiModel === DEFAULT_GEMINI_ENGLISH_MODEL &&
    /\b(404|408|409|429|5\d\d)\b|quota|rate.?limit|overload|capacity|empty|invalid.+json|abort|timeout/i.test(geminiFailure);
  if (canTryLiteFallback) {
    try {
      return await geminiChatJson(env, geminiKeys[0]!, "gemini-2.5-flash-lite", messages);
    } catch (error) {
      lastGeminiError = error;
      console.warn("[english-marking] Gemini fallback model failed.");
    }
  }

  const openAiKey = trim(env.OPENAI_API_KEY);
  if (openAiKey) {
    return openAiChatJson(env, openAiKey, englishAiModel(env), messages, context);
  }
  throw lastGeminiError instanceof Error
    ? lastGeminiError
    : new Error("No English AI provider is configured.");
}

export async function scoreEnglishResponse(
  env: EnglishOpenAiEnv,
  input: EnglishScoreInput,
  context?: EnglishAiRequestContext,
): Promise<EnglishScoreResult> {
  const promptText = String(input.promptText ?? "").trim().slice(0, MAX_PROMPT_CHARS);
  const responseText = String(input.responseText ?? "").trim().slice(0, MAX_ESSAY_CHARS);

  const messages: EnglishChatMessage[] = [
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
  ];

  let parsed = await callEnglishProvider(env, messages, context);
  let highlights = parseEnglishHighlights(parsed.highlights);
  const hasStrength = highlights.some((highlight) => highlight.type === "strength");
  const hasImprovement = highlights.some((highlight) => highlight.type === "improvement");
  if (responseText.length >= 80 && (!hasStrength || !hasImprovement)) {
    // Keep the repair request narrow: resend only the bounded essay and ask for highlights,
    // rather than paying to resend the rubric, prompt, criteria, and first full response.
    try {
      const repaired = await callEnglishProvider(env, [
        {
          role: "system",
          content:
            "Return compact JSON only: {\"highlights\":[{\"quote\":\"exact substring\",\"type\":\"strength\"|\"improvement\",\"criterion\":\"structure\"|\"evidence\"|\"expression\"|\"relevance\",\"feedback\":\"one actionable sentence\"}]}. Include at least 2 strengths and 2 improvements.",
        },
        { role: "user", content: JSON.stringify({ response: responseText }) },
      ], context);
      const combined = [...highlights, ...parseEnglishHighlights(repaired.highlights)];
      const strengths = combined.filter((item) => item.type === "strength").slice(0, 3);
      const improvements = combined.filter((item) => item.type === "improvement").slice(0, 3);
      highlights = [...strengths, ...improvements].slice(0, MAX_HIGHLIGHTS);
    } catch (error) {
      // The core score and criterion feedback are still useful; a failed optional repair must
      // never leave the essay stuck in a pending state.
      console.warn("[english-marking] Optional highlight repair failed.",
        error instanceof Error ? error.message : "unknown error");
    }
  }

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
    highlights,
  };
}
