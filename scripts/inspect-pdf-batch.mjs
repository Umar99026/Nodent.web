import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const raw = readFileSync(resolve(".dev.vars"), "utf8");
const m = raw.match(/^DATABASE_URL=(.+)$/m);
const sql = neon(m[1].trim());

const rows = await sql`
  SELECT id, type, topic, marks, question, answer_parts_json, ai_marking_enabled
  FROM custom_questions
  WHERE id BETWEEN 6565 AND 6571
  ORDER BY id
`;
for (const r of rows) {
  console.log(r.id, r.type, r.topic, "marks=" + r.marks, "ai=" + r.ai_marking_enabled, "multipart=" + !!r.answer_parts_json);
  console.log("  Q:", String(r.question).slice(0, 100));
}
