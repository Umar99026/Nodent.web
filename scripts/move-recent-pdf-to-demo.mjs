/** Move the latest PDF import batch (methods @ 13:47) into demo for testing. */
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

const ids = [6565, 6566, 6567, 6568, 6569, 6570];
const rows = await sql`
  SELECT id, subject_id, LEFT(question, 80) AS q
  FROM custom_questions
  WHERE id = ANY(${ids})
  ORDER BY id
`;
console.log("Will move to demo:", rows.length, "rows");
for (const r of rows) console.log(" ", r.id, r.subject_id, "|", r.q);

const broken = await sql`
  SELECT id, LEFT(question, 120) AS q FROM custom_questions WHERE id = 6571
`;
if (broken.length) {
  console.log("\nSkipping broken row 6571 (unparsed metadata as question):", broken[0].q);
}

if (!apply) {
  console.log("\nDry run — pass --apply to update subject_id to demo");
  process.exit(0);
}

const updated = await sql`
  UPDATE custom_questions
  SET subject_id = 'demo'
  WHERE id = ANY(${ids})
  RETURNING id
`;
console.log("\nMoved", updated.length, "question(s) to demo:", updated.map((r) => r.id).join(", "));
