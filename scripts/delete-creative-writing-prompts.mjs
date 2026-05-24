import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error("Missing DATABASE_URL in environment.");
  process.exit(1);
}

const sql = neon(databaseUrl);

const sectionB = `LEFT(UPPER(TRIM(REGEXP_REPLACE(COALESCE(section, ''), '^SECTION\\s*', '', 'i'))), 1) = 'B'`;
const creativeBook = `EXISTS (SELECT 1 FROM english_books b WHERE b.id = english_prompts.book_id AND b.title ILIKE '%creative writing%')`;

const where = `
  LEFT(UPPER(TRIM(REGEXP_REPLACE(COALESCE(section, ''), '^SECTION\\s*', '', 'i'))), 1) = 'B'
  AND (
    LOWER(TRIM(prompt_text)) = 'creative writing'
    OR prompt_text ~* 'title\\s*:\\s*creative\\s*writing'
  )
`;

const anyCreative = await sql.query(
  `SELECT COUNT(*)::int AS count
   FROM english_prompts
   WHERE ${sectionB} AND (prompt_text ILIKE '%creative writing%' OR ${creativeBook});`,
);
console.log(`Section B prompts containing phrase "creative writing": ${Number(anyCreative?.[0]?.count ?? 0)}`);

const examples = await sql.query(
  `SELECT id, LEFT(prompt_text, 140) AS snippet
   FROM english_prompts
   WHERE ${sectionB} AND (prompt_text ILIKE '%creative writing%' OR ${creativeBook})
   ORDER BY id ASC
   LIMIT 5;`,
);
if (examples.length) {
  console.log("Examples:");
  for (const r of examples) console.log(`- #${r.id}: ${String(r.snippet).replace(/\\s+/g, " ").trim()}`);
}

const [{ count }] = await sql.query(
  `SELECT COUNT(*)::int AS count FROM english_prompts WHERE ${sectionB} AND (${creativeBook} OR ${where.replace(/\s+/g, " ").trim()});`,
);
const before = Number(count ?? 0);
console.log(`Found ${before} Section B prompts to delete (Creative Writing).`);

if (before > 0) {
  await sql.query(
    `DELETE FROM english_prompts
     WHERE ${sectionB} AND (${creativeBook} OR ${where.replace(/\s+/g, " ").trim()});`,
  );
  await sql.query(
    `DELETE FROM english_books b
     WHERE b.title ILIKE '%creative writing%'
       AND NOT EXISTS (SELECT 1 FROM english_prompts p WHERE p.book_id = b.id);`,
  );
}

const [{ count: afterCount }] = await sql.query(
  `SELECT COUNT(*)::int AS count FROM english_prompts WHERE ${sectionB} AND (${creativeBook} OR ${where.replace(/\s+/g, " ").trim()});`,
);
const after = Number(afterCount ?? 0);
console.log(`Remaining after delete: ${after}`);

process.exit(after === 0 ? 0 : 2);

