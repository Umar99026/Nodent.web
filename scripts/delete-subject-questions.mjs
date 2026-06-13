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

const subjectId = String(process.argv[2] || "demo").trim().toLowerCase();
const databaseUrl = loadDatabaseUrl();
if (!databaseUrl) {
  console.error("Missing DATABASE_URL (.dev.vars or env).");
  process.exit(1);
}

const sql = neon(databaseUrl);
const rows = await sql`
  DELETE FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = ${subjectId}
  RETURNING id
`;
console.log(`Deleted ${rows.length} question(s) from subject "${subjectId}".`);
