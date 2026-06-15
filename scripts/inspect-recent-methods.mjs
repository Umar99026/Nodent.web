import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const raw = readFileSync(resolve(".dev.vars"), "utf8");
const m = raw.match(/^DATABASE_URL=(.+)$/m);
const sql = neon(m[1].trim());

const rows = await sql`
  SELECT id, type, topic, marks, question, passage, guidance, options, answer, accepted_answers,
         answer_parts_json, image_urls, ai_marking_enabled, created_at
  FROM custom_questions
  WHERE id >= 6560 AND LOWER(TRIM(subject_id)) = 'methods'
  ORDER BY id
`;

console.log(JSON.stringify(rows, null, 2));
