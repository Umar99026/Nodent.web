import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const raw = readFileSync(resolve(".dev.vars"), "utf8");
const sql = neon(raw.match(/^DATABASE_URL=(.+)$/m)[1].trim().replace(/^["']|["']$/g, ""));

const rows = await sql`
  SELECT id, question, answer_parts_json
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id))='demo'
  ORDER BY id
`;
for (const r of rows) {
  console.log(`\n=== ${r.id} ===`);
  console.log(r.question);
  const parts = JSON.parse(r.answer_parts_json);
  for (const p of parts) console.log(`  ${p.label}`);
}
