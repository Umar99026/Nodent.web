import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

function loadDatabaseUrl() {
  const raw = readFileSync(resolve(".dev.vars"), "utf8");
  const m = raw.match(/^DATABASE_URL=(.+)$/m);
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const sql = neon(loadDatabaseUrl());
const rows = await sql`
  SELECT id, topic, question
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id))='methods'
  ORDER BY id
`;

function stripMath(s) {
  return String(s ?? "")
    .replace(/\$[^$]*\$/g, " ")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[{}_^]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isTrivialRecall(row) {
  const q = stripMath(row.question).toLowerCase();
  const raw = String(row.question ?? "").toLowerCase();
  if (/\bconfidence uses\b/i.test(raw) && /z/i.test(raw)) return true;
  if (/z\s*\\approx|z\s*approx/i.test(raw)) return true;
  if (/\b(true or false|yes or no)\b/.test(q)) return true;
  if (/\bone word\b/.test(q)) return true;
  return false;
}

const trivial = rows.filter(isTrivialRecall);
console.log(`Trivial recall: ${trivial.length}`);
for (const r of trivial) console.log(`[${r.id}] ${r.question.slice(0, 90)}`);
