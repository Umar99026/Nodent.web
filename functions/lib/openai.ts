/**
 * OpenAI Chat Completions for Cloudflare Workers / Pages Functions.
 * Server-side only — never expose OPENAI_API_KEY to the browser.
 *
 * Env:
 *   OPENAI_API_KEY  (required for AI features)
 *   OPENAI_MODEL    (optional, default gpt-4o-mini)
 */

export type OpenAiEnv = {
  OPENAI_API_KEY?: string;
  OPENAI_MODEL?: string;
};

const DEFAULT_MODEL = "gpt-4o-mini";

function trim(s: string | undefined): string {
  return String(s ?? "").trim();
}

export function openAiConfigured(env: OpenAiEnv): boolean {
  return !!trim(env.OPENAI_API_KEY);
}

export function requireOpenAiKey(env: OpenAiEnv): string {
  const key = trim(env.OPENAI_API_KEY);
  if (!key) throw new Error("OPENAI_API_KEY is not configured.");
  return key;
}

export function openAiModel(env: OpenAiEnv): string {
  return trim(env.OPENAI_MODEL) || DEFAULT_MODEL;
}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function chatJson(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
): Promise<Record<string, unknown>> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.2,
      response_format: { type: "json_object" },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`OpenAI error (${res.status}): ${errText.slice(0, 600)}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned an empty response.");

  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    throw new Error("OpenAI returned invalid JSON.");
  }
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
};

export type LongAnswerMarkResult = {
  correct: boolean;
  scorePercent: number;
  marksAwarded: number;
  maxMarks: number;
  feedback: string;
  partResults: { index: number; correct: boolean; marksAwarded: number }[];
};

export async function markLongAnswer(
  env: OpenAiEnv,
  input: LongAnswerMarkInput,
): Promise<LongAnswerMarkResult> {
  const apiKey = requireOpenAiKey(env);
  const model = openAiModel(env);

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
  };

  const parsed = await chatJson(apiKey, model, [
    {
      role: "system",
      content: `You mark student responses for VCE-style questions.
Return JSON:
{
  "correct": boolean (true if broadly correct for full credit),
  "scorePercent": 0-100,
  "marksAwarded": number (0 to maxMarks, can be fractional .5),
  "maxMarks": number,
  "feedback": "2-4 sentences, constructive",
  "partResults": [{"index":0,"correct":true,"marksAwarded":1}]
}

Be fair: accept equivalent methods and reasonable rounding. For multipart, grade each part.
Use guidance and acceptedAnswers as the rubric when provided.`,
    },
    {
      role: "user",
      content: JSON.stringify(payload),
    },
  ]);

  const maxMarks = Math.max(1, Math.round(Number(parsed.maxMarks ?? input.marks) || input.marks));
  const marksAwarded = Math.min(
    maxMarks,
    Math.max(0, Number(parsed.marksAwarded ?? 0)),
  );
  const scorePercent = Math.min(
    100,
    Math.max(0, Math.round(Number(parsed.scorePercent ?? (marksAwarded / maxMarks) * 100))),
  );
  const partResults = Array.isArray(parsed.partResults)
    ? (parsed.partResults as Record<string, unknown>[]).map((p, idx) => ({
        index: Number.isFinite(Number(p.index)) ? Number(p.index) : idx,
        correct: Boolean(p.correct),
        marksAwarded: Math.max(0, Number(p.marksAwarded ?? 0)),
      }))
    : [];

  return {
    correct: Boolean(parsed.correct ?? marksAwarded >= maxMarks * 0.5),
    scorePercent,
    marksAwarded,
    maxMarks,
    feedback: String(parsed.feedback ?? "").trim().slice(0, 2000),
    partResults,
  };
}

export type EnglishScoreInput = {
  promptText: string;
  section: string;
  responseType: string;
  responseText: string;
};

export type EnglishScoreResult = {
  score: number;
  feedback: string;
};

/** VCAA VCE English criteria + expected qualities (Study Design 2024–2027). Embedded in smart-marking prompt. */
const ENGLISH_SMART_MARKING_RUBRIC = `
ASSESSMENT CRITERIA (apply the section that matches the student's section field)

Section A:
- knowledge and understanding of the text, its structure, and the ideas, concerns and values it explores
- development of a coherent analysis in response to the topic
- use of evidence from the text to support the analysis
- use of fluent expression through appropriate use of vocabulary and conventions of Standard Australian English

Section B:
- use of relevant idea(s) drawn from one Framework of Ideas, the title provided and at least one piece of stimulus material
- creation of a cohesive text that connects to a clear purpose(s) and incorporates an appropriate voice
- use of suitable text structure(s) and language features to create a text
- use of fluent expression, including the appropriate use of vocabulary

Section C:
- understanding of contention, argument(s), and point of view
- analysis of the ways in which written and spoken language and visuals are used to present an argument(s) and to persuade an intended audience
- use of evidence from the text to support the analysis
- use of fluent expression through appropriate use of vocabulary and conventions of Standard Australian English

MARKING APPROACH:
- Mark holistically, relating student performance to the published criteria and ranking over the full range of marks (0–10).
- Use the "Expected qualities" descriptors below to determine the mark. Match the student's response to the band whose qualities best describe their work overall.
- For Section B, consider Framework of Ideas, textual form, audience and purpose (VCE English Study Design 2024–2027).

EXPECTED QUALITIES – SECTION A
9–10: Close perceptive reading; complexities of ideas/concerns/values via structure and language; clear understanding of topic implications with appropriate strategy; cogent, controlled, well-substantiated discussion; precise expressive language.
8: Thoughtful reading; explores ideas/concerns/values via structure and language; understands topic implications from the text; detailed substantiated coherent discussion; fluent confident language.
7: Detailed knowledge throughout including ideas/concerns/values; acknowledges structure and language; understands topic; sustained well-supported response; organised writing; accurate appropriate language.
6: Clear knowledge including some ideas/concerns/values; some awareness of structure and language; response to topic supported by appropriate evidence; generally organised; mostly accurate language.
5: Adequate knowledge; some reference to ideas/concerns/values; understands topic with evidence from text; communicates adequately with some organisation.
4: Basic knowledge; limited reference to ideas/concerns/values; some understanding of topic; adequate expression and language control.
3: Familiarity with text; limited awareness of topic; basic expression and language control.
1–2: Limited familiarity with text; very limited awareness of topic; language not always clear.
0: No knowledge of text and/or no attempt to engage with topic and/or minimal language control.

EXPECTED QUALITIES – SECTION B
9–10: Insightful consideration of title and stimulus in connection with a Framework of Ideas; cohesive text with explicit purpose(s) and appropriate voice; sophisticated control of language and structure; rich vocabulary and language features.
8: Astute exploration of title/stimulus and Framework; coherent text with explicit purpose(s) and voice; confident control; thoughtful vocabulary and features.
7: Detailed connection to title/stimulus and Framework; coordinated text with clear purpose(s) and voice; sound control; clear vocabulary and features.
6: Clear connection to title/stimulus with reference to Framework; connected text with clear purpose(s) and voice; clear control; effective vocabulary and features.
5: Adequate connection to title/stimulus and Framework; organised text linked to purpose(s) with appropriate voice; adequate control; some vocabulary and features.
4: Basic connection to title/stimulus; some purpose and voice awareness; basic control; simple vocabulary and features.
3: Limited connection to title/stimulus; limited purpose or voice; limited control.
1–2: Little/no connection to title/stimulus; little awareness of purpose; language not always clear.
0: No knowledge of task and/or no attempt to engage.

EXPECTED QUALITIES – SECTION C
9–10: Perceptive understanding of contention, argument development and point of view; sophisticated insight into language/visuals persuading audience; sophisticated precise language.
8: Thoughtful understanding of contention, arguments and POV; sound insight into language/visuals building argument and persuading; confident language.
7: Detailed understanding of contention, arguments and POV; insight into language/visuals persuading audience; fluent expression.
6: Clear understanding of contention, arguments and POV; some awareness of language/visuals persuading; competent expression.
5: Adequate understanding of contention, arguments and POV; basic awareness of language/visuals; adequate language.
4: Basic understanding of contention, arguments and POV; describes language/visuals persuading; basic language.
3: Limited knowledge of arguments or POV; limited knowledge of language/visuals; attempts basic language.
1–2: Little understanding of material; minimal knowledge of task; language not always clear.
0: No understanding of task requirements.
`.trim();

export async function scoreEnglishResponse(
  env: OpenAiEnv,
  input: EnglishScoreInput,
): Promise<EnglishScoreResult> {
  const apiKey = requireOpenAiKey(env);
  const model = openAiModel(env);
  const section = String(input.section ?? "A").trim().toUpperCase().slice(0, 1) || "A";

  const parsed = await chatJson(apiKey, model, [
    {
      role: "system",
      content: `You are a VCE English assessor using official VCAA criteria and expected qualities (Study Design 2024–2027).

Return JSON only: {"score": integer 0-10, "feedback": "3-5 sentences"}

Score on the full VCAA range 0–10. Use the expected-qualities descriptors for the student's section to choose the mark band holistically — do not inflate marks.

In feedback:
- Briefly name 1–2 strengths relative to the section criteria.
- Briefly name 1–2 priorities for improvement tied to the criteria/descriptors.
- Use assessor tone: constructive, specific, not generic praise.

${ENGLISH_SMART_MARKING_RUBRIC}`,
    },
    {
      role: "user",
      content: JSON.stringify({
        section,
        responseType: input.responseType,
        prompt: input.promptText.slice(0, 6000),
        response: input.responseText.slice(0, 20000),
      }),
    },
  ]);

  const score = Math.min(10, Math.max(0, Math.round(Number(parsed.score ?? 0))));
  return {
    score,
    feedback: String(parsed.feedback ?? "").trim().slice(0, 2000),
  };
}
