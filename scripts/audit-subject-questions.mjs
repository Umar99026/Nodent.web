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

const sql = neon(loadDatabaseUrl());

const counts = await sql`
  SELECT LOWER(TRIM(subject_id)) AS subject, COUNT(*)::int AS n
  FROM custom_questions
  GROUP BY 1
  ORDER BY n DESC
`;
console.log("Question counts by subject:");
for (const r of counts) console.log(`  ${r.subject}: ${r.n}`);

console.log("\n--- Demo (all) ---");
const demo = await sql`
  SELECT id, created_at, type, topic, LEFT(question, 80) AS q
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = 'demo'
  ORDER BY id
`;
for (const r of demo) console.log(r.id, r.created_at, r.type, "|", String(r.q).replace(/\s+/g, " "));

console.log("\n--- Methods imported today (2026-06-13) ---");
const methodsToday = await sql`
  SELECT id, created_at, type, topic, LEFT(question, 80) AS q
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = 'methods'
    AND created_at >= '2026-06-13'
  ORDER BY created_at DESC, id DESC
`;
console.log(`Count: ${methodsToday.length}`);
for (const r of methodsToday.slice(0, 20)) {
  console.log(r.id, r.created_at, "|", String(r.q).replace(/\s+/g, " ").slice(0, 70));
}
if (methodsToday.length > 20) console.log(`  ... and ${methodsToday.length - 20} more`);

console.log("\n--- Recent imports all subjects (last 30 by created_at) ---");
const recent = await sql`
  SELECT id, subject_id, created_at, LEFT(question, 60) AS q
  FROM custom_questions
  ORDER BY created_at DESC NULLS LAST, id DESC
  LIMIT 30
`;
for (const r of recent) {
  console.log(r.id, r.subject_id, r.created_at, "|", String(r.q).replace(/\s+/g, " "));
}

console.log("\n--- Multipart questions imported today ---");
const multipart = await sql`
  SELECT id, subject_id, created_at, question, answer_parts_json
  FROM custom_questions
  WHERE answer_parts_json IS NOT NULL
    AND created_at >= '2026-06-13'
  ORDER BY created_at, id
`;
let mpBySubject = {};
for (const r of multipart) {
  let n = 0;
  try { n = JSON.parse(r.answer_parts_json).length; } catch {}
  if (n < 2) continue;
  const sid = String(r.subject_id).toLowerCase();
  mpBySubject[sid] = (mpBySubject[sid] || 0) + 1;
  console.log(r.id, r.subject_id, r.created_at?.slice(0, 19), `(${n} parts)`, String(r.question).slice(0, 50).replace(/\s+/g, " ") || "(empty stem)");
}
console.log("Multipart totals:", mpBySubject);

const after13 = await sql`
  SELECT COUNT(*)::int AS n FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = 'methods' AND created_at >= '2026-06-13T13:00:00'
`;
console.log("\nMethods questions still after 13:00 (not moved):", after13[0].n);
