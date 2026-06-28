import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const sql = neon(
  readFileSync(".dev.vars", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim(),
);

const rows = await sql`
  SELECT id, LENGTH(COALESCE(image_urls, '')) AS len, LEFT(image_urls, 80) AS preview
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = 'demo'
  ORDER BY id
`;
for (const r of rows) {
  console.log(r.id, "len=", r.len, r.preview ?? "");
}
