/**
 * Replace demo bank with exactly the questions in a JSON import file.
 *   node scripts/replace-demo-from-json.mjs imports/methods-demo-50-vce-style.json --apply
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const APPLY = process.argv.includes("--apply");
const file = process.argv.find((a) => a.endsWith(".json"));
if (!file) {
  console.error("Usage: node scripts/replace-demo-from-json.mjs <file.json> --apply");
  process.exit(1);
}

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  const devVars = resolve(".dev.vars");
  const raw = readFileSync(devVars, "utf8");
  const m = raw.match(/^DATABASE_URL=(.+)$/m);
  return m[1].trim();
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
console.log(`Loaded ${questions.length} questions from ${file}`);

const before = await neon(loadDatabaseUrl())`
  SELECT COUNT(*)::int AS n FROM custom_questions WHERE LOWER(TRIM(subject_id))='demo'
`;
console.log(`Demo before: ${before[0].n}`);

if (!APPLY) {
  console.log("Dry run — pass --apply to delete demo and re-import.");
  process.exit(0);
}

const sql = neon(loadDatabaseUrl());
const deleted = await sql`DELETE FROM custom_questions WHERE LOWER(TRIM(subject_id))='demo' RETURNING id`;
console.log(`Deleted ${deleted.length} demo row(s).`);

const now = Date.now();
let imported = 0;
for (let i = 0; i < questions.length; i++) {
  const q = questions[i];
  const answerPartsJson = q.answerParts?.length ? JSON.stringify(q.answerParts) : null;
  await sql`
    INSERT INTO custom_questions (
      subject_id, type, topic, question, options, answer, accepted_answers,
      answer_parts_json, guidance, passage, marks, ai_marking_enabled, created_at
    ) VALUES (
      ${"demo"},
      ${q.type},
      ${q.topic},
      ${q.question},
      ${toJsonArray(q.options)},
      ${q.answer ?? null},
      ${toJsonArray(q.acceptedAnswers)},
      ${answerPartsJson},
      ${q.guidance ?? null},
      ${q.passage ?? null},
      ${q.marks},
      ${needsAiMarking(q)},
      ${new Date(now + i * 1000).toISOString()}
    )
  `;
  imported++;
}

const after = await sql`SELECT COUNT(*)::int AS n FROM custom_questions WHERE LOWER(TRIM(subject_id))='demo'`;
console.log(`Imported ${imported}. Demo total: ${after[0].n}`);
