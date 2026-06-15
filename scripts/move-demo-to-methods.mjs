/** Move all demo questions → methods. */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

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

const apply = process.argv.includes("--apply");
const sql = neon(loadDatabaseUrl());

const rows = await sql`
  SELECT id, LEFT(question, 80) AS q
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = 'demo'
  ORDER BY id
`;

console.log(`Found ${rows.length} demo question(s):`);
for (const r of rows) console.log(`  ${r.id} | ${r.q}`);

if (!rows.length) {
  console.log("Nothing to move.");
  process.exit(0);
}

if (!apply) {
  console.log("\nDry run — pass --apply to move to methods");
  process.exit(0);
}

const updated = await sql`
  UPDATE custom_questions
  SET subject_id = 'methods'
  WHERE LOWER(TRIM(subject_id)) = 'demo'
  RETURNING id
`;
console.log(`\nMoved ${updated.length} question(s) to methods:`, updated.map((r) => r.id).join(", "));
