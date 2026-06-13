import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const raw = readFileSync(resolve(".dev.vars"), "utf8");
const m = raw.match(/^DATABASE_URL=(.+)$/m);
const sql = neon(m[1].trim());

const rows = await sql`SELECT id, question, options FROM custom_questions WHERE id = 2664`;
const row = rows[0];
const opts = JSON.parse(row.options);
console.log("Q repr:", JSON.stringify(row.question));
console.log("OPT A repr:", JSON.stringify(opts[0]));
const idx = opts[0].indexOf("log");
console.log("slice around log:", JSON.stringify(opts[0].slice(idx - 3, idx + 15)));
