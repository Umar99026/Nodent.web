import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const ids = process.argv.slice(2).map(Number).filter(Boolean);
const raw = readFileSync(resolve(".dev.vars"), "utf8");
const m = raw.match(/^DATABASE_URL=(.+)$/m);
const sql = neon(m[1].trim());

const rows = await sql`
  SELECT id, question, options, guidance
  FROM custom_questions
  WHERE id = ANY(${ids})
  ORDER BY id
`;
for (const r of rows) {
  console.log("--- id", r.id);
  console.log("Q:", r.question);
  console.log("OPTS:", r.options);
  if (r.guidance) console.log("G:", r.guidance);
}
