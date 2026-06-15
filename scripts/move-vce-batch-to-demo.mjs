/** Move the generated VCE-style batch (ids 7089–7138) from methods → demo. */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const APPLY = process.argv.includes("--apply");
const IDS = Array.from({ length: 50 }, (_, i) => 7089 + i);

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  const devVars = resolve(process.cwd(), ".dev.vars");
  const raw = readFileSync(devVars, "utf8");
  const m = raw.match(/^DATABASE_URL=(.+)$/m);
  return m[1].trim();
}

const sql = neon(loadDatabaseUrl());
const rows = await sql`
  SELECT id, subject_id, type, topic, LEFT(question, 70) AS q
  FROM custom_questions
  WHERE id = ANY(${IDS}::int[])
  ORDER BY id
`;

console.log(`Found ${rows.length}/50 batch questions in DB:`);
for (const r of rows) {
  console.log(`  [${r.id}] ${r.subject_id} | ${r.type} | ${r.topic} | ${r.q}`);
}

if (!rows.length) {
  console.log("Nothing to move.");
  process.exit(0);
}

if (!APPLY) {
  console.log("\nDry run — pass --apply to move to demo.");
  process.exit(0);
}

const updated = await sql`
  UPDATE custom_questions
  SET subject_id = 'demo'
  WHERE id = ANY(${IDS}::int[])
  RETURNING id
`;
console.log(`\nMoved ${updated.length} question(s) to demo.`);
