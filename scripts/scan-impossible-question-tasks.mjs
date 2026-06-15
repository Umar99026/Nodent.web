import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const raw = readFileSync(resolve(".dev.vars"), "utf8");
const m = raw.match(/^DATABASE_URL=(.+)$/m);
const sql = neon(m[1].trim());

const rows = await sql`
  SELECT id, subject_id, type, question, guidance, answer_parts_json, accepted_answers
  FROM custom_questions
  WHERE lower(coalesce(answer_parts_json, '')) ~ '(construct|create|draw|sketch|plot|complete|fill in).{0,30}(table|graph|diagram|number line)'
     OR lower(question) ~ '(construct|create|draw|sketch|plot|complete|fill in).{0,30}(table|graph|diagram|number line)'
     OR lower(question) LIKE '%probability distribution table%'
     OR lower(coalesce(answer_parts_json, '')) LIKE '%probability distribution table%'
  ORDER BY id
`;

console.log("Found", rows.length);
for (const r of rows) {
  console.log("---", r.id, r.subject_id, r.type);
  console.log("Q:", r.question?.slice(0, 250));
  if (r.guidance) console.log("G:", r.guidance?.slice(0, 120));
  if (r.answer_parts_json) console.log("P:", r.answer_parts_json?.slice(0, 400));
}
