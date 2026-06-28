/**
 * Upsert questions from a JSON import file into the demo bank (no delete).
 *
 *   node scripts/add-demo-questions-from-json.mjs imports/demo-methods-hard-multipart-5.json
 *   node scripts/add-demo-questions-from-json.mjs imports/demo-methods-hard-multipart-5.json --apply
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const APPLY = process.argv.includes("--apply");
const file = process.argv.find((a) => a.endsWith(".json"));
if (!file) {
  console.error("Usage: node scripts/add-demo-questions-from-json.mjs <file.json> [--apply]");
  process.exit(1);
}

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  const devVars = resolve(".dev.vars");
  if (!existsSync(devVars)) throw new Error("DATABASE_URL not set and .dev.vars missing");
  const raw = readFileSync(devVars, "utf8");
  const m = raw.match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error("DATABASE_URL not found in .dev.vars");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

function toJsonArray(val) {
  if (!val) return null;
  if (Array.isArray(val)) {
    const items = val.map((x) => String(x ?? "").trim()).filter(Boolean);
    return items.length ? JSON.stringify(items) : null;
  }
  return null;
}

function needsAiMarking(q) {
  if (q.useAiMarking === true) return 1;
  if (q.useAiMarking === false) return 0;
  const type = String(q.type ?? "").toLowerCase();
  if (type === "mcq") return 0;
  const texts = [q.question, ...(q.answerParts ?? []).map((p) => p.label)].join(" ");
  if (/\b(explain|prove|show\s+that|justify|verify|discuss|describe|sketch|hence|interpret)\b/i.test(texts)) return 1;
  if (type === "long_answer") return 1;
  return 0;
}

const payload = JSON.parse(readFileSync(resolve(file), "utf8"));
const questions = Array.isArray(payload) ? payload : payload.questions;
if (!questions?.length) {
  console.error("No questions in file.");
  process.exit(1);
}

console.log(`Loaded ${questions.length} question(s) from ${file}`);

if (!APPLY) {
  for (const q of questions) {
    console.log(`  • [${q.topic}] ${String(q.question).slice(0, 72)}…`);
  }
  console.log("Dry run — pass --apply to upsert into demo.");
  process.exit(0);
}

const sql = neon(loadDatabaseUrl());
let inserted = 0;
let updated = 0;

for (const q of questions) {
  const subjectId = String(q.subjectId ?? "demo").trim().toLowerCase();
  const answerPartsJson = q.answerParts?.length ? JSON.stringify(q.answerParts) : null;
  const imageUrlsJson = q.imageUrls?.length ? JSON.stringify(q.imageUrls) : null;
  const ai = needsAiMarking(q);

  const existing = await sql`
    SELECT id FROM custom_questions
    WHERE LOWER(TRIM(subject_id)) = ${subjectId}
      AND LOWER(TRIM(question)) = LOWER(TRIM(${q.question}))
    LIMIT 1
  `;

  if (existing.length) {
    await sql`
      UPDATE custom_questions
      SET
        type = ${q.type},
        topic = ${q.topic},
        options = ${toJsonArray(q.options)},
        answer = ${q.answer ?? null},
        accepted_answers = ${toJsonArray(q.acceptedAnswers)},
        answer_parts_json = ${answerPartsJson},
        guidance = ${q.guidance ?? null},
        passage = ${q.passage ?? null},
        marks = ${q.marks ?? null},
        image_urls = ${imageUrlsJson},
        ai_marking_enabled = ${ai}
      WHERE id = ${existing[0].id}
    `;
    console.log(`Updated id ${existing[0].id}: ${String(q.topic)}`);
    updated++;
    continue;
  }

  const row = await sql`
    INSERT INTO custom_questions (
      subject_id, type, topic, question, options, answer, accepted_answers,
      answer_parts_json, guidance, passage, marks, image_urls, ai_marking_enabled, created_at
    ) VALUES (
      ${subjectId},
      ${q.type},
      ${q.topic},
      ${q.question},
      ${toJsonArray(q.options)},
      ${q.answer ?? null},
      ${toJsonArray(q.acceptedAnswers)},
      ${answerPartsJson},
      ${q.guidance ?? null},
      ${q.passage ?? null},
      ${q.marks ?? null},
      ${imageUrlsJson},
      ${ai},
      ${Date.now()}
    )
    RETURNING id
  `;
  console.log(`Inserted id ${row[0].id}: ${String(q.topic)}`);
  inserted++;
}

const count = await sql`
  SELECT COUNT(*)::int AS n FROM custom_questions WHERE LOWER(TRIM(subject_id))='demo'
`;
console.log(`Done. inserted=${inserted}, updated=${updated}, demo total=${count[0].n}`);
