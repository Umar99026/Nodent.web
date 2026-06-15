import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  const devVars = resolve(process.cwd(), ".dev.vars");
  if (!existsSync(devVars)) return "";
  const raw = readFileSync(devVars, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^DATABASE_URL=(.+)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

const apply = process.argv.includes("--apply");
const sql = neon(loadDatabaseUrl());

const rows = await sql`
  SELECT id, subject_id, question, answer_parts_json
  FROM custom_questions
  WHERE question ILIKE '%Determine the area of the region bounded%'
     OR question ILIKE '%bounded by the line $x=-2%'
  ORDER BY id
`;

for (const r of rows) {
  console.log("ID", r.id, r.subject_id);
  console.log("Q:", r.question);
  console.log("PARTS:", r.answer_parts_json);
  console.log("---");
}

if (!rows.length) {
  console.log("No matching rows");
  process.exit(0);
}

function stripLeadingPart(text) {
  return String(text ?? "")
    .trim()
    .replace(/^[a-z]\s*[).:\-–—]\s*/i, "")
    .trim();
}

for (const r of rows) {
  const nextQ = stripLeadingPart(r.question);
  if (nextQ === r.question) continue;
  console.log(`Would update ${r.id}:`, nextQ.slice(0, 100));
  if (apply) {
    await sql`UPDATE custom_questions SET question = ${nextQ} WHERE id = ${r.id}`;
    console.log("Updated", r.id);
  }
}

if (!apply) console.log("\nDry run — pass --apply to write");
