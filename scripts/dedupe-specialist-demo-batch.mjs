import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const APPLY = process.argv.includes("--apply");
const raw = readFileSync(resolve(".dev.vars"), "utf8");
const sql = neon(raw.match(/^DATABASE_URL=(.+)$/m)[1].trim().replace(/^["']|["']$/g, ""));

function stemKey(q) {
  return String(q ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

const rows = await sql`
  SELECT id, question, topic
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = 'specialist-maths'
    AND id >= 7880
  ORDER BY id
`;

const byStem = new Map();
for (const r of rows) {
  const k = stemKey(r.question);
  if (!byStem.has(k)) byStem.set(k, []);
  byStem.get(k).push(r);
}

const toDelete = [];
for (const [k, group] of byStem) {
  if (group.length <= 1) continue;
  group.sort((a, b) => a.id - b.id);
  const keep = group[0];
  for (const dup of group.slice(1)) {
    toDelete.push(dup);
    console.log(`dup stem: keep ${keep.id}, delete ${dup.id} | ${k.slice(0, 70)}`);
  }
}

console.log(`\n${toDelete.length} duplicate(s) to remove`);

if (!APPLY || !toDelete.length) {
  if (!APPLY) console.log("Dry run — pass --apply to delete.");
  process.exit(0);
}

const ids = toDelete.map((r) => r.id);
const del = await sql`DELETE FROM custom_questions WHERE id = ANY(${ids}::int[]) RETURNING id`;
console.log(`Deleted ${del.length}`);

const count = await sql`
  SELECT COUNT(*)::int AS n FROM custom_questions WHERE LOWER(TRIM(subject_id))='specialist-maths'
`;
console.log(`specialist-maths total: ${count[0].n}`);
