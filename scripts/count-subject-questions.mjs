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
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const sql = neon(databaseUrl);
const rows = await sql`
  SELECT LOWER(TRIM(subject_id)) AS subject_id, COUNT(*)::int AS n
  FROM custom_questions
  GROUP BY LOWER(TRIM(subject_id))
  ORDER BY n DESC
`;
console.log("Counts by subject:");
for (const r of rows) console.log(`  ${r.subject_id}: ${r.n}`);

const demo = await sql`
  SELECT COUNT(*)::int AS n FROM custom_questions WHERE LOWER(TRIM(subject_id)) = 'demo'
`;
console.log(`\nDemo total: ${demo[0]?.n ?? 0}`);
