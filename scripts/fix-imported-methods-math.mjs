/**
 * Repair math formatting for question banks.
 * Usage: node scripts/fix-imported-methods-math.mjs [subjectId] [--all]
 *   subjectId defaults to "methods"
 *   --all fixes every row for the subject (not just 2020 import batch)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";
import { mathifyQuestionText } from "./lib/mathify-question-text.mjs";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const raw = readFileSync(resolve(".dev.vars"), "utf8");
  const m = raw.match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error("DATABASE_URL not found in .dev.vars");
  return m[1].trim();
}

function repairField(text) {
  if (text == null) return null;
  const raw = String(text).trim();
  if (!raw) return raw;
  return mathifyQuestionText(raw);
}

function repairOptions(optionsJson) {
  if (!optionsJson) return null;
  let options;
  try {
    options = JSON.parse(optionsJson);
  } catch {
    return null;
  }
  if (!Array.isArray(options) || !options.length) return null;
  return options.map((opt) => repairField(opt));
}

function repairAccepted(acceptedJson) {
  if (!acceptedJson) return null;
  let items;
  try {
    items = JSON.parse(acceptedJson);
  } catch {
    return null;
  }
  if (!Array.isArray(items) || !items.length) return null;
  return items.map((item) => repairField(item));
}

const args = process.argv.slice(2);
const allRows = args.includes("--all");
const subjectId = args.find((a) => a !== "--all") || "methods";
const sql = neon(loadDatabaseUrl());

const rows = allRows
  ? await sql`
      SELECT id, question, options, guidance, accepted_answers
      FROM custom_questions
      WHERE subject_id = ${subjectId}
      ORDER BY id
    `
  : await sql`
      SELECT id, question, options, guidance, accepted_answers
      FROM custom_questions
      WHERE subject_id = ${subjectId}
        AND created_at >= '2020-01-01'
        AND created_at < '2021-01-01'
      ORDER BY id
    `;

console.log(
  `Found ${rows.length} ${subjectId} question(s) to check${allRows ? " (all rows)" : " (2020 import batch)"}.`,
);

let updated = 0;
for (const row of rows) {
  const question = repairField(row.question);
  const guidance = row.guidance ? repairField(row.guidance) : null;
  const options = repairOptions(row.options);
  const acceptedAnswers = repairAccepted(row.accepted_answers);

  const changed =
    question !== row.question ||
    (guidance != null && guidance !== row.guidance) ||
    (options != null &&
      JSON.stringify(options) !== JSON.stringify(JSON.parse(row.options || "[]"))) ||
    (acceptedAnswers != null &&
      JSON.stringify(acceptedAnswers) !==
        JSON.stringify(JSON.parse(row.accepted_answers || "[]")));

  if (!changed) continue;

  await sql`
    UPDATE custom_questions
    SET
      question = ${question},
      guidance = ${guidance ?? row.guidance},
      options = ${options ? JSON.stringify(options) : row.options},
      accepted_answers = ${acceptedAnswers ? JSON.stringify(acceptedAnswers) : row.accepted_answers}
    WHERE id = ${row.id}
  `;
  updated++;
  if (updated <= 5 || updated % 10 === 0) {
    console.log(`  updated ${row.id}: ${question.slice(0, 72)}…`);
  }
}

console.log(`Done. Updated ${updated} question(s).`);
