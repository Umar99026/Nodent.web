import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const sql = neon(readFileSync(".dev.vars", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim());

const rows = await sql`
  SELECT id, question, answer_parts_json
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = 'demo'
    AND answer_parts_json IS NOT NULL
`;

let bad = 0;
for (const r of rows) {
  let parts = [];
  try {
    parts = JSON.parse(r.answer_parts_json);
  } catch {
    continue;
  }
  if (!Array.isArray(parts) || parts.length < 2) continue;

  const keys = parts.map((p) => String(p.key ?? "").toLowerCase());
  const dupRoman = keys.filter((k) => /^i{1,3}|iv$/.test(k)).length > 2;
  const wrongLabels = parts.some((p) => {
    const k = String(p.key ?? "").toLowerCase();
    const l = String(p.label ?? "");
    return /^i{1,3}|iv$/.test(k) && /^a\)\s/i.test(l);
  });
  const tooMany = parts.length > 4;
  const dupKeys = new Set(keys).size < keys.length;

  if (dupRoman || wrongLabels || tooMany || dupKeys) {
    bad++;
    console.log(
      r.id,
      parts.length,
      "parts",
      r.question?.slice(0, 50).replace(/\s+/g, " ") || "(empty)",
    );
  }
}
console.log("bad multipart demo rows:", bad);
