import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";

const raw = readFileSync(".dev.vars", "utf8");
const sql = neon(raw.match(/^DATABASE_URL=(.+)$/m)[1].trim());

const unique = await sql`
  SELECT subject_id,
         COUNT(*)::int AS total,
         COUNT(DISTINCT LOWER(TRIM(question)))::int AS unique_stems
  FROM custom_questions
  WHERE subject_id IN ('methods', 'specialist-maths', 'general-maths')
  GROUP BY subject_id
`;

const jun12methods = await sql`
  SELECT COUNT(*)::int AS n,
         COUNT(DISTINCT LOWER(TRIM(question)))::int AS unique_stems
  FROM custom_questions
  WHERE subject_id = 'methods'
    AND created_at >= '2026-06-12' AND created_at < '2026-06-13'
`;

console.log("=== Total vs unique stems ===");
console.log(JSON.stringify(unique, null, 2));
console.log("\n=== Jun 12 methods only ===");
console.log(JSON.stringify(jun12methods, null, 2));
