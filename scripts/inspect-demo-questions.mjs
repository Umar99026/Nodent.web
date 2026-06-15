import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const raw = readFileSync(".dev.vars", "utf8");
const m = raw.match(/^DATABASE_URL=(.+)$/m);
const sql = neon(m[1].trim());

const rows = await sql`
  SELECT id, type, topic, marks, question, answer_parts_json, accepted_answers, image_urls
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = 'demo'
  ORDER BY id
`;

for (const r of rows) {
  console.log("\n==========", r.id, r.type, r.topic, "marks:", r.marks);
  console.log("QUESTION:\n", r.question);
  console.log("PARTS JSON:\n", r.answer_parts_json);
  console.log("ACCEPTED:\n", r.accepted_answers);
}
