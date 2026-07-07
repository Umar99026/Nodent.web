/**
 * Quick connectivity check for AI keys in .dev.vars (run: node scripts/test-ai-keys.mjs)
 */
import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envText = readFileSync(resolve(root, ".dev.vars"), "utf8");
const env = Object.fromEntries(
  envText
    .split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i).trim(), line.slice(i + 1).trim()];
    }),
);

function mask(key) {
  if (!key) return "(missing)";
  if (key.length <= 8) return "***";
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

async function testGemini(name, apiKey, model) {
  if (!apiKey) return { name, ok: false, detail: "not set" };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: 'Reply with JSON only: {"ok":true}' }] }],
      generationConfig: { temperature: 0, responseMimeType: "application/json", maxOutputTokens: 16 },
    }),
  });
  const text = await res.text();
  if (!res.ok) return { name, ok: false, detail: `HTTP ${res.status}: ${text.slice(0, 120)}` };
  return { name, ok: true, detail: `model ${model}` };
}

async function testGroq(name, apiKey, model) {
  if (!apiKey) return { name, ok: false, detail: "not set" };
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: 'Reply with JSON only: {"ok":true}' }],
      max_tokens: 16,
      temperature: 0,
      response_format: { type: "json_object" },
    }),
  });
  const text = await res.text();
  if (!res.ok) return { name, ok: false, detail: `HTTP ${res.status}: ${text.slice(0, 120)}` };
  return { name, ok: true, detail: `model ${model}` };
}

async function testOpenAi(name, apiKey, model) {
  if (!apiKey) return { name, ok: false, detail: "not set" };
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: 'Reply with JSON only: {"ok":true}' }],
      max_tokens: 16,
      temperature: 0,
      response_format: { type: "json_object" },
    }),
  });
  const text = await res.text();
  if (!res.ok) return { name, ok: false, detail: `HTTP ${res.status}: ${text.slice(0, 120)}` };
  return { name, ok: true, detail: `model ${model}` };
}

const geminiModel = env.GEMINI_MODEL || "gemini-2.5-flash";
const groqModel = env.GROQ_MODEL || "llama-3.1-8b-instant";
const openaiModel = env.OPENAI_ENGLISH_MODEL || "gpt-4o-mini";

console.log("AI key check (.dev.vars)\n");

const checks = await Promise.all([
  testGemini("GEMINI_API_KEY", env.GEMINI_API_KEY, geminiModel),
  testGemini("GEMINI_API_KEY_2", env.GEMINI_API_KEY_2, geminiModel),
  testGroq("GROQ_API_KEY_1", env.GROQ_API_KEY_1 ?? env.GROQ_API_KEY, groqModel),
  testGroq("GROQ_API_KEY_2", env.GROQ_API_KEY_2, groqModel),
  testOpenAi("OPENAI_API_KEY", env.OPENAI_API_KEY, openaiModel),
]);

for (const c of checks) {
  const icon = c.ok ? "OK" : "FAIL";
  console.log(`[${icon}] ${c.name} (${mask(env[c.name] ?? env.GROQ_API_KEY)}) — ${c.detail}`);
}

const poolSize = [
  env.GEMINI_API_KEY,
  env.GEMINI_API_KEY_2,
  env.GROQ_API_KEY_1 ?? env.GROQ_API_KEY,
  env.GROQ_API_KEY_2,
].filter((k) => String(k ?? "").trim()).length;

console.log(`\nMarking pool size: ${poolSize} providers (Gemini + Groq)`);
console.log(`Free long-answer/handwriting daily limit: ${3 * poolSize} each`);
console.log(`English essays: OpenAI only, 1 free every 3 days`);

const failed = checks.filter((c) => !c.ok).length;
process.exit(failed > 0 ? 1 : 0);
