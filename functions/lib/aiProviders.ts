/**
 * Multi-provider AI pool — spreads marking across Gemini + Groq Cloud keys.
 *
 * Env (all optional beyond the first Gemini key):
 *   GEMINI_API_KEY
 *   GEMINI_API_KEY_2
 *   GROQ_API_KEY_1   (alias: GROQ_API_KEY)
 *   GROQ_API_KEY_2
 *   GROQ_MODEL       (default llama-3.1-8b-instant)
 */

export type AiProviderKind = "gemini" | "groq";

export type AiProvider = {
  kind: AiProviderKind;
  apiKey: string;
  id: string;
};

export type AiProviderEnv = {
  GEMINI_API_KEY?: string;
  GEMINI_API_KEY_2?: string;
  GROQ_API_KEY?: string;
  GROQ_API_KEY_1?: string;
  GROQ_API_KEY_2?: string;
  GROQ_MODEL?: string;
};

// Groq Cloud is OpenAI-compatible.
const GROQ_API_BASE = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_GROQ_MODEL = "llama-3.1-8b-instant";

function trim(s: string | undefined): string {
  return String(s ?? "").trim();
}

function pushUniqueKey(providers: AiProvider[], kind: AiProviderKind, key: string, id: string) {
  const k = trim(key);
  if (!k) return;
  if (providers.some((p) => p.apiKey === k)) return;
  providers.push({ kind, apiKey: k, id });
}

export function collectAiProviders(env: AiProviderEnv): AiProvider[] {
  const providers: AiProvider[] = [];
  pushUniqueKey(providers, "gemini", env.GEMINI_API_KEY, "gemini-1");
  pushUniqueKey(providers, "gemini", env.GEMINI_API_KEY_2, "gemini-2");
  pushUniqueKey(providers, "groq", env.GROQ_API_KEY_1 ?? env.GROQ_API_KEY, "groq-1");
  pushUniqueKey(providers, "groq", env.GROQ_API_KEY_2, "groq-2");
  return providers;
}

export function aiProviderPoolSize(env: AiProviderEnv): number {
  const n = collectAiProviders(env).length;
  return n > 0 ? n : 0;
}

export function groqModel(env: AiProviderEnv): string {
  return trim(env.GROQ_MODEL) || DEFAULT_GROQ_MODEL;
}

function isRetryableProviderError(err: unknown): boolean {
  const msg = String(err instanceof Error ? err.message : err ?? "").toLowerCase();
  return (
    msg.includes("429") ||
    msg.includes("quota") ||
    msg.includes("rate limit") ||
    msg.includes("rate_limit") ||
    msg.includes("resource_exhausted") ||
    msg.includes("overloaded") ||
    msg.includes("capacity")
  );
}

function pickStartIndex(providerCount: number): number {
  if (providerCount <= 1) return 0;
  return Math.floor(Math.random() * providerCount);
}

export async function withAiProviderPool<T>(
  env: AiProviderEnv,
  run: (provider: AiProvider, index: number) => Promise<T>,
): Promise<T> {
  const providers = collectAiProviders(env);
  if (!providers.length) {
    throw new Error("No AI provider keys configured (GEMINI_API_KEY or GROQ_API_KEY).");
  }

  const start = pickStartIndex(providers.length);
  let lastError: unknown;

  for (let offset = 0; offset < providers.length; offset++) {
    const provider = providers[(start + offset) % providers.length]!;
    try {
      return await run(provider, (start + offset) % providers.length);
    } catch (err) {
      lastError = err;
      const retryable = isRetryableProviderError(err);
      const hasMore = offset < providers.length - 1;
      if (!retryable || !hasMore) break;
      console.warn(`[aiProviders] ${provider.id} failed, trying next provider:`, err);
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError ?? "AI request failed."));
}

type GroqMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | { role: "user" | "assistant"; content: { type: "text"; text: string }[] };

async function groqChat(
  apiKey: string,
  model: string,
  messages: GroqMessage[],
  opts: { json?: boolean; maxTokens: number; temperature?: number },
): Promise<string> {
  const res = await fetch(GROQ_API_BASE, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens,
      ...(opts.json ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Groq error (${res.status}): ${errText.slice(0, 600)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string | null } }[];
    error?: { message?: string };
  };
  if (data.error?.message) {
    throw new Error(`Groq error: ${String(data.error.message).slice(0, 600)}`);
  }

  const content = String(data.choices?.[0]?.message?.content ?? "").trim();
  if (!content) throw new Error("Groq returned an empty response.");
  return content;
}

export async function groqGenerateJson(
  apiKey: string,
  model: string,
  messages: GroqMessage[],
  maxOutputTokens: number,
): Promise<Record<string, unknown>> {
  const content = await groqChat(apiKey, model, messages, {
    json: true,
    maxTokens: maxOutputTokens,
    temperature: 0.2,
  });
  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error("Groq returned invalid JSON.");
  }
}

export async function groqGenerateText(
  apiKey: string,
  model: string,
  messages: GroqMessage[],
  maxOutputTokens: number,
): Promise<string> {
  return groqChat(apiKey, model, messages, {
    json: false,
    maxTokens: maxOutputTokens,
    temperature: 0.35,
  });
}
