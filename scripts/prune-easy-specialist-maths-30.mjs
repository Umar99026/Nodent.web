/**
 * Remove 30 easiest specialist-maths drills (prioritises dot-product templates).
 *
 *   node scripts/prune-easy-specialist-maths-30.mjs           # dry run
 *   node scripts/prune-easy-specialist-maths-30.mjs --apply
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const SUBJECT = "specialist-maths";
const TARGET_REMOVE = 30;
const APPLY = process.argv.includes("--apply");

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

function stripMath(s) {
  return String(s ?? "")
    .replace(/\$[^$]*\$/g, " ")
    .replace(/\\[a-zA-Z]+/g, " ")
    .replace(/[{}_^]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function wordCount(s) {
  const t = stripMath(s);
  return t ? t.split(/\s+/).filter(Boolean).length : 0;
}

function easeScore(row) {
  const q = stripMath(row.question).toLowerCase();
  const qWords = wordCount(row.question);
  const marks = Math.max(1, Number(row.marks) || 1);
  let score = 0;

  if (/find a[·⋅]b for/.test(q)) score += 80;
  if (/^find (a|the) (dot|scalar) product/.test(q)) score += 70;
  if (/^(find|calculate|evaluate|determine|state|what is)\b/.test(q)) score += 12;
  if (/\?$/.test(q.trim()) && qWords <= 14) score += 8;
  if (qWords <= 8) score += 30;
  else if (qWords <= 12) score += 22;
  else if (qWords <= 16) score += 14;
  if (marks <= 2) score += 12;
  if (!row.answer_parts_json?.trim()) score += 8;

  if (row.answer_parts_json?.trim()) {
    try {
      const parts = JSON.parse(row.answer_parts_json);
      if (Array.isArray(parts) && parts.length >= 2) score -= 35;
    } catch {
      /* ignore */
    }
  }

  return score;
}

function isDotProductDrill(question) {
  const q = stripMath(question).toLowerCase();
  return /find a[·⋅]b for/.test(q);
}

function pickRemovals(candidates, n) {
  const sorted = [...candidates].sort((a, b) => b.ease - a.ease || a.id - b.id);
  const picked = [];
  const pickedIds = new Set();

  for (const c of sorted) {
    if (!isDotProductDrill(c.question)) continue;
    picked.push(c);
    pickedIds.add(c.id);
  }

  for (const c of sorted) {
    if (picked.length >= n) break;
    if (pickedIds.has(c.id)) continue;
    picked.push(c);
    pickedIds.add(c.id);
  }

  return picked.slice(0, n);
}

const databaseUrl = loadDatabaseUrl();
if (!databaseUrl) {
  console.error("Missing DATABASE_URL.");
  process.exit(1);
}

const sql = neon(databaseUrl);
const rows = await sql`
  SELECT id, type, topic, marks, question, guidance, answer_parts_json
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = ${SUBJECT}
  ORDER BY id
`;

const scored = rows.map((r) => ({
  id: r.id,
  type: r.type,
  topic: r.topic || "General",
  marks: r.marks,
  ease: easeScore(r),
  question: r.question,
  preview: stripMath(r.question).slice(0, 100),
}));

const toRemove = pickRemovals(scored, TARGET_REMOVE);

console.log(`Loaded ${rows.length} ${SUBJECT} questions.`);
console.log(`Selected ${toRemove.length} for removal:\n`);
for (const r of toRemove) {
  console.log(`  [${r.id}] ease=${r.ease} | ${r.preview}`);
}

const reportPath = resolve(process.cwd(), "scripts", "prune-easy-specialist-maths-30-report.json");
writeFileSync(
  reportPath,
  JSON.stringify(
    {
      subject: SUBJECT,
      totalBefore: rows.length,
      removeCount: toRemove.length,
      totalAfter: rows.length - toRemove.length,
      removed: toRemove,
    },
    null,
    2,
  ),
);
console.log(`\nWrote ${reportPath}`);

if (!APPLY) {
  console.log("\nDry run. Re-run with --apply to delete.");
  process.exit(0);
}

const ids = toRemove.map((r) => r.id);
const deleted = await sql`
  DELETE FROM custom_questions
  WHERE id = ANY(${ids}::int[])
  RETURNING id
`;
console.log(`\nDeleted ${deleted.length}. Remaining: ${rows.length - deleted.length}`);
