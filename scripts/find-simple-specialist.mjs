import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const raw = readFileSync(resolve(".dev.vars"), "utf8");
const sql = neon(raw.match(/^DATABASE_URL=(.+)$/m)[1].trim().replace(/^["']|["']$/g, ""));

const rows = await sql`
  SELECT id, LEFT(question, 100) AS q
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id))='specialist-maths'
    AND (
      LOWER(question) LIKE '%find a·b%'
      OR LOWER(question) LIKE '%find a\\cdot b%'
      OR LOWER(question) LIKE '%mathbf{a}%cdot%'
    )
  ORDER BY id
  LIMIT 15
`;
console.log(`Found ${rows.length} dot-product style (sample):`);
for (const r of rows) console.log(`  [${r.id}] ${r.q}`);

const total = await sql`
  SELECT COUNT(*)::int n FROM custom_questions WHERE LOWER(TRIM(subject_id))='specialist-maths'
`;
console.log(`Specialist total: ${total[0].n}`);
