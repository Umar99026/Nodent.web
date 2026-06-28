/**
 * Delete all questions in the demo subject.
 *   node scripts/clear-demo-questions.mjs --apply
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const APPLY = process.argv.includes("--apply");

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  const devVars = resolve(".dev.vars");
  if (!existsSync(devVars)) throw new Error("DATABASE_URL not set and .dev.vars missing");
  const raw = readFileSync(devVars, "utf8");
  const m = raw.match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error("DATABASE_URL not found in .dev.vars");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const sql = neon(loadDatabaseUrl());
const before = await sql`
  SELECT COUNT(*)::int AS n FROM custom_questions WHERE LOWER(TRIM(subject_id))='demo'
`;
console.log(`Demo questions: ${before[0].n}`);

if (!APPLY) {
  console.log("Dry run — pass --apply to delete all demo questions.");
  process.exit(0);
}

const deleted = await sql`
  DELETE FROM custom_questions WHERE LOWER(TRIM(subject_id))='demo' RETURNING id
`;
console.log(`Deleted ${deleted.length} demo question(s).`);
