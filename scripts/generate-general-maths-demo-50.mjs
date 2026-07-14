/**
 * Generate 50 hard VCE General Mathematics-style questions (inspired by
 * imports/general-50-hard-vce-style.json) and insert into demo.
 *
 *   node scripts/generate-general-maths-demo-50.mjs           # generate + dry-run insert
 *   node scripts/generate-general-maths-demo-50.mjs --apply # insert into demo
 *   node scripts/generate-general-maths-demo-50.mjs --import-only imports/general-demo-50-hard-vce-style.json --apply
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { assertLiveOpenAiScript, openAiScriptFetch } from "./lib/openai-script-safety.mjs";

const APPLY = process.argv.includes("--apply");
const IMPORT_ONLY = process.argv.includes("--import-only");
const importFileArg = process.argv.find((a) => a.endsWith(".json"));

const GENERAL_TOPICS = [
  "Data analysis",
  "Recursion and financial modelling",
  "Matrices",
  "Networks and decision mathematics",
];

const TOPIC_COUNTS = {
  "Data analysis": 13,
  "Recursion and financial modelling": 13,
  "Matrices": 12,
  "Networks and decision mathematics": 12,
};

function loadEnv() {
  const out = {};
  if (process.env.DATABASE_URL) out.DATABASE_URL = process.env.DATABASE_URL.trim();
  if (process.env.OPENAI_API_KEY) out.OPENAI_API_KEY = process.env.OPENAI_API_KEY.trim();
  if (process.env.OPENAI_MODEL) out.OPENAI_MODEL = process.env.OPENAI_MODEL.trim();
  const devVars = resolve(process.cwd(), ".dev.vars");
  if (existsSync(devVars)) {
    for (const line of readFileSync(devVars, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z_]+)=(.+)$/);
      if (m && !out[m[1]]) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
  return out;
}

function toJsonArray(val) {
  if (!val) return null;
  if (Array.isArray(val)) {
    const items = val.map((x) => String(x ?? "").trim()).filter(Boolean);
    return items.length ? JSON.stringify(items) : null;
  }
  return null;
}

function stemKey(subjectId, question) {
  return `${subjectId}::${String(question ?? "").trim().toLowerCase().replace(/\s+/g, " ")}`;
}

function needsAiMarking(q) {
  if (q.useAiMarking === true) return 1;
  if (q.useAiMarking === false) return 0;
  const type = String(q.type ?? "").toLowerCase();
  if (type === "mcq") return 0;
  const texts = [q.question, ...(q.answerParts ?? []).map((p) => p.label)]
    .map((t) => String(t ?? ""))
    .join(" ");
  if (
    /\b(explain|prove|show\s+that|justify|verify|discuss|describe|interpret|hence)\b/i.test(
      texts,
    )
  ) {
    return 1;
  }
  if (type === "long_answer") return 1;
  const acc = q.acceptedAnswers ?? [];
  if (acc.some((a) => /see marking guide/i.test(a))) return 1;
  return 0;
}

function mapRowToReference(r) {
  return {
    type: r.type,
    topic: r.topic,
    marks: r.marks,
    question: r.question,
    passage: r.passage ?? undefined,
    guidance: r.guidance ?? undefined,
    options: r.options ? (typeof r.options === "string" ? JSON.parse(r.options) : r.options) : undefined,
    answer: r.answer ?? undefined,
    acceptedAnswers: r.acceptedAnswers
      ? r.acceptedAnswers
      : r.accepted_answers
        ? typeof r.accepted_answers === "string"
          ? JSON.parse(r.accepted_answers)
          : r.accepted_answers
        : undefined,
    answerParts: r.answerParts
      ? r.answerParts
      : r.answer_parts_json
        ? typeof r.answer_parts_json === "string"
          ? JSON.parse(r.answer_parts_json)
          : r.answer_parts_json
        : undefined,
    useAiMarking: r.useAiMarking ?? r.ai_marking_enabled === 1,
  };
}

async function loadReferenceQuestions(sql) {
  const jsonPath = resolve(process.cwd(), "imports/general-50-hard-vce-style.json");
  const refs = [];
  if (existsSync(jsonPath)) {
    const payload = JSON.parse(readFileSync(jsonPath, "utf8"));
    const rows = Array.isArray(payload) ? payload : payload.questions ?? [];
    for (const topic of GENERAL_TOPICS) {
      const topicRows = rows.filter((r) => String(r.topic ?? "").trim() === topic);
      refs.push(...topicRows.slice(0, 4).map(mapRowToReference));
    }
  }

  if (refs.length < 8) {
    const dbRows = await sql`
      SELECT type, topic, marks, question, passage, guidance, options, answer,
             accepted_answers, answer_parts_json, ai_marking_enabled
      FROM custom_questions
      WHERE LOWER(TRIM(subject_id)) = 'general-maths'
        AND marks >= 2
      ORDER BY marks DESC, id DESC
      LIMIT 16
    `;
    for (const r of dbRows) {
      refs.push(mapRowToReference(r));
    }
  }

  const seen = new Set();
  return refs.filter((r) => {
    const k = stemKey("ref", r.question);
    if (!k || seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function parseModelJson(content) {
  const trimmed = String(content ?? "").trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new Error(`Invalid JSON from model: ${trimmed.slice(0, 200)}`);
  }
}

async function callOpenAiForTopic(env, referenceQuestions, topic, count) {
  assertLiveOpenAiScript("generate_general_maths_demo_50");
  const model = env.OPENAI_MODEL || "gpt-4o-mini";
  const topicRefs = referenceQuestions.filter((r) => r.topic === topic).slice(0, 5);
  const otherRefs = referenceQuestions.filter((r) => r.topic !== topic).slice(0, 3);

  const system = `You write original VCE General Mathematics (Units 3 & 4) exam-style questions for an Australian study app.

Return JSON only:
{"questions":[...]}

Each question object:
- subjectId: "demo" (always)
- type: "mcq" | "short_answer" | "long_answer"
- topic: "${topic}" (exactly this string)
- question: student-facing stem — realistic applied scenarios; never duplicate stems within the batch
- options: string[4] and answer: "A"|"B"|"C"|"D" (MCQ only — option text must NOT repeat A/B/C/D prefixes)
- acceptedAnswers: string[] required for non-MCQ — for multipart, one string per part (semicolons for alternates within one part)
- marks: integer 2–4 (MCQ = 1)
- guidance: brief marking notes (admin only — not shown to students)
- answerParts: optional — {key, label, marks, acceptedAnswer, placeholder}; label must be a full instruction (e.g. "Calculate the variance.") — NEVER bare "a)" or "b)"
- useAiMarking: boolean — true for explain/interpret/justify/hence; false for pure calculation

DIFFICULTY: VERY HARD — suitable for strong students. Multi-step reasoning, subtle distractors, applied contexts (finance, data, matrices, networks). Avoid one-line drill. Mix MCQ and written; include multipart long_answer where appropriate.

MULTIPART RULES:
- The main question stem sets up the scenario only — do not ask in the stem for things answered in parts.
- Each answerParts.label is what the student sees above that input (e.g. "Calculate the variance.", "Calculate the standard deviation.").
- Do not embed a) b) prompts in the main stem when using answerParts.

STYLE: Match the reference bank — VCE General Maths notation, LaTeX $...$, calculator-appropriate.

PLATFORM CONSTRAINTS (critical): Students answer in plain text fields only — no drawing, tables, graphs, or uploads.
- Never ask to construct/create/draw/sketch/plot/complete/fill in a table, graph, or diagram.
- Each distinct calculation or result gets its own answer part and input field.
- short_answer = exactly ONE thing to find. Two steps → long_answer with answerParts (a), b)).

REFERENCE EXAMPLES FOR THIS TOPIC:
${JSON.stringify(topicRefs, null, 2)}

OTHER TOPIC EXAMPLES (style only):
${JSON.stringify(otherRefs, null, 2)}`;

  const user = `Generate exactly ${count} unique VERY DIFFICULT questions on topic "${topic}". At least one multipart long_answer if count >= 3.`;

  const res = await openAiScriptFetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 2500,
      temperature: 0.75,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  }, { feature: "generate_general_maths_demo_50" });

  if (!res.ok) {
    throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 500)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  const parsed = parseModelJson(content);
  const rows = Array.isArray(parsed.questions) ? parsed.questions : [];
  return rows.map((r) => normalizeQuestion({ ...r, topic })).filter(Boolean);
}

function questionAsksImpossibleVisualTask(texts) {
  const blob = texts.map((t) => String(t ?? "")).join("\n");
  return (
    /\b(construct|create|draw|sketch|plot|complete|fill in)\b[^.]{0,40}\b(table|graph|diagram|number line)\b/i.test(
      blob,
    ) || /\bprobability distribution table\b/i.test(blob)
  );
}

function questionNeedsMultipartSplit(q) {
  if (q.answerParts?.length >= 2) return false;
  const stem = String(q.question ?? "");
  if (/\bfind\b[^.]{0,100}\band\s+(evaluate|calculate)\b/i.test(stem)) return true;
  if (/simplify[^.]{0,80}\band\s+state/i.test(stem)) return true;
  if (/estimate[^.]{0,100}\band\s+(provide|give)\b/i.test(stem)) return true;
  if (/simultaneous equations/i.test(stem)) return true;
  const acc = q.acceptedAnswers ?? [];
  if (acc.length >= 2 && !acc.some((a) => /see marking guide/i.test(String(a)))) return true;
  return false;
}

function isBarePartLabel(label) {
  return /^[a-z]\)?$/i.test(String(label ?? "").trim());
}

function normalizeQuestion(row) {
  const question = String(row.question ?? "").trim();
  if (!question) return null;
  const type = String(row.type ?? "short_answer").toLowerCase();
  const topic = String(row.topic ?? "").trim();
  if (!GENERAL_TOPICS.includes(topic)) return null;

  const answerParts = Array.isArray(row.answerParts)
    ? row.answerParts
        .map((p, i) => ({
          key: String(p.key ?? String.fromCharCode(97 + i)),
          label: String(p.label ?? "").trim(),
          marks: Math.max(1, Math.round(Number(p.marks) || 1)),
          acceptedAnswer: p.acceptedAnswer != null ? String(p.acceptedAnswer).trim() : undefined,
          placeholder: p.placeholder?.trim() ? p.placeholder : "Type your answer…",
        }))
        .filter((p) => p.label)
    : undefined;

  if (answerParts?.some((p) => isBarePartLabel(p.label))) return null;

  let acceptedAnswers = Array.isArray(row.acceptedAnswers)
    ? row.acceptedAnswers.map((a) => String(a ?? "").trim()).filter(Boolean)
    : undefined;

  if (answerParts?.length) {
    const fromParts = answerParts
      .map((p) => p.acceptedAnswer)
      .filter((a) => a && String(a).trim());
    if (fromParts.length === answerParts.length) {
      acceptedAnswers = fromParts;
    }
  }

  let marks = Math.max(1, Math.round(Number(row.marks) || 2));
  if (answerParts?.length) {
    const partSum = answerParts.reduce((s, p) => s + (p.marks || 1), 0);
    marks = Math.max(marks, partSum);
  }
  if (type === "mcq") marks = 1;

  if (type === "mcq" && (!row.options?.length || row.answer == null)) return null;
  if (type !== "mcq" && !acceptedAnswers?.length) return null;

  const taskTexts = [question, ...(answerParts ?? []).map((p) => p.label)];
  if (questionAsksImpossibleVisualTask(taskTexts)) return null;

  const draft = {
    subjectId: "demo",
    type: type === "mcq" ? "mcq" : type === "long_answer" ? "long_answer" : "short_answer",
    topic,
    question,
    options: Array.isArray(row.options)
      ? row.options.map((o) => String(o).trim()).filter(Boolean)
      : undefined,
    answer: row.answer != null ? String(row.answer).trim() : undefined,
    acceptedAnswers,
    marks,
    guidance: row.guidance ? String(row.guidance).trim() : undefined,
    passage: row.passage ? String(row.passage).trim() : undefined,
    answerParts,
    useAiMarking: row.useAiMarking,
  };
  if (questionNeedsMultipartSplit(draft)) return null;

  return draft;
}

function validateBatch(questions) {
  const errors = [];
  const stems = new Set();
  const topicCounts = new Map(GENERAL_TOPICS.map((t) => [t, 0]));

  for (const q of questions) {
    const sk = stemKey("demo", q.question);
    if (stems.has(sk)) errors.push(`Duplicate stem: ${q.question.slice(0, 60)}`);
    stems.add(sk);
    topicCounts.set(q.topic, (topicCounts.get(q.topic) ?? 0) + 1);
    if (questionNeedsMultipartSplit(q)) {
      errors.push(`Needs multipart answerParts: ${q.question.slice(0, 60)}`);
    }
    if (questionAsksImpossibleVisualTask([q.question, ...(q.answerParts ?? []).map((p) => p.label)])) {
      errors.push(`Impossible visual task: ${q.question.slice(0, 60)}`);
    }
  }

  for (const [topic, expected] of Object.entries(TOPIC_COUNTS)) {
    const got = topicCounts.get(topic) ?? 0;
    if (got !== expected) errors.push(`Topic ${topic}: expected ${expected}, got ${got}`);
  }

  return errors;
}

async function generateAll(env, sql) {
  const referenceQuestions = await loadReferenceQuestions(sql);
  console.log(`Loaded ${referenceQuestions.length} reference question(s).`);

  const all = [];
  const stems = new Set();

  for (const [topic, count] of Object.entries(TOPIC_COUNTS)) {
    console.log(`\nGenerating ${count} for: ${topic}`);
    let added = 0;
    let attempts = 0;
    while (added < count && attempts < 8) {
      const need = Math.min(5, count - added);
      let batch = [];
      try {
        batch = await callOpenAiForTopic(env, referenceQuestions, topic, need);
      } catch (e) {
        console.warn(`  API error: ${e instanceof Error ? e.message : e}`);
        attempts++;
        continue;
      }
      for (const q of batch) {
        const sk = stemKey("demo", q.question);
        if (stems.has(sk)) continue;
        stems.add(sk);
        all.push(q);
        added++;
        if (added >= count) break;
      }
      attempts++;
      if (added < count) console.log(`  Retry ${attempts} — ${added}/${count}`);
    }
    console.log(`  Added ${added}`);
  }

  const errors = validateBatch(all);
  if (errors.length) {
    console.warn("\nValidation warnings:");
    for (const e of errors) console.warn("  -", e);
  }

  if (all.length < 50) throw new Error(`Only ${all.length} questions generated.`);
  return all.slice(0, 50);
}

async function importToDemo(sql, questions) {
  const existing = await sql`
    SELECT subject_id, question FROM custom_questions WHERE LOWER(TRIM(subject_id)) = 'demo'
  `;
  const stems = new Set(existing.map((r) => stemKey("demo", r.question)));

  let imported = 0;
  let skipped = 0;
  const now = Date.now();

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    if (stems.has(stemKey("demo", q.question))) {
      skipped++;
      continue;
    }

    const answerPartsJson = q.answerParts?.length ? JSON.stringify(q.answerParts) : null;
    const optionsJson = toJsonArray(q.options);
    const acceptedJson = toJsonArray(q.acceptedAnswers);
    const aiMarking = needsAiMarking(q);

    try {
      await sql`
        INSERT INTO custom_questions (
          subject_id, type, topic, question, options, answer, accepted_answers,
          answer_parts_json, guidance, passage, marks, ai_marking_enabled, created_at
        ) VALUES (
          ${"demo"},
          ${q.type},
          ${q.topic},
          ${q.question},
          ${optionsJson},
          ${q.answer ?? null},
          ${acceptedJson},
          ${answerPartsJson},
          ${q.guidance ?? null},
          ${q.passage ?? null},
          ${q.marks},
          ${aiMarking},
          ${new Date(now + i * 1000).toISOString()}
        )
      `;
      stems.add(stemKey("demo", q.question));
      imported++;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/custom_questions_subject_stem_unique|duplicate key/i.test(msg)) {
        skipped++;
      } else {
        throw e;
      }
    }
  }

  return { imported, skipped };
}

const env = loadEnv();
if (!env.DATABASE_URL) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const sql = neon(env.DATABASE_URL);
const outPath = resolve(process.cwd(), "imports", "general-demo-50-hard-vce-style.json");

let questions;
if (IMPORT_ONLY && importFileArg) {
  const payload = JSON.parse(readFileSync(resolve(importFileArg), "utf8"));
  questions = (Array.isArray(payload) ? payload : payload.questions)
    .map(normalizeQuestion)
    .filter(Boolean);
  console.log(`Loaded ${questions.length} questions from ${importFileArg}`);
} else {
  if (!env.OPENAI_API_KEY) {
    console.error("Missing OPENAI_API_KEY");
    process.exit(1);
  }
  questions = await generateAll(env, sql);
  writeFileSync(outPath, JSON.stringify({ questions }, null, 2));
  console.log(`\nWrote ${outPath} (${questions.length} questions)`);

  const multipart = questions.filter((q) => q.answerParts?.length).length;
  const mcq = questions.filter((q) => q.type === "mcq").length;
  console.log(`Multipart: ${multipart}, MCQ: ${mcq}`);
}

if (!APPLY) {
  console.log("\nDry run — pass --apply to insert into demo.");
  process.exit(0);
}

const { imported, skipped } = await importToDemo(sql, questions);
const count = await sql`
  SELECT COUNT(*)::int AS n FROM custom_questions WHERE LOWER(TRIM(subject_id)) = 'demo'
`;
console.log(`\nImported ${imported}, skipped ${skipped}. Demo total: ${count[0]?.n ?? 0}`);
