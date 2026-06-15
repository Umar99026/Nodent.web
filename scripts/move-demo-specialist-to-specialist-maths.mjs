/**
 * Move specialist demo batch from subject "demo" → "specialist-maths".
 * Matches rows by question stem against imports/specialist-demo-50-hard-vce-style.json.
 * Skips rows whose stem already exists in specialist-maths (dedupe).
 *
 * Usage:
 *   node scripts/move-demo-specialist-to-specialist-maths.mjs           # dry run
 *   node scripts/move-demo-specialist-to-specialist-maths.mjs --apply   # update DB
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const APPLY = process.argv.includes("--apply");
const TARGET = "specialist-maths";
const SOURCE = "demo";
const IMPORT_PATH = resolve(process.cwd(), "imports", "specialist-demo-50-hard-vce-style.json");

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  const devVars = resolve(process.cwd(), ".dev.vars");
  if (!existsSync(devVars)) return "";
  const raw = readFileSync(devVars, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^DATABASE_URL=(.+)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

function stemKey(question) {
  return String(question ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 280);
}

const databaseUrl = loadDatabaseUrl();
if (!databaseUrl) {
  console.error("Missing DATABASE_URL (.dev.vars or env).");
  process.exit(1);
}

if (!existsSync(IMPORT_PATH)) {
  console.error(`Missing ${IMPORT_PATH}`);
  process.exit(1);
}

const payload = JSON.parse(readFileSync(IMPORT_PATH, "utf8"));
const importQuestions = (Array.isArray(payload) ? payload : payload.questions) ?? [];
const importStems = new Set(importQuestions.map((q) => stemKey(q.question)));

const sql = neon(databaseUrl);

const smRows = await sql`
  SELECT id, question FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = ${TARGET}
`;
const smStems = new Set(smRows.map((r) => stemKey(r.question)));

const demoRows = await sql`
  SELECT id, type, topic, question, marks
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = ${SOURCE}
  ORDER BY id
`;

const specialistDemoRows = demoRows.filter((r) => importStems.has(stemKey(r.question)));

console.log(`${TARGET}: ${smRows.length} questions`);
console.log(`${SOURCE}: ${demoRows.length} questions (${specialistDemoRows.length} specialist batch)`);

const toMove = [];
const duplicates = [];

for (const r of specialistDemoRows) {
  const key = stemKey(r.question);
  if (smStems.has(key)) {
    duplicates.push(r);
  } else {
    toMove.push(r);
    smStems.add(key);
  }
}

console.log(`\nWill move: ${toMove.length}`);
console.log(`Duplicates (will delete from demo): ${duplicates.length}`);

if (toMove.length) {
  console.log("\nMoving:");
  for (const r of toMove) {
    console.log(`  [${r.id}] ${r.topic} | ${String(r.question).replace(/\s+/g, " ").slice(0, 80)}`);
  }
}

if (!APPLY) {
  console.log("\nDry run. Re-run with --apply to update the database.");
  process.exit(0);
}

let moved = 0;
for (const r of toMove) {
  await sql`
    UPDATE custom_questions
    SET subject_id = ${TARGET}
    WHERE id = ${r.id}
  `;
  moved++;
}

let deleted = 0;
if (duplicates.length) {
  const dupIds = duplicates.map((r) => r.id);
  const del = await sql`
    DELETE FROM custom_questions
    WHERE id = ANY(${dupIds}::int[])
    RETURNING id
  `;
  deleted = del.length;
}

const smAfter = await sql`
  SELECT COUNT(*)::int AS n FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = ${TARGET}
`;
const demoAfter = await sql`
  SELECT COUNT(*)::int AS n FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = ${SOURCE}
`;

console.log(`\nMoved: ${moved}`);
console.log(`Deleted duplicates: ${deleted}`);
console.log(`${TARGET} now: ${smAfter[0]?.n ?? 0}`);
console.log(`${SOURCE} now: ${demoAfter[0]?.n ?? 0}`);
