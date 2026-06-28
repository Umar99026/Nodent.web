import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const raw = readFileSync(resolve(".dev.vars"), "utf8");
const sql = neon(raw.match(/^DATABASE_URL=(.+)$/m)[1].trim());

const demo = await sql`SELECT COUNT(*)::int n FROM custom_questions WHERE LOWER(TRIM(subject_id))='demo'`;
const moved = await sql`
  SELECT topic, COUNT(*)::int n FROM custom_questions
  WHERE id >= 7849 AND id <= 7879
  GROUP BY topic ORDER BY topic
`;
const methods = await sql`SELECT COUNT(*)::int n FROM custom_questions WHERE LOWER(TRIM(subject_id))='methods'`;

console.log("Demo:", demo[0].n);
console.log("Methods:", methods[0].n);
console.log("\nMoved batch topics:");
for (const r of moved) console.log(`  ${r.topic}: ${r.n}`);
