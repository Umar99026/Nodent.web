import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const id = Number(process.argv[2]);
if (!id) {
  console.error("Usage: node scripts/delete-question-by-id.mjs <id>");
  process.exit(1);
}

const raw = readFileSync(resolve(".dev.vars"), "utf8");
const m = raw.match(/^DATABASE_URL=(.+)$/m);
const sql = neon(m[1].trim().replace(/^["']|["']$/g, ""));
const r = await sql`DELETE FROM custom_questions WHERE id=${id} RETURNING id, subject_id`;
console.log(r.length ? `Deleted id ${r[0].id} (${r[0].subject_id})` : "Not found");
