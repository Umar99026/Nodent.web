/**
 * Google Gemini + xAI Grok for Cloudflare Workers / Pages Functions.
 * Server-side only — never expose API keys to the browser.
 *
 * Active in production:
 *   - Handwriting marking (markHandwritingAnswer) — explain/discuss/prove-style only
 *   - Long-answer text marking (markLongAnswer) — explain/discuss/prove-style only
 *
 * English essays use OpenAI separately — see englishOpenAi.ts.
 *
 * Admin import helpers (questionGenerationChat, parseQuestionsFromText,
 * fillDraftQuestionAnswers) remain in this module but API routes return 503.
 *
 * Env:
 *   GEMINI_API_KEY, GEMINI_API_KEY_2
 *   GROQ_API_KEY_1 (alias GROQ_API_KEY), GROQ_API_KEY_2
 *   GEMINI_MODEL, GEMINI_VISION_MODEL, GROQ_MODEL
 */

import {
  aiProviderPoolSize,
  collectAiProviders,
  groqGenerateJson,
  groqGenerateText,
  groqModel,
  withAiProviderPool,
  type AiProviderEnv,
} from "./aiProviders";
import { aiLiveCallsDisabled, aiRequestTimeoutMs } from "./aiSafety";

export type OpenAiEnv = AiProviderEnv & {
  GEMINI_MODEL?: string;
  GEMINI_VISION_MODEL?: string;
};

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_VISION_MODEL = "gemini-2.5-flash";

/** Hard caps on model output tokens — keeps marking/help cheap. */
const OUTPUT_CAP_MARK = 512;
const OUTPUT_CAP_HANDWRITING = 640;
const OUTPUT_CAP_HELP = 220;
const MAX_HANDWRITING_IMAGES = 4;

function geminiGenerateContentUrl(model: string): string {
  return `${GEMINI_API_BASE}/models/${encodeURIComponent(model)}:generateContent`;
}

/** Native Gemini auth — header works for both legacy AIza and new AQ auth keys. */
function geminiRequestHeaders(apiKey: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-goog-api-key": apiKey,
  };
}

function trim(s: string | undefined): string {
  return String(s ?? "").trim();
}

async function providerFetch(env: OpenAiEnv, url: string, init: RequestInit): Promise<Response> {
  if (aiLiveCallsDisabled(env)) throw new Error("AI calls are disabled in this environment.");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), aiRequestTimeoutMs(env));
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timeout));
}

export function openAiConfigured(env: OpenAiEnv): boolean {
  return aiProviderPoolSize(env) > 0;
}

export { aiProviderPoolSize, collectAiProviders };

export function requireOpenAiKey(env: OpenAiEnv): string {
  const key = collectAiProviders(env)[0]?.apiKey;
  if (!key) throw new Error("GEMINI_API_KEY is not configured.");
  return key;
}

export function openAiModel(env: OpenAiEnv): string {
  return trim(env.GEMINI_MODEL) || DEFAULT_MODEL;
}

/** Vision-capable model for reading handwritten images. */
export function openAiVisionModel(env: OpenAiEnv): string {
  return trim(env.GEMINI_VISION_MODEL) || DEFAULT_VISION_MODEL;
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

type GeminiPart =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

type VisionContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string; detail?: "low" | "high" | "auto" } };

type VisionChatMessage = {
  role: "system" | "user" | "assistant";
  content: string | VisionContentPart[];
};

function parseDataUrl(url: string): { mimeType: string; data: string } | null {
  const match = String(url ?? "").trim().match(/^data:([^;]+);base64,(.+)$/i);
  if (!match) return null;
  return { mimeType: match[1]!, data: match[2]! };
}

function visionPartToGemini(part: VisionContentPart): GeminiPart | null {
  if (part.type === "text") {
    const text = String(part.text ?? "").trim();
    return text ? { text } : null;
  }
  const parsed = parseDataUrl(part.image_url.url);
  if (!parsed) return null;
  return { inlineData: { mimeType: parsed.mimeType, data: parsed.data } };
}

function splitGeminiMessages(messages: ChatMessage[]): {
  systemInstruction?: string;
  contents: { role: "user" | "model"; parts: GeminiPart[] }[];
} {
  const systemParts: string[] = [];
  const contents: { role: "user" | "model"; parts: GeminiPart[] }[] = [];

  for (const message of messages) {
    const text = String(message.content ?? "").trim();
    if (!text) continue;
    if (message.role === "system") {
      systemParts.push(text);
      continue;
    }
    const role = message.role === "assistant" ? "model" : "user";
    const last = contents[contents.length - 1];
    if (last?.role === role) {
      last.parts.push({ text });
    } else {
      contents.push({ role, parts: [{ text }] });
    }
  }

  if (!contents.length) {
    contents.push({ role: "user", parts: [{ text: "Respond in JSON." }] });
  }

  return {
    systemInstruction: systemParts.length ? systemParts.join("\n\n") : undefined,
    contents,
  };
}

function splitGeminiVisionMessages(messages: VisionChatMessage[]): {
  systemInstruction?: string;
  contents: { role: "user" | "model"; parts: GeminiPart[] }[];
} {
  const systemParts: string[] = [];
  const contents: { role: "user" | "model"; parts: GeminiPart[] }[] = [];

  for (const message of messages) {
    if (message.role === "system") {
      const text =
        typeof message.content === "string"
          ? String(message.content).trim()
          : message.content
              .filter((p): p is { type: "text"; text: string } => p.type === "text")
              .map((p) => p.text.trim())
              .filter(Boolean)
              .join("\n");
      if (text) systemParts.push(text);
      continue;
    }

    const role = message.role === "assistant" ? "model" : "user";
    const parts: GeminiPart[] =
      typeof message.content === "string"
        ? [{ text: String(message.content).trim() }].filter((p) => p.text)
        : message.content
            .map((part) => visionPartToGemini(part))
            .filter((part): part is GeminiPart => part != null);

    if (!parts.length) continue;
    const last = contents[contents.length - 1];
    if (last?.role === role) {
      last.parts.push(...parts);
    } else {
      contents.push({ role, parts });
    }
  }

  if (!contents.length) {
    contents.push({ role: "user", parts: [{ text: "Respond in JSON." }] });
  }

  return {
    systemInstruction: systemParts.length ? systemParts.join("\n\n") : undefined,
    contents,
  };
}

async function geminiGenerateJson(
  env: OpenAiEnv,
  apiKey: string,
  model: string,
  input: {
    systemInstruction?: string;
    contents: { role: "user" | "model"; parts: GeminiPart[] }[];
  },
  maxOutputTokens = OUTPUT_CAP_MARK,
): Promise<Record<string, unknown>> {
  const url = geminiGenerateContentUrl(model);
  const res = await providerFetch(env, url, {
    method: "POST",
    headers: geminiRequestHeaders(apiKey),
    body: JSON.stringify({
      systemInstruction: input.systemInstruction
        ? { parts: [{ text: input.systemInstruction }] }
        : undefined,
      contents: input.contents,
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        maxOutputTokens,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini error (${res.status}): ${errText.slice(0, 600)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };
  if (data.error?.message) {
    throw new Error(`Gemini error: ${String(data.error.message).slice(0, 600)}`);
  }

  const content = data.candidates?.[0]?.content?.parts
    ?.map((part) => String(part.text ?? "").trim())
    .filter(Boolean)
    .join("\n");
  if (!content) throw new Error("Gemini returned an empty response.");

  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error("Gemini returned invalid JSON.");
  }
}

async function geminiGenerateText(
  env: OpenAiEnv,
  apiKey: string,
  model: string,
  input: {
    systemInstruction?: string;
    contents: { role: "user" | "model"; parts: GeminiPart[] }[];
  },
  maxOutputTokens = OUTPUT_CAP_HELP,
): Promise<string> {
  const url = geminiGenerateContentUrl(model);
  const res = await providerFetch(env, url, {
    method: "POST",
    headers: geminiRequestHeaders(apiKey),
    body: JSON.stringify({
      systemInstruction: input.systemInstruction
        ? { parts: [{ text: input.systemInstruction }] }
        : undefined,
      contents: input.contents,
      generationConfig: {
        temperature: 0.35,
        maxOutputTokens,
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini error (${res.status}): ${errText.slice(0, 600)}`);
  }

  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    error?: { message?: string };
  };
  if (data.error?.message) {
    throw new Error(`Gemini error: ${String(data.error.message).slice(0, 600)}`);
  }

  const content = data.candidates?.[0]?.content?.parts
    ?.map((part) => String(part.text ?? "").trim())
    .filter(Boolean)
    .join("\n");
  if (!content) throw new Error("Gemini returned an empty response.");
  return content;
}

async function chatJson(
  env: OpenAiEnv,
  messages: ChatMessage[],
  maxOutputTokens?: number,
): Promise<Record<string, unknown>> {
  return withAiProviderPool(env, async (provider) => {
    if (provider.kind === "gemini") {
      const { systemInstruction, contents } = splitGeminiMessages(messages);
      return geminiGenerateJson(
        env,
        provider.apiKey,
        openAiModel(env),
        { systemInstruction, contents },
        maxOutputTokens,
      );
    }
    return groqGenerateJson(
      env,
      provider.apiKey,
      groqModel(env),
      messages.map((m) => ({ role: m.role, content: m.content })),
      maxOutputTokens ?? OUTPUT_CAP_MARK,
    );
  });
}

async function chatJsonWithVision(
  env: OpenAiEnv,
  messages: VisionChatMessage[],
  maxOutputTokens?: number,
): Promise<Record<string, unknown>> {
  // Groq Cloud is text-only in our app; vision stays Gemini-only.
  const providers = collectAiProviders(env).filter((p) => p.kind === "gemini");
  if (!providers.length) throw new Error("GEMINI_API_KEY is not configured.");
  const provider = providers[Math.floor(Math.random() * providers.length)]!;
  const { systemInstruction, contents } = splitGeminiVisionMessages(messages);
  return geminiGenerateJson(
    env,
    provider.apiKey,
    openAiVisionModel(env),
    { systemInstruction, contents },
    maxOutputTokens,
  );
}

async function chatText(
  env: OpenAiEnv,
  messages: ChatMessage[],
  maxOutputTokens?: number,
): Promise<string> {
  return withAiProviderPool(env, async (provider) => {
    if (provider.kind === "gemini") {
      const { systemInstruction, contents } = splitGeminiMessages(messages);
      return geminiGenerateText(
        env,
        provider.apiKey,
        openAiModel(env),
        { systemInstruction, contents },
        maxOutputTokens,
      );
    }
    return groqGenerateText(
      env,
      provider.apiKey,
      groqModel(env),
      messages.map((m) => ({ role: m.role, content: m.content })),
      maxOutputTokens ?? OUTPUT_CAP_HELP,
    );
  });
}

function parseLongAnswerMarkResult(
  parsed: Record<string, unknown>,
  defaultMarks: number,
  opts?: { maxFeedbackChars?: number },
): LongAnswerMarkResult {
  const maxMarks = Math.max(1, Math.round(Number(parsed.maxMarks ?? defaultMarks) || defaultMarks));
  const marksAwarded = Math.min(
    maxMarks,
    Math.max(0, Number(parsed.marksAwarded ?? 0)),
  );
  const scorePercent = Math.min(
    100,
    Math.max(0, Math.round(Number(parsed.scorePercent ?? (marksAwarded / maxMarks) * 100))),
  );
  const partResults: LongAnswerMarkResult["partResults"] = Array.isArray(parsed.partResults)
    ? (parsed.partResults as Record<string, unknown>[]).map((p, idx) => ({
        index: Number.isFinite(Number(p.index)) ? Number(p.index) : idx,
        correct: Boolean(p.correct),
        marksAwarded: Math.max(0, Number(p.marksAwarded ?? 0)),
        studentAnswerRead:
          p.studentAnswerRead != null
            ? String(p.studentAnswerRead).trim().slice(0, 500)
            : p.studentAnswer != null
              ? String(p.studentAnswer).trim().slice(0, 500)
              : undefined,
        correctAnswer:
          p.correctAnswer != null
            ? String(p.correctAnswer).trim().slice(0, 500)
            : undefined,
        partFeedback:
          p.partFeedback != null ? String(p.partFeedback).trim().slice(0, 2000) : undefined,
      }))
    : [];

  const stepResults: LongAnswerMarkResult["stepResults"] = Array.isArray(parsed.stepResults)
    ? (parsed.stepResults as Record<string, unknown>[]).map((s, idx) => ({
        index: Number.isFinite(Number(s.index)) ? Number(s.index) : idx,
        marks: Math.max(1, Math.round(Number(s.marks ?? 1) || 1)),
        marksAwarded: Math.max(0, Number(s.marksAwarded ?? 0)),
        label: String(s.label ?? "").trim().slice(0, 500),
        model: s.model != null ? String(s.model).trim().slice(0, 500) : undefined,
        studentText: s.studentText != null ? String(s.studentText).trim().slice(0, 500) : undefined,
        awarded: Boolean(s.awarded ?? Number(s.marksAwarded ?? 0) > 0),
        feedback: s.feedback != null ? String(s.feedback).trim().slice(0, 2000) : undefined,
      }))
    : [];

  const correctAnswersRaw = parsed.correctAnswers ?? parsed.correct_answers;
  const correctAnswers = Array.isArray(correctAnswersRaw)
    ? correctAnswersRaw.map((a) => String(a ?? "").trim()).filter(Boolean).slice(0, 12)
    : parsed.correctAnswer != null
      ? [String(parsed.correctAnswer).trim()].filter(Boolean)
      : undefined;

  const feedbackLimit = opts?.maxFeedbackChars ?? 2000;

  return {
    correct: Boolean(parsed.correct ?? marksAwarded >= maxMarks * 0.5),
    scorePercent,
    marksAwarded,
    maxMarks,
    feedback: String(parsed.feedback ?? "").trim().slice(0, feedbackLimit),
    correctAnswers,
    partResults,
    stepResults,
  };
}

export type ParsedImportQuestion = {
  subjectId?: string;
  type: string;
  topic?: string;
  question: string;
  options?: string[];
  answer?: string;
  acceptedAnswers?: string[];
  marks?: number;
  guidance?: string;
  passage?: string;
  answerParts?: {
    key?: string;
    label: string;
    marks?: number;
    acceptedAnswer?: string;
    placeholder?: string;
  }[];
};

function normalizeParsedQuestionRow(
  row: Record<string, unknown>,
  defaultSubjectId: string,
): ParsedImportQuestion | null {
  const question = String(row.question ?? "").trim();
  if (!question) return null;
  const type = String(row.type ?? "short_answer").trim().toLowerCase();
  const normalizedType =
    type === "mcq" || type === "long_answer" || type === "short_answer"
      ? type
      : "short_answer";
  return {
    subjectId: String(row.subjectId ?? row.subject_id ?? defaultSubjectId).trim() || defaultSubjectId,
    type: normalizedType,
    topic: String(row.topic ?? "General").trim() || "General",
    question,
    options: Array.isArray(row.options)
      ? row.options.map((o) => String(o ?? "").trim()).filter(Boolean)
      : undefined,
    answer: row.answer != null ? String(row.answer).trim() : undefined,
    acceptedAnswers: Array.isArray(row.acceptedAnswers)
      ? row.acceptedAnswers.map((a) => String(a ?? "").trim()).filter(Boolean)
      : Array.isArray(row.accepted_answers)
        ? row.accepted_answers.map((a) => String(a ?? "").trim()).filter(Boolean)
        : undefined,
    marks: Number.isFinite(Number(row.marks)) ? Math.max(1, Math.round(Number(row.marks))) : undefined,
    guidance: row.guidance != null ? String(row.guidance).trim() : undefined,
    passage: row.passage != null ? String(row.passage).trim() : undefined,
    answerParts: Array.isArray(row.answerParts)
      ? (row.answerParts as Record<string, unknown>[]).map((p) => ({
          key: p.key != null ? String(p.key) : undefined,
          label: String(p.label ?? "").trim(),
          marks: Number.isFinite(Number(p.marks)) ? Math.round(Number(p.marks)) : undefined,
          acceptedAnswer:
            p.acceptedAnswer != null
              ? String(p.acceptedAnswer).trim()
              : p.accepted_answer != null
                ? String(p.accepted_answer).trim()
                : undefined,
          placeholder: p.placeholder != null ? String(p.placeholder).trim() : undefined,
        })).filter((p) => p.label)
      : undefined,
  };
}

function normalizeParsedQuestions(
  rows: unknown[],
  defaultSubjectId: string,
): ParsedImportQuestion[] {
  return rows
    .map((row) => normalizeParsedQuestionRow(row as Record<string, unknown>, defaultSubjectId))
    .filter((q): q is ParsedImportQuestion => q !== null);
}

export type QuestionChatTurn = { role: "user" | "assistant"; content: string };

export type QuestionGenerationChatInput = {
  subjectId: string;
  topicOptions: string[];
  messages: QuestionChatTurn[];
  resources?: string;
  currentDraft?: ParsedImportQuestion[];
};

export type QuestionGenerationChatResult = {
  message: string;
  questions: ParsedImportQuestion[];
};

export async function questionGenerationChat(
  env: OpenAiEnv,
  input: QuestionGenerationChatInput,
): Promise<QuestionGenerationChatResult> {
  const subjectId = input.subjectId.trim() || "methods";
  const topics = (input.topicOptions ?? []).slice(0, 40);
  const resources = String(input.resources ?? "").trim().slice(0, 80000);
  const draft = (input.currentDraft ?? []).slice(0, 50);

  const draftSummary =
    draft.length > 0
      ? `\n\nCurrent draft in the admin panel (${draft.length} question(s)):\n${JSON.stringify(
          draft.map((q, i) => ({
            index: i + 1,
            type: q.type,
            topic: q.topic,
            marks: q.marks,
            question: q.question.slice(0, 200),
          })),
        )}`
      : "";

  const resourceBlock = resources
    ? `\n\nREFERENCE MATERIAL (use for inspiration — do not copy verbatim):\n${resources.slice(0, 50000)}`
    : "";

  const systemContent = `You help a VCE teacher/admin generate exam-style questions for the Nodent study app.

Subject: ${subjectId}
Valid topics (pick the best match for each question): ${topics.length ? topics.join(" | ") : "General"}
${resourceBlock}${draftSummary}

You are in a chat. The admin asks you to create or revise questions.

Always return JSON only:
{
  "message": "conversational reply to the admin (plain text, no markdown fences)",
  "questions": [ ...question objects to ADD or REPLACE in the draft this turn ... ]
}

Each question object:
- subjectId (string, default "${subjectId}")
- type: "mcq" | "short_answer" | "long_answer"
- topic (string, from valid topics list when possible)
- question (string, student-facing stem; include a) b) labels in stem when multipart)
- options (string[], MCQ only, 4 options typical)
- answer (string, primary answer)
- acceptedAnswers (string[], alternate acceptable answers)
- marks (integer >= 1)
- guidance (string, brief marking notes)
- passage (string, if separate reading passage)
- answerParts (multipart: {key, label, marks, acceptedAnswer, placeholder})

Rules:
- Write original VCE-quality questions inspired by reference material — do not copy copyrighted exam papers verbatim.
- Use LaTeX for maths where helpful: $...$ inline, $$...$$ display.
- If the admin asks to revise, return the updated question(s) in "questions" — they replace matching items in the draft when index/topic is clear, otherwise new items are appended.
- If clarifying or no questions ready, return "questions": [] and explain in "message".
- Do not invent image URLs.
- short_answer for numeric/one-line; long_answer for explanation/proof; mcq for multiple choice.`;

  const chatMessages: ChatMessage[] = [{ role: "system", content: systemContent }];

  for (const turn of input.messages.slice(-24)) {
    const role = turn.role === "assistant" ? "assistant" : "user";
    const content = String(turn.content ?? "").trim().slice(0, 12000);
    if (!content) continue;
    chatMessages.push({ role, content });
  }

  const parsed = await chatJson(env, chatMessages);

  const message = String(parsed.message ?? parsed.reply ?? "").trim()
    || "Done.";
  const questions = normalizeParsedQuestions(
    Array.isArray(parsed.questions) ? parsed.questions : [],
    subjectId,
  );

  return { message, questions };
}

export async function parseQuestionsFromText(
  env: OpenAiEnv,
  rawText: string,
  defaultSubjectId: string,
): Promise<ParsedImportQuestion[]> {
  const text = rawText.trim().slice(0, 120000);
  if (!text) throw new Error("Text is empty.");

  const parsed = await chatJson(env, [
    {
      role: "system",
      content: `You extract exam questions into JSON for a VCE maths/english study app.
Return {"questions":[...]} only.

Each question object:
- subjectId (string, default "${defaultSubjectId}")
- type: "mcq" | "short_answer" | "long_answer"
- topic (string, study area)
- question (string, student-facing stem; include subpart labels like a) b) in the stem when multipart)
- options (string[], MCQ only)
- answer (string, primary answer)
- acceptedAnswers (string[], alternate acceptable answers)
- marks (integer >= 1)
- guidance (string, marking rubric when present)
- passage (string, reading passage if separate from stem)
- answerParts (array for multipart: {key, label, marks, acceptedAnswer, placeholder})

Rules:
- If input uses ---NODENT--- blocks, preserve fields faithfully.
- Split combined documents into separate questions.
- Use long_answer for explanation/proof questions; short_answer for numeric/one-line.
- Do not invent figures or image URLs.`,
    },
    {
      role: "user",
      content: `default_subject_id: ${defaultSubjectId}\n\n${text}`,
    },
  ]);

  const rows = Array.isArray(parsed.questions) ? parsed.questions : [];
  return normalizeParsedQuestions(rows, defaultSubjectId);
}

export type SubjectMarkingContext = {
  promptText: string;
  resources: string[];
};

export function formatSubjectMarkingContextBlock(ctx?: SubjectMarkingContext | null): string {
  if (!ctx) return "";
  const parts: string[] = [];
  const prompt = String(ctx.promptText ?? "").trim();
  if (prompt) parts.push(`Notes: ${prompt.slice(0, 800)}`);
  const resources = (ctx.resources ?? []).map((r) => String(r ?? "").trim()).filter(Boolean);
  if (resources.length) {
    parts.push(
      resources
        .slice(0, 2)
        .map((r, i) => `[${i + 1}] ${r.slice(0, 600)}`)
        .join("\n"),
    );
  }
  return parts.length ? `\n${parts.join("\n")}` : "";
}

export type MarkBreakdownStepInput = {
  marks: number;
  label: string;
  model?: string;
};

export type LongAnswerMarkInput = {
  questionText: string;
  questionType: string;
  topic?: string;
  marks: number;
  guidance?: string;
  acceptedAnswers?: string[];
  answerParts?: { label: string; marks?: number; acceptedAnswer?: string }[];
  studentResponse: string;
  studentParts?: string[];
  studentSteps?: string[];
  markBreakdown?: { steps: MarkBreakdownStepInput[] };
  subjectContext?: SubjectMarkingContext;
  breakdownMode?: boolean;
};

export type LongAnswerMarkResult = {
  correct: boolean;
  scorePercent: number;
  marksAwarded: number;
  maxMarks: number;
  feedback: string;
  /** Authoritative model answer(s) — especially when the student is wrong. */
  correctAnswers?: string[];
  partResults: {
    index: number;
    correct: boolean;
    marksAwarded: number;
    studentAnswerRead?: string;
    correctAnswer?: string;
    partFeedback?: string;
  }[];
  stepResults?: {
    index: number;
    marks: number;
    marksAwarded: number;
    label: string;
    model?: string;
    studentText?: string;
    awarded: boolean;
    feedback?: string;
  }[];
};

export async function markLongAnswer(
  env: OpenAiEnv,
  input: LongAnswerMarkInput,
): Promise<LongAnswerMarkResult> {
  const subjectBlock = formatSubjectMarkingContextBlock(input.subjectContext);

  const payload = {
    questionText: input.questionText.slice(0, 2000),
    questionType: input.questionType,
    topic: input.topic ?? "",
    maxMarks: input.marks,
    guidance: (input.guidance ?? "").slice(0, 800),
    acceptedAnswers: (input.acceptedAnswers ?? []).slice(0, 8),
    answerParts: (input.answerParts ?? []).slice(0, 8),
    studentResponse: input.studentResponse.slice(0, 4000),
    studentParts: (input.studentParts ?? []).map((p) => p.slice(0, 1500)).slice(0, 8),
    studentSteps: (input.studentSteps ?? []).map((s) => s.slice(0, 800)).slice(0, 12),
    markBreakdown: input.markBreakdown ?? null,
    breakdownMode: Boolean(input.breakdownMode),
  };

  const breakdownPrompt = input.breakdownMode
    ? `Mark a VCE answer step-by-step using markBreakdown. Return JSON only:
{"correct":bool,"scorePercent":0-100,"marksAwarded":n,"maxMarks":n,"feedback":"optional 1 line","stepResults":[{"index":0,"marks":1,"marksAwarded":0,"label":"","studentText":"","awarded":false,"feedback":"1 short bullet"}],"partResults":[]}
One stepResults entry per markBreakdown step. Use guidance/acceptedAnswers as rubric.${subjectBlock}`
    : `Mark a VCE student answer. Return JSON only:
{"correct":bool,"scorePercent":0-100,"marksAwarded":n,"maxMarks":n,"feedback":"1-2 short bullets if wrong","correctAnswers":["..."],"partResults":[{"index":0,"correct":bool,"marksAwarded":n,"correctAnswer":"...","partFeedback":"1 bullet"}]}
Use guidance/acceptedAnswers / answerParts.acceptedAnswer as rubric.
Be fair; accept equivalent methods, algebra forms, and clear diagram/network layouts that encode the same dependencies.
For multipart items, mark each part against its own acceptedAnswer and fill partResults in order.
Award partial marks where method is correct.${subjectBlock}`;

  const parsed = await chatJson(
    env,
    [
      { role: "system", content: breakdownPrompt },
      { role: "user", content: JSON.stringify(payload) },
    ],
    OUTPUT_CAP_MARK,
  );

  return parseLongAnswerMarkResult(parsed, input.marks);
}

export type HandwritingMarkInput = {
  questionText: string;
  questionType: string;
  topic?: string;
  marks: number;
  guidance?: string;
  acceptedAnswers?: string[];
  answerParts?: { label: string; marks?: number; acceptedAnswer?: string }[];
  images: string[];
  subjectContext?: SubjectMarkingContext;
};

export async function markHandwritingAnswer(
  env: OpenAiEnv,
  input: HandwritingMarkInput,
): Promise<LongAnswerMarkResult> {
  const images = input.images
    .map((img) => String(img ?? "").trim())
    .filter((img) => /^data:image\//i.test(img))
    .slice(0, MAX_HANDWRITING_IMAGES);
  if (!images.length) throw new Error("At least one handwriting image is required.");

  const rubric = {
    questionText: input.questionText.slice(0, 2000),
    questionType: input.questionType,
    topic: input.topic ?? "",
    maxMarks: input.marks,
    guidance: (input.guidance ?? "").slice(0, 800),
    acceptedAnswers: (input.acceptedAnswers ?? []).slice(0, 8),
    answerParts: (input.answerParts ?? []).slice(0, 8),
    imageCount: images.length,
  };

  const userContent: VisionContentPart[] = [
    {
      type: "text",
      text: `Mark this handwritten answer. Rubric JSON:\n${JSON.stringify(rubric)}`,
    },
    ...images.map((url) => ({
      type: "image_url" as const,
      image_url: { url },
    })),
  ];
  if (images.length > 1 && (input.answerParts ?? []).length > 0) {
    const labels = (input.answerParts ?? [])
      .slice(0, images.length)
      .map((p, i) => `Image ${i + 1}: ${p.label}`)
      .join("\n");
    userContent.push({ type: "text", text: `Parts:\n${labels}` });
  }

  const subjectBlock = formatSubjectMarkingContextBlock(input.subjectContext);
  const parsed = await chatJsonWithVision(
    env,
    [
      {
        role: "system",
        content: `Read handwritten / drawn VCE answer(s) from the image(s). Return JSON only:
{"correct":bool,"scorePercent":0-100,"marksAwarded":n,"maxMarks":n,"feedback":"optional 1 line","correctAnswers":["..."],"partResults":[{"index":0,"correct":bool,"marksAwarded":n,"studentAnswerRead":"what you read","correctAnswer":"...","partFeedback":"1 bullet"}]}
Use guidance/acceptedAnswers/answerParts.acceptedAnswer as rubric.
Images may contain algebra working, written explanations, tables (ES/EF), or diagrams/networks/graphs.
Accept equivalent layouts if the maths / dependencies are correct. LaTeX ok in text fields.${subjectBlock}`,
      },
      { role: "user", content: userContent },
    ],
    OUTPUT_CAP_HANDWRITING,
  );

  return parseLongAnswerMarkResult(parsed, input.marks, { maxFeedbackChars: 2000 });
}

export async function generateMarkBreakdown(
  env: OpenAiEnv,
  input: {
    questionText: string;
    topic?: string;
    marks: number;
    guidance?: string;
    acceptedAnswers?: string[];
    subjectContext?: SubjectMarkingContext;
  },
): Promise<{ steps: MarkBreakdownStepInput[] }> {
  const parsed = await chatJson(env, [
    {
      role: "system",
      content: `You create VCAA-style mark breakdowns for exam questions.
Return JSON only: {"steps":[{"marks":1,"label":"what earns this mark","model":"model working/answer for this mark"}]}
${formatSubjectMarkingContextBlock(input.subjectContext)}

Rules:
• Total marks across steps must equal maxMarks (${input.marks}).
• Solve the exact question yourself using the supplied values and accepted answer.
• Every model field must show concrete working: the actual formula, substitution, calculation, reasoning, and final answer needed for that question.
• Never return generic study advice such as “identify the relationship”, “substitute carefully”, “show working”, or “check units”.
• For a one-mark question, still show the shortest exact calculation or reasoning that produces the accepted answer.
• For multiple choice, explain the calculation or fact that proves the correct option.
• Use LaTeX in model fields where helpful: $...$
• Prefer 1 mark per step unless exam guide groups marks.`,
    },
    {
      role: "user",
      content: JSON.stringify({
        questionText: input.questionText.slice(0, 4000),
        topic: input.topic ?? "",
        maxMarks: input.marks,
        guidance: input.guidance ?? "",
        acceptedAnswers: (input.acceptedAnswers ?? []).slice(0, 12),
      }),
    },
  ]);
  const stepsRaw = Array.isArray(parsed.steps) ? parsed.steps : [];
  const steps: MarkBreakdownStepInput[] = stepsRaw
    .map((s: Record<string, unknown>) => ({
      marks: Math.max(1, Math.round(Number(s.marks ?? 1) || 1)),
      label: String(s.label ?? s.criterion ?? "").trim(),
      model: String(s.model ?? s.expected ?? "").trim() || undefined,
    }))
    .filter((s) => s.label)
    .slice(0, 24);
  if (!steps.length) throw new Error("Could not generate mark breakdown.");
  return { steps };
}

export type FillDraftAnswerSlot = {
  slotId: string;
  index: number;
  key?: string;
  label: string;
  marks?: number;
  overlaySlots?: { index: number; label?: string }[];
};

export type FillDraftAnswersInput = {
  type: string;
  question: string;
  passage?: string;
  options?: string[];
  sharedStem?: string;
  slots: FillDraftAnswerSlot[];
  solutionsText: string;
};

export type FillDraftAnswersPartResult = {
  slotId?: string;
  index: number;
  acceptedAnswer?: string;
  overlays?: { index: number; acceptedAnswer?: string }[];
};

export type FillDraftAnswersResult = {
  correctAnswer?: string;
  acceptedAnswers?: string;
  parts: FillDraftAnswersPartResult[];
  message?: string;
};

export async function fillDraftQuestionAnswers(
  env: OpenAiEnv,
  input: FillDraftAnswersInput,
): Promise<FillDraftAnswersResult> {
  const solutionsText = String(input.solutionsText ?? "").trim().slice(0, 80000);
  if (!solutionsText) throw new Error("Solutions text is empty.");

  const payload = {
    type: input.type,
    question: String(input.question ?? "").slice(0, 8000),
    passage: String(input.passage ?? "").slice(0, 4000),
    sharedStem: String(input.sharedStem ?? "").slice(0, 4000),
    options: (input.options ?? []).slice(0, 6),
    slots: (input.slots ?? []).slice(0, 30).map((slot) => ({
      slotId: String(slot.slotId ?? slot.index),
      index: slot.index,
      key: slot.key ?? "",
      label: String(slot.label ?? "").slice(0, 2000),
      marks: slot.marks,
      overlaySlots: (slot.overlaySlots ?? []).slice(0, 12).map((overlay) => ({
        index: overlay.index,
        label: String(overlay.label ?? "").slice(0, 200),
      })),
    })),
    solutionsText,
  };

  const parsed = await chatJson(env, [
    {
      role: "system",
      content: `You extract FINAL accepted answers from official exam solutions for ONE question.

INPUT:
- sharedStem + slots[].label = exact wording students see per answer box
- slotId on each slot — you MUST echo it back unchanged
- solutionsText = messy VCAA / teacher solutions (may use 1a, b.i, d.iv, etc.)

Return JSON only:
{
  "parts": [
    { "slotId": "0", "acceptedAnswer": "2" },
    { "slotId": "1", "acceptedAnswer": "11.42 g" }
  ],
  "correctAnswer": "B" (MCQ only),
  "message": "optional"
}

Rules:
- One "parts" entry per input slot, same slotId. Never skip or reorder slotIds.
- Match by part LETTER (a,b,c…) AND question meaning — not by position in solutions alone.
- Sub-parts in solutions (b.i, b.ii, d.i–d.iv) map to consecutive slots with that letter, in order.
- Short final answer only — no working, headers, or "2023 VCE".
- If a slot has overlaySlots, use "overlays": [{ "index": 0, "acceptedAnswer": "..." }] instead of part acceptedAnswer.
- Do NOT copy the question text into acceptedAnswer.`,
    },
    {
      role: "user",
      content: JSON.stringify(payload),
    },
  ]);

  const parts = Array.isArray(parsed.parts)
    ? (parsed.parts as Record<string, unknown>[])
        .map((row) => {
          const slotId = String(row.slotId ?? row.slot_id ?? "").trim();
          const index = Number(row.index);
          const resolvedIndex = Number.isFinite(index) && index >= 0 ? index : -1;
          if (!slotId && resolvedIndex < 0) return null;
          const overlays = Array.isArray(row.overlays)
            ? (row.overlays as Record<string, unknown>[])
                .map((overlay) => {
                  const overlayIndex = Number(overlay.index);
                  if (!Number.isFinite(overlayIndex) || overlayIndex < 0) return null;
                  const acceptedAnswer = String(
                    overlay.acceptedAnswer ?? overlay.accepted_answer ?? "",
                  ).trim();
                  if (!acceptedAnswer) return null;
                  return { index: overlayIndex, acceptedAnswer };
                })
                .filter((overlay): overlay is { index: number; acceptedAnswer: string } => overlay != null)
            : undefined;
          const acceptedAnswer = String(row.acceptedAnswer ?? row.accepted_answer ?? "").trim();
          if (!acceptedAnswer && !overlays?.length) return null;
          return {
            ...(slotId ? { slotId } : {}),
            index: resolvedIndex,
            ...(acceptedAnswer ? { acceptedAnswer } : {}),
            ...(overlays?.length ? { overlays } : {}),
          };
        })
        .filter((row): row is FillDraftAnswersPartResult => row != null)
    : [];

  const correctAnswer = String(parsed.correctAnswer ?? parsed.correct_answer ?? "")
    .trim()
    .toUpperCase()
    .slice(0, 1);
  const acceptedAnswers = String(parsed.acceptedAnswers ?? parsed.accepted_answers ?? "").trim();

  return {
    ...(correctAnswer && /^[A-D]$/.test(correctAnswer) ? { correctAnswer } : {}),
    ...(acceptedAnswers ? { acceptedAnswers } : {}),
    parts,
    message: String(parsed.message ?? "").trim().slice(0, 500) || undefined,
  };
}

export type QuestionHelpTurn = { role: "user" | "assistant"; content: string };

export type QuestionHelpInput = {
  subjectId: string;
  question: Record<string, unknown>;
  messages: QuestionHelpTurn[];
  subjectContext?: SubjectMarkingContext;
};

export async function questionHelpChat(
  env: OpenAiEnv,
  input: QuestionHelpInput,
): Promise<{ reply: string }> {
  const questionBlock = JSON.stringify(input.question).slice(0, 2500);
  const subjectBlock = formatSubjectMarkingContextBlock(input.subjectContext);

  const systemContent = `VCE tutor for one practice question. Give one short hint (2-3 sentences). Do not give the final answer or restate the question.${subjectBlock ? `\n${subjectBlock}` : ""}

Question: ${questionBlock}`;

  const chatMessages: ChatMessage[] = [{ role: "system", content: systemContent }];
  for (const turn of input.messages.slice(-6)) {
    const content = String(turn.content ?? "").trim().slice(0, 600);
    if (!content) continue;
    chatMessages.push({
      role: turn.role === "assistant" ? "assistant" : "user",
      content,
    });
  }

  if (chatMessages.length === 1) {
    chatMessages.push({
      role: "user",
      content: "Give me one hint to get started.",
    });
  }

  const reply = await chatText(env, chatMessages, OUTPUT_CAP_HELP);
  return { reply: reply.trim().slice(0, 1200) };
}
