import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const sql = neon(readFileSync(".dev.vars", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim());

const rows = await sql`
  SELECT id, LEFT(question, 60) AS q, answer_parts_json
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = 'demo'
    AND answer_parts_json IS NOT NULL
`;

for (const r of rows) {
  let parts = [];
  try {
    parts = JSON.parse(r.answer_parts_json);
  } catch {
    continue;
  }
  if (!Array.isArray(parts) || parts.length < 2) continue;
  const allA = parts.every((p) => /^a\)\s/i.test(String(p.label ?? "")));
  const labels = parts.map((p) => String(p.label ?? "").slice(0, 40));
  if (allA) {
    console.log(r.id, labels);
  }
}
