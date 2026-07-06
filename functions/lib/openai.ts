/**
 * Google Gemini generateContent for Cloudflare Workers / Pages Functions.
 * Server-side only — never expose GEMINI_API_KEY to the browser.
 *
 * Active in production:
 *   - English essay scoring (scoreEnglishResponse) — worded responses only
 *   - Handwriting marking (markHandwritingAnswer) — explain/discuss/prove-style only
 *   - Long-answer text marking (markLongAnswer) — explain/discuss/prove-style only
 *
 * Admin import helpers (questionGenerationChat, parseQuestionsFromText,
 * fillDraftQuestionAnswers) remain in this module but API routes return 503.
 *
 * Env:
 *   GEMINI_API_KEY       (required for AI features)
 *   GEMINI_MODEL         (optional, default gemini-2.0-flash — text marking)
 *   GEMINI_VISION_MODEL  (optional, default gemini-2.0-flash — handwriting / images)
 */

export type OpenAiEnv = {
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  GEMINI_VISION_MODEL?: string;
};

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta";
const DEFAULT_MODEL = "gemini-2.5-flash";
const DEFAULT_VISION_MODEL = "gemini-2.5-flash";

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

export function openAiConfigured(env: OpenAiEnv): boolean {
  return !!trim(env.GEMINI_API_KEY);
}

export function requireOpenAiKey(env: OpenAiEnv): string {
  const key = trim(env.GEMINI_API_KEY);
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
  apiKey: string,
  model: string,
  input: {
    systemInstruction?: string;
    contents: { role: "user" | "model"; parts: GeminiPart[] }[];
  },
): Promise<Record<string, unknown>> {
  const url = geminiGenerateContentUrl(model);
  const res = await fetch(url, {
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
  apiKey: string,
  model: string,
  input: {
    systemInstruction?: string;
    contents: { role: "user" | "model"; parts: GeminiPart[] }[];
  },
): Promise<string> {
  const url = geminiGenerateContentUrl(model);
  const res = await fetch(url, {
    method: "POST",
    headers: geminiRequestHeaders(apiKey),
    body: JSON.stringify({
      systemInstruction: input.systemInstruction
        ? { parts: [{ text: input.systemInstruction }] }
        : undefined,
      contents: input.contents,
      generationConfig: {
        temperature: 0.45,
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
  apiKey: string,
  model: string,
  messages: ChatMessage[],
): Promise<Record<string, unknown>> {
  const { systemInstruction, contents } = splitGeminiMessages(messages);
  return geminiGenerateJson(apiKey, model, { systemInstruction, contents });
}

async function chatJsonWithVision(
  apiKey: string,
  model: string,
  messages: VisionChatMessage[],
): Promise<Record<string, unknown>> {
  const { systemInstruction, contents } = splitGeminiVisionMessages(messages);
  return geminiGenerateJson(apiKey, model, { systemInstruction, contents });
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
  const apiKey = requireOpenAiKey(env);
  const model = openAiModel(env);
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

  const parsed = await chatJson(apiKey, model, chatMessages);

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
  const apiKey = requireOpenAiKey(env);
  const model = openAiModel(env);
  const text = rawText.trim().slice(0, 120000);
  if (!text) throw new Error("Text is empty.");

  const parsed = await chatJson(apiKey, model, [
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
  if (prompt) parts.push(`SUBJECT MARKING GUIDANCE:\n${prompt.slice(0, 12000)}`);
  const resources = (ctx.resources ?? []).map((r) => String(r ?? "").trim()).filter(Boolean);
  if (resources.length) {
    parts.push(
      `REFERENCE RESOURCES:\n${resources.map((r, i) => `[${i + 1}] ${r.slice(0, 8000)}`).join("\n\n")}`,
    );
  }
  return parts.length ? `\n\n${parts.join("\n\n")}` : "";
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
  const apiKey = requireOpenAiKey(env);
  const model = openAiModel(env);
  const subjectBlock = formatSubjectMarkingContextBlock(input.subjectContext);

  const payload = {
    questionText: input.questionText.slice(0, 4000),
    questionType: input.questionType,
    topic: input.topic ?? "",
    maxMarks: input.marks,
    guidance: input.guidance ?? "",
    acceptedAnswers: (input.acceptedAnswers ?? []).slice(0, 20),
    answerParts: (input.answerParts ?? []).slice(0, 12),
    studentResponse: input.studentResponse.slice(0, 12000),
    studentParts: (input.studentParts ?? []).map((p) => p.slice(0, 4000)),
    studentSteps: (input.studentSteps ?? []).map((s) => s.slice(0, 2000)),
    markBreakdown: input.markBreakdown ?? null,
    breakdownMode: Boolean(input.breakdownMode),
  };

  const breakdownPrompt = input.breakdownMode
    ? `You mark using a VCAA-style MARK BREAKDOWN — each step earns its own mark(s).
Return JSON only:
{
  "correct": boolean (true only if all marks earned),
  "scorePercent": 0-100,
  "marksAwarded": number (sum of step marksAwarded),
  "maxMarks": number,
  "feedback": "1-2 bullet overview when wrong",
  "correctAnswers": ["final model answer(s)"],
  "stepResults": [{
    "index": 0,
    "marks": 1,
    "marksAwarded": 0,
    "label": "criterion label from rubric",
    "model": "model working for this mark",
    "studentText": "what the student wrote for this step",
    "awarded": false,
    "feedback": "2-4 bullets comparing student vs model for THIS mark only — use LaTeX $...$ for maths"
  }],
  "partResults": []
}

Rules for stepResults:
• One entry per markBreakdown step, same order and index.
• studentText MUST quote/paraphrase the student's step from studentSteps.
• If awarded is false, feedback MUST say exactly what was missing vs the model.
• Use LaTeX in feedback: $10\\,\\text{am}$, $\\frac{dh}{dt}$, etc.
• Be fair — accept equivalent correct methods.`
    : `You mark student responses for VCE-style questions.
Return JSON only:
{
  "correct": boolean (true if broadly correct for full credit),
  "scorePercent": 0-100,
  "marksAwarded": number (0 to maxMarks, can be fractional .5),
  "maxMarks": number,
  "feedback": "4-8 bullet points when wrong (each line starts with •); 2-3 bullets when correct",
  "correctAnswers": ["authoritative model answer(s) in order when wrong or multipart"],
  "partResults": [{
    "index": 0,
    "correct": true,
    "marksAwarded": 1,
    "correctAnswer": "model answer for this part",
    "partFeedback": "3-6 bullet points for THIS part — each on its own line starting with • "
  }]
}

When the student is WRONG, feedback MUST be specific and detailed:
• Quote or paraphrase what they actually wrote.
• Name the exact mistake (wrong formula, missing step, sign error, incomplete explanation, etc.).
• Give a step-by-step model solution or reasoning chain for this question.
• State the correct final answer clearly.
• If multipart, put per-part detail in partResults.partFeedback (not only global feedback).

When correct: still give 2-3 bullets on what they did well.

Be fair: accept equivalent methods and reasonable rounding. For multipart, grade each part.
Use guidance and acceptedAnswers as the rubric when provided; prefer those over inventing answers.`;

  const parsed = await chatJson(apiKey, model, [
    {
      role: "system",
      content: `${breakdownPrompt}${subjectBlock}`,
    },
    {
      role: "user",
      content: JSON.stringify(payload),
    },
  ]);

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
  const apiKey = requireOpenAiKey(env);
  const model = openAiVisionModel(env);
  const images = input.images
    .map((img) => String(img ?? "").trim())
    .filter((img) => /^data:image\//i.test(img))
    .slice(0, 12);
  if (!images.length) throw new Error("At least one handwriting image is required.");

  const rubric = {
    questionText: input.questionText.slice(0, 4000),
    questionType: input.questionType,
    topic: input.topic ?? "",
    maxMarks: input.marks,
    guidance: input.guidance ?? "",
    acceptedAnswers: (input.acceptedAnswers ?? []).slice(0, 20),
    answerParts: (input.answerParts ?? []).slice(0, 12),
    imageCount: images.length,
  };

  const userContent: VisionContentPart[] = [
    {
      type: "text",
      text: `Mark this handwritten student response. JSON rubric:\n${JSON.stringify(rubric)}`,
    },
    ...images.map((url) => ({
      type: "image_url" as const,
      image_url: { url, detail: "high" as const },
    })),
  ];
  if (images.length > 1 && (input.answerParts ?? []).length > 0) {
    const labels = (input.answerParts ?? [])
      .map((p, i) => `Image ${i + 1} — ${p.label}`)
      .join("\n");
    userContent.push({
      type: "text",
      text: `Multipart: ${images.length} images in order (one per subpart):\n${labels}`,
    });
  } else if (images.length > 1) {
    userContent.push({
      type: "text",
      text: `There are ${images.length} images in order — image 1 is the first subpart, etc.`,
    });
  }

  const parsed = await chatJsonWithVision(apiKey, model, [
    {
      role: "system",
      content: `You mark handwritten student responses on ruled paper for VCE-style maths questions.
Carefully READ every stroke in each image — numbers, operators, graphs, lists of edges, and working lines.
The final answer is usually on the last line of each image.
${formatSubjectMarkingContextBlock(input.subjectContext)}

Return JSON only:
{
  "correct": boolean (true only if fully correct for full credit),
  "scorePercent": 0-100,
  "marksAwarded": number (0 to maxMarks, can be fractional 0.5),
  "maxMarks": number,
  "feedback": "optional brief overall summary (1-2 bullets) for multipart; omit if partResults cover everything",
  "correctAnswers": ["one authoritative answer per part in order"],
  "partResults": [{
    "index": 0,
    "correct": true,
    "marksAwarded": 1,
    "studentAnswerRead": "REQUIRED — transcribe the final answer and main working you can read from their drawing",
    "correctAnswer": "authoritative correct answer for this part",
    "partFeedback": "3-5 bullet points for THIS part only — each bullet on its own line, starting with • "
  }]
}

For EACH part in partResults, partFeedback MUST include:
• Step-by-step model solution for this part
• If wrong: the specific mistake; if right: what they did well
(Do not repeat studentAnswerRead in partFeedback — it is shown separately in the UI.)

studentAnswerRead is REQUIRED for every part — never leave it empty if anything is legible in the image.
Use LaTeX for maths in studentAnswerRead, correctAnswer, and partFeedback: $10\\,\\text{am}$, $\\frac{dh}{dt}$, $4\\,\\text{m}$, etc.

Global "feedback" is optional for multipart — put the detailed walkthrough in each part's partFeedback.

When the student is WRONG:
- correctAnswers must list every part's model answer in order.
- Each partResults entry must include correctAnswer and partFeedback even when partially correct.

When fully correct: partFeedback still has 2-3 bullets on what they did well.

Be fair: accept equivalent methods and reasonable rounding.
For multipart, one image per part in order (image 1 = index 0).
Use guidance and acceptedAnswers as the rubric; prefer those over inventing answers.`,
    },
    { role: "user", content: userContent },
  ]);

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
  const apiKey = requireOpenAiKey(env);
  const model = openAiModel(env);
  const parsed = await chatJson(apiKey, model, [
    {
      role: "system",
      content: `You create VCAA-style mark breakdowns for exam questions.
Return JSON only: {"steps":[{"marks":1,"label":"what earns this mark","model":"model working/answer for this mark"}]}
${formatSubjectMarkingContextBlock(input.subjectContext)}

Rules:
• Total marks across steps must equal maxMarks (${input.marks}).
• Each step is one line of working or one criterion (e.g. "State both equations", "Substitute correctly", "Correct final answers").
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

const ENGLISH_CRITERIA_RUBRIC = `
MARK ON FOUR CRITERIA (each 0–10):
1. structure — clear introduction, body paragraphs, conclusion; logical flow; cohesive sequencing of ideas
2. evidence — use of textual evidence, examples, or supporting detail; how well evidence is integrated
3. expression — vocabulary, sentence variety, grammar, spelling, and conventions of Standard Australian English
4. relevance — engagement with the prompt/topic; focus and appropriateness of ideas to the task

OVERALL score (0–10): holistic VCE-style mark informed by the four criteria — do not simply average them.

HIGHLIGHTS: Return 8–16 inline annotations on exact phrases copied verbatim from the student's essay.
- type "strength" for effective writing (green in UI)
- type "improvement" for weaknesses (red in UI)
- Each highlight quote MUST appear exactly in the essay (copy-paste, preserve punctuation)
- feedback: 1–3 sentences explaining why this phrase works or how to improve it
`.trim();

function clampCriterionScore(raw: unknown): number {
  return Math.min(10, Math.max(0, Math.round(Number(raw ?? 0))));
}

function parseCriterionRow(raw: unknown): EnglishCriterionScore {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    score: clampCriterionScore(row.score),
    feedback: String(row.feedback ?? "").trim().slice(0, 800),
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
      const quote = String(row.quote ?? "").trim().slice(0, 500);
      const typeRaw = String(row.type ?? "").trim().toLowerCase();
      const type = typeRaw === "strength" ? "strength" : typeRaw === "improvement" ? "improvement" : null;
      if (!quote || !type) return null;
      const criterionRaw = String(row.criterion ?? "").trim().toLowerCase() as EnglishCriterionKey;
      const criterion = validCriteria.has(criterionRaw) ? criterionRaw : undefined;
      const feedback = String(row.feedback ?? "").trim().slice(0, 600);
      if (!feedback) return null;
      return { quote, type, criterion, feedback };
    })
    .filter((h): h is EnglishHighlight => h != null)
    .slice(0, 20);
}

export async function scoreEnglishResponse(
  env: OpenAiEnv,
  input: EnglishScoreInput,
): Promise<EnglishScoreResult> {
  const apiKey = requireOpenAiKey(env);
  const model = openAiModel(env);
  const promptText = String(input.promptText ?? "").trim();

  const parsed = await chatJson(apiKey, model, [
    {
      role: "system",
      content: `You are a VCE English essay assessor (Study Design 2024–2027).
${formatSubjectMarkingContextBlock(input.subjectContext)}

Return JSON only:
{
  "score": integer 0-10,
  "summary": "2-4 sentence overall assessment",
  "criteria": {
    "structure": { "score": 0-10, "feedback": "2-3 sentences" },
    "evidence": { "score": 0-10, "feedback": "2-3 sentences" },
    "expression": { "score": 0-10, "feedback": "2-3 sentences" },
    "relevance": { "score": 0-10, "feedback": "2-3 sentences" }
  },
  "highlights": [
    {
      "quote": "exact substring from essay",
      "type": "strength" | "improvement",
      "criterion": "structure" | "evidence" | "expression" | "relevance",
      "feedback": "specific feedback for this phrase"
    }
  ]
}

${ENGLISH_CRITERIA_RUBRIC}

If no prompt was provided, assess relevance against the essay's own stated topic and internal coherence.
Be fair, constructive, and specific — quote the student's words in highlights.`,
    },
    {
      role: "user",
      content: JSON.stringify({
        prompt: promptText.slice(0, 6000) || "(No prompt provided — assess the essay on its own terms.)",
        response: input.responseText.slice(0, 20000),
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
    summary: String(parsed.summary ?? parsed.feedback ?? "").trim().slice(0, 2000),
    criteria,
    highlights: parseEnglishHighlights(parsed.highlights),
  };
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
  const apiKey = requireOpenAiKey(env);
  const model = openAiModel(env);
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

  const parsed = await chatJson(apiKey, model, [
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
  const apiKey = requireOpenAiKey(env);
  const model = openAiModel(env);
  const questionBlock = JSON.stringify(input.question, null, 2);
  const subjectBlock = formatSubjectMarkingContextBlock(input.subjectContext);

  const systemContent = `You are Nodent, a private VCE tutor helping a student with ONE practice question.

CURRENT QUESTION (no model answers included):
${questionBlock}
${subjectBlock ? `\nSUBJECT NOTES:\n${subjectBlock}` : ""}

Rules:
- Only help with this question and its underlying topic. Briefly redirect off-topic questions.
- Do NOT restate, summarise, or rephrase the question — the student can already read it.
- Never open with "This question asks you to…" or quiz them with "Do you recall…?"
- Give one concrete hint or first step they can do right now (e.g. identify givens, write a formula with their values, sketch a diagram, state what to substitute).
- On the first reply: one focused starting move only — actionable, not a lecture.
- Follow-ups: answer their specific question with the next small step.
- Do NOT state the final numerical answer or the correct MCQ letter unless the student has clearly attempted the question and explicitly asks what they are missing — even then, prefer the next step over a full solution.
- Never reveal mark-scheme model answers or accepted-answer lists.
- Use Australian VCE terminology. Keep replies concise (2–4 short sentences or 2–3 bullets max).
- Use LaTeX for maths: $...$ inline, $$...$$ display.`;

  const chatMessages: ChatMessage[] = [{ role: "system", content: systemContent }];
  for (const turn of input.messages.slice(-24)) {
    const content = String(turn.content ?? "").trim().slice(0, 4000);
    if (!content) continue;
    chatMessages.push({
      role: turn.role === "assistant" ? "assistant" : "user",
      content,
    });
  }

  if (chatMessages.length === 1) {
    chatMessages.push({
      role: "user",
      content: "Give me one hint — a concrete first step to get started. Do not restate the question.",
    });
  }

  const { systemInstruction, contents } = splitGeminiMessages(chatMessages);
  const reply = await geminiGenerateText(apiKey, model, { systemInstruction, contents });
  return { reply: reply.trim().slice(0, 8000) };
}
