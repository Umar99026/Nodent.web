/**
 * Move all custom_questions from subject "demo" → "general-maths".
 * Skips rows whose question stem already exists in general-maths (dedupe).
 *
 * Usage:
 *   node scripts/move-demo-to-general-maths.mjs           # dry run
 *   node scripts/move-demo-to-general-maths.mjs --apply   # update DB
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const APPLY = process.argv.includes("--apply");

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

const sql = neon(databaseUrl);

const gmRows = await sql`
  SELECT id, question FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = 'general-maths'
`;
const gmStems = new Set(gmRows.map((r) => stemKey(r.question)));

const demoRows = await sql`
  SELECT id, type, topic, question, marks
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = 'demo'
  ORDER BY id
`;

console.log(`General maths: ${gmRows.length} questions`);
console.log(`Demo: ${demoRows.length} questions`);

const toMove = [];
const duplicates = [];

for (const r of demoRows) {
  const key = stemKey(r.question);
  if (gmStems.has(key)) {
    duplicates.push(r);
  } else {
    toMove.push(r);
    gmStems.add(key);
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

if (duplicates.length) {
  console.log("\nDuplicates (delete only):");
  for (const r of duplicates) {
    console.log(`  [${r.id}] | ${String(r.question).replace(/\s+/g, " ").slice(0, 80)}`);
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
    SET subject_id = 'general-maths'
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

const gmAfter = await sql`
  SELECT COUNT(*)::int AS n FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = 'general-maths'
`;
const demoAfter = await sql`
  SELECT COUNT(*)::int AS n FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = 'demo'
`;

console.log(`\nMoved: ${moved}`);
console.log(`Deleted duplicates: ${deleted}`);
console.log(`General maths now: ${gmAfter[0]?.n ?? 0}`);
console.log(`Demo now: ${demoAfter[0]?.n ?? 0}`);
