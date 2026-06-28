/**
 * Move all demo questions → specialist-maths (topics must match VCE Specialist list).
 *
 *   node scripts/move-demo-to-specialist-maths.mjs           # dry run
 *   node scripts/move-demo-to-specialist-maths.mjs --apply
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const SPECIALIST_TOPICS = [
  "Logic and proof",
  "Complex numbers and algebra",
  "Functions, relations and graphs",
  "Differential calculus",
  "Integral calculus",
  "Differential equations",
  "Kinematics",
  "Vectors in two and three dimensions",
  "Lines and planes in 3D",
  "Vector calculus",
  "Random variables and sampling",
  "Confidence intervals",
];

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

function canonicalTopic(topic) {
  const t = String(topic ?? "").trim();
  if (!t) return null;
  return SPECIALIST_TOPICS.find((x) => x.toLowerCase() === t.toLowerCase()) ?? null;
}

const apply = process.argv.includes("--apply");
const sql = neon(loadDatabaseUrl());

const rows = await sql`
  SELECT id, topic, LEFT(question, 70) AS q
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = 'demo'
  ORDER BY id
`;

console.log(`Found ${rows.length} demo question(s):\n`);

let badTopics = 0;
for (const r of rows) {
  const ok = canonicalTopic(r.topic);
  if (!ok) {
    badTopics++;
    console.log(`  [!] id ${r.id} invalid topic: ${JSON.stringify(r.topic)}`);
  } else {
    console.log(`  ${r.id} | ${ok}`);
  }
}

if (badTopics) {
  console.error(`\n${badTopics} question(s) have non-Specialist topics. Fix before moving.`);
  process.exit(1);
}

if (!rows.length) {
  console.log("Nothing to move.");
  process.exit(0);
}

if (!apply) {
  console.log("\nDry run — pass --apply to move to specialist-maths.");
  process.exit(0);
}

const updated = await sql`
  UPDATE custom_questions
  SET subject_id = 'specialist-maths'
  WHERE LOWER(TRIM(subject_id)) = 'demo'
  RETURNING id, topic
`;

const smCount = await sql`
  SELECT COUNT(*)::int AS n FROM custom_questions WHERE LOWER(TRIM(subject_id))='specialist-maths'
`;
const demoCount = await sql`
  SELECT COUNT(*)::int AS n FROM custom_questions WHERE LOWER(TRIM(subject_id))='demo'
`;

console.log(`\nMoved ${updated.length} question(s) to specialist-maths.`);
console.log(`Specialist-maths total: ${smCount[0].n}`);
console.log(`Demo total: ${demoCount[0].n}`);
