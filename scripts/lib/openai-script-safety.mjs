export function assertLiveOpenAiScript(feature, envName = "AI_ALLOW_LIVE_SCRIPTS") {
  const optedIn = process.argv.includes("--allow-live-ai") && /^(1|true|yes)$/i.test(process.env[envName] || "");
  if (!optedIn) {
    throw new Error(`${feature} can spend real API credit. Re-run with --allow-live-ai and ${envName}=1.`);
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function openAiScriptFetch(url, init, { feature, maxAttempts = 2, timeoutMs = 45_000 } = {}) {
  let lastError;
  let response;
  for (let attempt = 0; attempt < Math.max(1, Math.min(2, maxAttempts)); attempt += 1) {
    const started = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      response = await fetch(url, { ...init, signal: controller.signal });
      const body = JSON.parse(String(init?.body || "{}"));
      const model = String(body.model || "unknown");
      let usage = {};
      try { usage = (await response.clone().json())?.usage || {}; } catch { /* no usage metadata */ }
      const inputTokens = Number(usage.prompt_tokens || usage.input_tokens || 0);
      const cachedInputTokens = Number(usage.prompt_tokens_details?.cached_tokens || usage.cached_input_tokens || 0);
      const outputTokens = Number(usage.completion_tokens || usage.output_tokens || 0);
      const totalTokens = Number(usage.total_tokens || inputTokens + outputTokens);
      const modelLc = model.toLowerCase();
      const rates = modelLc.includes("gpt-4o-mini")
        ? { input: 0.15, cached: 0.075, output: 0.6 }
        : modelLc.startsWith("gpt-4o")
          ? { input: 2.5, cached: 1.25, output: 10 }
          : { input: 5, cached: 2.5, output: 20 };
      const tokenCost = ((Math.max(0, inputTokens - cachedInputTokens) * rates.input) +
        (cachedInputTokens * rates.cached) + (outputTokens * rates.output)) / 1_000_000;
      const imageCost = url.includes("/images/generations")
        ? modelLc.includes("dall-e-2") ? 0.02 : modelLc.includes("dall-e-3") ? 0.04 : 0.08
        : 0;
      const estimatedCostUsd = tokenCost + imageCost;
      console.log(JSON.stringify({
        event: "ai_request", timestamp: new Date().toISOString(), route: "manual_script",
        feature: feature || "unknown", userId: "manual", provider: "openai", model,
        inputTokens, cachedInputTokens, outputTokens, totalTokens,
        latencyMs: Date.now() - started, success: response.ok, estimatedCostUsd,
        ...(response.ok ? {} : { errorCode: `http_${response.status}` }),
      }));
      const retryable = [408, 409, 429, 500, 502, 503, 504].includes(response.status);
      if (response.ok || !retryable || attempt === 1) return response;
    } catch (error) {
      lastError = error;
      console.log(JSON.stringify({
        event: "ai_request", timestamp: new Date().toISOString(), route: "manual_script",
        feature: feature || "unknown", userId: "manual", provider: "openai", model: "unknown",
        inputTokens: 0, cachedInputTokens: 0, outputTokens: 0, totalTokens: 0,
        latencyMs: Date.now() - started, success: false, estimatedCostUsd: 0,
        errorCode: error?.name === "AbortError" ? "timeout" : "request_failed",
      }));
      if (attempt === 1) throw error;
    } finally {
      clearTimeout(timeout);
    }
    await sleep(500 * 2 ** attempt);
  }
  if (response) return response;
  throw lastError || new Error("OpenAI request failed.");
}
