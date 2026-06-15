/**
 * Import questions from JSON into custom_questions (Neon).
 * Sets created_at early so rows sort before existing bank items in bootstrap/admin.
 *
 * Usage:
 *   node scripts/import-questions-json.mjs imports/methods-50-hard-vce-style.json
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const raw = readFileSync(resolve(".dev.vars"), "utf8");
  const m = raw.match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error("DATABASE_URL not found in .dev.vars");
  return m[1].trim();
}

function canonicalSubjectId(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  const aliases = {
    "mathematical methods": "methods",
    "math methods": "methods",
    "general mathematics": "general-maths",
    "general maths": "general-maths",
    "specialist mathematics": "specialist-maths",
    "specialist maths": "specialist-maths",
  };
  return aliases[s] ?? s;
}

function toJsonArray(val) {
  if (!val) return null;
  if (Array.isArray(val)) {
    const items = val.map((x) => String(x ?? "").trim()).filter(Boolean);
    return items.length ? JSON.stringify(items) : null;
  }
  return null;
}

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/import-questions-json.mjs <questions.json>");
  process.exit(1);
}

const payload = JSON.parse(readFileSync(resolve(file), "utf8"));
const questions = Array.isArray(payload) ? payload : payload.questions;
if (!Array.isArray(questions) || !questions.length) {
  console.error("JSON must be an array or { questions: [...] }.");
  process.exit(1);
}

const sql = neon(loadDatabaseUrl());

function questionStemKey(subjectId, question) {
  const sid = canonicalSubjectId(subjectId);
  const stem = String(question ?? "").trim().toLowerCase().replace(/\s+/g, " ");
  return stem ? `${sid}::${stem}` : "";
}

const existingRows = await sql`
  SELECT subject_id, question
  FROM custom_questions
`;
const existingStems = new Set(
  existingRows.map((r) => questionStemKey(r.subject_id, r.question)).filter(Boolean),
);

let imported = 0;
let skipped = 0;
const errors = [];
const baseTime = Date.UTC(2020, 0, 1, 0, 0, 0);

for (let i = 0; i < questions.length; i++) {
  const q = questions[i] ?? {};
  const subjectId = canonicalSubjectId(q.subjectId ?? q.subject_id);
  const type = String(q.type ?? "").trim().toLowerCase();
  const topic = String(q.topic ?? "General").trim() || "General";
  const question = String(q.question ?? "").trim();
  const passage = q.passage ? String(q.passage).trim() : null;
  const guidance = q.guidance ? String(q.guidance).trim() : null;
  const answer = q.answer ?? q.correctAnswer;
  const answerText = answer != null ? String(answer).trim() : null;
  const marksDefault = type === "mcq" ? 1 : 2;
  const marksRaw = Number(q.marks ?? marksDefault);
  const marks = Number.isFinite(marksRaw) ? Math.max(1, Math.round(marksRaw)) : marksDefault;
  const optionsJson = toJsonArray(q.options);
  const acceptedJson = toJsonArray(q.acceptedAnswers ?? q.accepted_answers);
  const imageJson = toJsonArray(q.imageUrls ?? q.image_urls);
  const createdAt = new Date(baseTime + i * 1000).toISOString();

  if (!subjectId || !type || !question) {
    errors.push({ index: i, message: "Missing subjectId, type, or question." });
    continue;
  }

  const stemKey = questionStemKey(subjectId, question);
  if (stemKey && existingStems.has(stemKey)) {
    skipped++;
    continue;
  }

  try {
    await sql`
      INSERT INTO custom_questions (
        subject_id, type, topic, question, image_urls, options, answer,
        accepted_answers, guidance, passage, marks, created_at
      ) VALUES (
        ${subjectId},
        ${type},
        ${topic},
        ${question},
        ${imageJson},
        ${optionsJson},
        ${answerText},
        ${acceptedJson},
        ${guidance},
        ${passage},
        ${marks},
        ${createdAt}
      )
    `;
    existingStems.add(stemKey);
    imported++;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/custom_questions_subject_stem_unique|duplicate key/i.test(msg)) {
      skipped++;
      continue;
    }
    errors.push({ index: i, message: msg });
  }
}

const subjectIds = [...new Set(questions.map((q) => canonicalSubjectId(q.subjectId ?? q.subject_id)))];
const countRows = await sql`
  SELECT subject_id, COUNT(*)::int AS n
  FROM custom_questions
  WHERE subject_id = ANY(${subjectIds})
  GROUP BY subject_id
`;

console.log(`File: ${file}`);
console.log(`Imported: ${imported}`);
console.log(`Skipped (duplicate stem): ${skipped}`);
if (errors.length) {
  console.error("Errors:", errors.slice(0, 5));
  process.exit(1);
}
for (const row of countRows) {
  console.log(`${row.subject_id} count in DB:`, row.n);
}
