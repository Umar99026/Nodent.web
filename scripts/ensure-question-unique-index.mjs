/**
 * Apply DB unique index so duplicate stems cannot be re-inserted.
 * Safe to re-run (IF NOT EXISTS).
 *
 * Usage: node scripts/ensure-question-unique-index.mjs
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

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
const sqlPath = resolve(process.cwd(), "neon-custom-questions-unique-stem.sql");
const ddl = readFileSync(sqlPath, "utf8").trim();

await sql.unsafe(ddl);
console.log("Unique index custom_questions_subject_stem_unique is in place.");
