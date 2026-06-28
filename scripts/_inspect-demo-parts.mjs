import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const raw = readFileSync(".dev.vars", "utf8");
const url = raw.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const sql = neon(url);

const ids = process.argv.slice(2).map(Number).filter(Boolean);
const filter = ids.length
  ? sql`SELECT id, question, passage, answer_parts_json, accepted_answers FROM custom_questions WHERE id = ANY(${ids})`
  : sql`
  SELECT id, LEFT(question, 100) AS q, answer_parts_json
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = 'demo'
    AND answer_parts_json IS NOT NULL
  ORDER BY id
  LIMIT 15
`;

const rows = await filter;

for (const r of rows) {
  let parts = [];
  try {
    parts = JSON.parse(r.answer_parts_json);
  } catch {
    parts = [];
  }
  if (ids.length) {
    console.log("=== id", r.id, "===");
    console.log("question:", r.question);
    console.log("accepted:", r.accepted_answers);
    console.log(JSON.stringify(parts, null, 2));
    continue;
  }
  if (!Array.isArray(parts) || parts.length < 2) continue;
  console.log("--- id", r.id, r.q?.replace(/\s+/g, " "));
  console.log(
    JSON.stringify(
      parts.map((p) => ({ key: p.key, label: String(p.label ?? "").slice(0, 70) })),
      null,
      2,
    ),
  );
}
