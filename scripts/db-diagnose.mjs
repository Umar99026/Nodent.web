/** Quick Neon diagnostics — reads DATABASE_URL from .dev.vars */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { neon } from "@neondatabase/serverless";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const devVars = fs.readFileSync(path.join(root, ".dev.vars"), "utf8");
const url = devVars.match(/^DATABASE_URL=(.+)$/m)?.[1]?.trim();
if (!url) {
  console.error("DATABASE_URL missing in .dev.vars");
  process.exit(1);
}

const sql = neon(url);

async function main() {
  const out = {};

  try {
    const users = await sql`SELECT COUNT(*)::int AS n FROM users`;
    out.users = users[0].n;
  } catch (e) {
    out.users = `ERR: ${e.message}`;
  }

  try {
    const cq = await sql`SELECT COUNT(*)::int AS n FROM custom_questions`;
    out.custom_questions = cq[0].n;
  } catch (e) {
    out.custom_questions = `ERR: ${e.message}`;
  }

  try {
    const idx = await sql`
      SELECT indexname, indexdef FROM pg_indexes
      WHERE tablename = 'custom_questions'
      ORDER BY indexname
    `;
    out.custom_questions_indexes = idx.map((r) => r.indexname);
    out.has_stem_unique = idx.some((r) => r.indexname === "custom_questions_subject_stem_unique");
  } catch (e) {
    out.custom_questions_indexes = `ERR: ${e.message}`;
  }

  try {
    const dups = await sql`
      SELECT LOWER(TRIM(subject_id)) AS sid,
             LEFT(LOWER(REGEXP_REPLACE(TRIM(question), '\\s+', ' ', 'g')), 80) AS stem,
             COUNT(*)::int AS c
      FROM custom_questions
      GROUP BY 1, 2
      HAVING COUNT(*) > 1
      ORDER BY c DESC
      LIMIT 10
    `;
    out.duplicate_stem_groups = dups.length;
    out.duplicate_stem_samples = dups;
  } catch (e) {
    out.duplicate_stem_groups = `ERR: ${e.message}`;
  }

  try {
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    out.tables = tables.map((r) => r.table_name);
  } catch (e) {
    out.tables = `ERR: ${e.message}`;
  }

  try {
    const cols = await sql`
      SELECT column_name, data_type FROM information_schema.columns
      WHERE table_name = 'custom_questions'
      ORDER BY ordinal_position
    `;
    out.custom_questions_columns = cols.map((c) => `${c.column_name}:${c.data_type}`);
  } catch (e) {
    out.custom_questions_columns = `ERR: ${e.message}`;
  }

  try {
    const sidType = await sql`
      SELECT data_type FROM information_schema.columns
      WHERE table_name = 'custom_questions' AND column_name = 'subject_id'
    `;
    out.subject_id_type = sidType[0]?.data_type ?? "missing";
  } catch (e) {
    out.subject_id_type = `ERR: ${e.message}`;
  }

  try {
    const feedback = await sql`SELECT COUNT(*)::int AS n FROM user_feedback`;
    out.user_feedback = feedback[0].n;
  } catch (e) {
    out.user_feedback = `ERR: ${e.message}`;
  }

  console.log(JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
