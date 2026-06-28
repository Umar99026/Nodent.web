import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  const raw = readFileSync(resolve(".dev.vars"), "utf8");
  const m = raw.match(/^DATABASE_URL=(.+)$/m);
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const sql = neon(loadDatabaseUrl());
const count = await sql`SELECT COUNT(*)::int AS n FROM custom_questions WHERE LOWER(TRIM(subject_id))='demo'`;
const topics = await sql`
  SELECT topic, COUNT(*)::int AS n FROM custom_questions
  WHERE LOWER(TRIM(subject_id))='demo' GROUP BY topic ORDER BY topic
`;
console.log("Demo total:", count[0].n);
for (const t of topics) console.log(`  ${t.topic}: ${t.n}`);
