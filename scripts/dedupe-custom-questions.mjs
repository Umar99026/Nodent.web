/**
 * Remove duplicate custom_questions (same subject + normalized question stem).
 * Keeps the best row per group (has accepted answers / options, then oldest id).
 *
 * Usage:
 *   node scripts/dedupe-custom-questions.mjs           # dry run
 *   node scripts/dedupe-custom-questions.mjs --apply   # delete duplicates
 */
import { neon } from "@neondatabase/serverless";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

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

const apply = process.argv.includes("--apply");
const databaseUrl = loadDatabaseUrl();
if (!databaseUrl) {
  console.error("Missing DATABASE_URL (.dev.vars or env).");
  process.exit(1);
}

const sql = neon(databaseUrl);

const before = await sql`
  SELECT subject_id,
         COUNT(*)::int AS total,
         COUNT(DISTINCT LOWER(REGEXP_REPLACE(TRIM(question), '\\s+', ' ', 'g')))::int AS unique_stems
  FROM custom_questions
  GROUP BY subject_id
  ORDER BY total DESC
`;

const dupes = await sql`
  WITH stem AS (
    SELECT id,
           subject_id,
           LOWER(REGEXP_REPLACE(TRIM(question), '\\s+', ' ', 'g')) AS stem_key,
           ROW_NUMBER() OVER (
             PARTITION BY subject_id,
                          LOWER(REGEXP_REPLACE(TRIM(question), '\\s+', ' ', 'g'))
             ORDER BY
               CASE
                 WHEN accepted_answers IS NOT NULL AND TRIM(accepted_answers) NOT IN ('', '[]', 'null') THEN 0
                 WHEN options IS NOT NULL AND TRIM(options) NOT IN ('', '[]', 'null') THEN 0
                 WHEN answer IS NOT NULL AND TRIM(answer) <> '' THEN 1
                 ELSE 2
               END,
               id ASC
           ) AS rn
    FROM custom_questions
  )
  SELECT subject_id, COUNT(*)::int AS to_delete
  FROM stem
  WHERE rn > 1
  GROUP BY subject_id
  ORDER BY to_delete DESC
`;

const totalToDelete = dupes.reduce((s, r) => s + r.to_delete, 0);

console.log("=== Before ===");
for (const r of before) {
  const dup = r.total - r.unique_stems;
  console.log(`  ${r.subject_id}: ${r.total} rows (${r.unique_stems} unique${dup > 0 ? `, ${dup} duplicates` : ""})`);
}

console.log(`\n=== Duplicates to remove: ${totalToDelete} ===`);
for (const r of dupes) {
  console.log(`  ${r.subject_id}: ${r.to_delete}`);
}

if (!apply) {
  console.log("\nDry run only. Re-run with --apply to delete.");
  process.exit(0);
}

if (totalToDelete === 0) {
  console.log("\nNothing to delete.");
  process.exit(0);
}

const deleted = await sql`
  WITH stem AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY subject_id,
                          LOWER(REGEXP_REPLACE(TRIM(question), '\\s+', ' ', 'g'))
             ORDER BY
               CASE
                 WHEN accepted_answers IS NOT NULL AND TRIM(accepted_answers) NOT IN ('', '[]', 'null') THEN 0
                 WHEN options IS NOT NULL AND TRIM(options) NOT IN ('', '[]', 'null') THEN 0
                 WHEN answer IS NOT NULL AND TRIM(answer) <> '' THEN 1
                 ELSE 2
               END,
               id ASC
           ) AS rn
    FROM custom_questions
  )
  DELETE FROM custom_questions
  WHERE id IN (SELECT id FROM stem WHERE rn > 1)
  RETURNING id
`;

console.log(`\nDeleted ${deleted.length} duplicate row(s).`);

const after = await sql`
  SELECT subject_id, COUNT(*)::int AS total
  FROM custom_questions
  GROUP BY subject_id
  ORDER BY total DESC
`;

console.log("\n=== After ===");
for (const r of after) {
  console.log(`  ${r.subject_id}: ${r.total} rows`);
}
