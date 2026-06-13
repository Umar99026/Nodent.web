import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const raw = readFileSync(resolve(".dev.vars"), "utf8");
const m = raw.match(/^DATABASE_URL=(.+)$/m);
const sql = neon(m[1].trim());

const rows = await sql`
  SELECT id, question, options, guidance, created_at
  FROM custom_questions
  WHERE subject_id = 'methods'
    AND (question LIKE '%log_e%' OR question LIKE '%log% x}{x}%' OR question LIKE '%f''(x)% is%')
    AND created_at < '2021-01-01'
  ORDER BY id DESC
  LIMIT 5
`;
for (const r of rows) {
  console.log('--- id', r.id);
  console.log('Q:', r.question);
  console.log('OPTS:', r.options);
}
