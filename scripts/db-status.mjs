import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const raw = readFileSync(resolve(".dev.vars"), "utf8");
const sql = neon(raw.match(/^DATABASE_URL=(.+)$/m)[1].trim().replace(/^["']|["']$/g, ""));

const counts = await sql`
  SELECT LOWER(TRIM(subject_id)) AS s, COUNT(*)::int AS n
  FROM custom_questions
  GROUP BY 1
  ORDER BY 1
`;
console.log("counts:", counts);

const dot = await sql`
  SELECT id, LEFT(question, 90) AS q
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = 'specialist-maths'
    AND (question ILIKE '%Find a·b%' OR question ILIKE '%Find a\\cdot%')
  ORDER BY id
`;
console.log(`\ndot-product drills: ${dot.length}`);
for (const r of dot.slice(0, 15)) console.log(`  [${r.id}] ${r.q}`);
