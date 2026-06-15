/**
 * Move the N most recently created custom_questions from methods → demo.
 *
 * Usage:
 *   node scripts/move-recent-methods-to-demo.mjs           # dry run (default 8)
 *   node scripts/move-recent-methods-to-demo.mjs --apply
 *   node scripts/move-recent-methods-to-demo.mjs --apply --count=8
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const APPLY = process.argv.includes("--apply");
const countArg = process.argv.find((a) => a.startsWith("--count="));
const COUNT = countArg ? Math.max(1, Number(countArg.split("=")[1]) || 8) : 8;

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

const databaseUrl = loadDatabaseUrl();
if (!databaseUrl) {
  console.error("Missing DATABASE_URL (.dev.vars or env).");
  process.exit(1);
}

const sql = neon(databaseUrl);

const rows = await sql`
  SELECT id, type, topic, marks, created_at, question
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = 'methods'
  ORDER BY created_at DESC NULLS LAST, id DESC
  LIMIT ${COUNT}
`;

if (rows.length === 0) {
  console.log("No methods questions found.");
  process.exit(0);
}

console.log(`Found ${rows.length} most recent methods question(s) to move → demo:\n`);
for (const r of rows) {
  const preview = String(r.question ?? "")
    .replace(/\s+/g, " ")
    .slice(0, 90);
  console.log(`  [${r.id}] ${r.created_at} | ${r.type} | ${r.topic} | ${preview}`);
}

if (!APPLY) {
  console.log(`\nDry run — pass --apply to update subject_id to "demo".`);
  process.exit(0);
}

const ids = rows.map((r) => Number(r.id));
const updated = await sql`
  UPDATE custom_questions
  SET subject_id = 'demo'
  WHERE id = ANY(${ids}::int[])
  RETURNING id
`;

console.log(`\nMoved ${updated.length} question(s) to demo.`);
