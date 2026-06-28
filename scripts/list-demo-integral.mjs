import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  const raw = readFileSync(resolve(".dev.vars"), "utf8");
  const m = raw.match(/^DATABASE_URL=(.+)$/m);
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const sql = neon(loadDatabaseUrl());
const rows = await sql`
  SELECT id, LEFT(question, 80) AS q
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id))='demo' AND topic='Integral calculus'
  ORDER BY id
`;
console.log(rows);
