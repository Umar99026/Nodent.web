import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const APPLY = process.argv.includes("--apply");
const raw = readFileSync(resolve(".dev.vars"), "utf8");
const sql = neon(raw.match(/^DATABASE_URL=(.+)$/m)[1].trim().replace(/^["']|["']$/g, ""));

const payload = JSON.parse(readFileSync(resolve("imports/demo-specialist-hard-multipart-30.json"), "utf8"));
const importStems = new Set(payload.questions.map((q) => q.question.trim().toLowerCase()));

const rows = await sql`
  SELECT id, topic, question
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = 'specialist-maths'
    AND id >= 7880
  ORDER BY id
`;

const matched = [];
const unmatched = [];

for (const r of rows) {
  const stem = r.question.trim().toLowerCase();
  if (importStems.has(stem)) matched.push(r);
  else unmatched.push(r);
}

console.log(`Import stems: ${importStems.size}`);
console.log(`Batch rows: ${rows.length}`);
console.log(`Matched import: ${matched.length}`);
console.log(`Unmatched (stale duplicates): ${unmatched.length}\n`);

for (const r of unmatched) {
  console.log(`  delete candidate [${r.id}] ${r.topic} | ${r.question.slice(0, 80)}`);
}

if (!APPLY || !unmatched.length) {
  if (!APPLY && unmatched.length) console.log("\nDry run — pass --apply to delete stale rows.");
  process.exit(0);
}

const ids = unmatched.map((r) => r.id);
const del = await sql`DELETE FROM custom_questions WHERE id = ANY(${ids}::int[]) RETURNING id`;
console.log(`\nDeleted ${del.length}`);

const count = await sql`
  SELECT COUNT(*)::int AS n FROM custom_questions WHERE LOWER(TRIM(subject_id))='specialist-maths'
`;
console.log(`specialist-maths total: ${count[0].n}`);
