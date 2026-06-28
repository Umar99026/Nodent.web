import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const url = readFileSync(".dev.vars", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim();
const sql = neon(url);
const id = Number(process.argv[2] ?? 7936);
const rows = await sql`
  SELECT id, question, passage, answer_parts_json, accepted_answers
  FROM custom_questions WHERE id = ${id}
`;
console.log(JSON.stringify(rows[0], null, 2));
