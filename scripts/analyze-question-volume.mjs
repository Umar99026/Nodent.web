import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  const devVars = resolve(process.cwd(), ".dev.vars");
  if (!existsSync(devVars)) return "";
  const raw = readFileSync(devVars, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^DATABASE_URL=(.+)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

const sql = neon(loadDatabaseUrl());

const byDay = await sql`
  SELECT LOWER(TRIM(subject_id)) AS subject,
         DATE(created_at) AS day,
         COUNT(*)::int AS n
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) IN ('methods', 'specialist-maths', 'general-maths')
  GROUP BY 1, 2
  ORDER BY 1, 2 DESC
`;
console.log("=== Imports by day ===");
for (const r of byDay) console.log(`  ${r.subject} ${r.day}: ${r.n}`);

const nearDupes = await sql`
  SELECT subject_id, COUNT(*)::int AS total,
         COUNT(DISTINCT LOWER(REGEXP_REPLACE(TRIM(question), '\\s+', ' ', 'g')))::int AS unique_stems
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) IN ('methods', 'specialist-maths')
  GROUP BY subject_id
`;
console.log("\n=== Stem duplicates (exact text) ===");
for (const r of nearDupes) {
  console.log(`  ${r.subject_id}: ${r.total} rows, ${r.unique_stems} unique stems, ${r.total - r.unique_stems} exact dupes`);
}

const sampleDupes = await sql`
  WITH g AS (
    SELECT subject_id,
           LOWER(REGEXP_REPLACE(TRIM(question), '\\s+', ' ', 'g')) AS stem,
           COUNT(*)::int AS c,
           MIN(id) AS keep_id,
           ARRAY_AGG(id ORDER BY id) AS ids
    FROM custom_questions
    WHERE LOWER(TRIM(subject_id)) = 'methods'
    GROUP BY 1, 2
    HAVING COUNT(*) > 1
    ORDER BY c DESC
    LIMIT 8
  )
  SELECT * FROM g
`;
console.log("\n=== Top duplicate stems (methods) ===");
for (const r of sampleDupes) {
  console.log(`  x${r.c} ids=${r.ids.slice(0,5).join(',')}${r.ids.length>5?'...':''} | stem len ${r.stem.length}`);
}

const seeFigure = await sql`
  SELECT subject_id, COUNT(*)::int AS n
  FROM custom_questions
  WHERE LOWER(TRIM(question)) IN ('see figure.', 'see figure')
  GROUP BY subject_id
`;
console.log("\n=== 'See figure.' rows ===");
for (const r of seeFigure) console.log(`  ${r.subject_id}: ${r.n}`);
