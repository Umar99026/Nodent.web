/**
 * Remove 50 easiest specialist-maths questions with diverse templates/topics.
 *
 *   node scripts/prune-easy-specialist-maths.mjs           # dry run
 *   node scripts/prune-easy-specialist-maths.mjs --apply   # delete from DB
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const SUBJECT = "specialist-maths";
const TARGET_REMOVE = 50;
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
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function templateBucket(row) {
  const q = stripMath(row.question).toLowerCase();
  const type = String(row.type ?? "short").toLowerCase();

  if (type === "mcq" || type === "multiple_choice") return "mcq";
  if (row.passage?.trim()) return "passage";

  const patterns = [
    [/\b(complex|argand|modulus|argument|polar|cis)\b/, "complex"],
    [/\b(vector|dot product|cross product|resolute|scalar triple)\b/, "vectors"],
    [/\b(line|plane|3d|three dimensions)\b/, "lines-planes"],
    [/\b(induction|inductive|contrapositive|converse|counterexample)\b/, "proof"],
    [/\b(differential equation|separable|euler|logistic)\b/, "de"],
    [/\b(integrat|volume|surface|solid|revolution)\b/, "integral-apps"],
    [/\b(derivative|differentiate|gradient|tangent|stationary)\b/, "calculus"],
    [/\b(kinematics|velocity|acceleration|displacement|projectile)\b/, "kinematics"],
    [/\b(curl|divergence|gradient field|vector calculus)\b/, "vector-calc"],
    [/\b(binomial|normal|probability|expected|variance|sampling)\b/, "probability"],
    [/\b(confidence interval|margin of error|z-?score)\b/, "confidence"],
    [/\b(graph|sketch|asymptote|relation|function)\b/, "graphs"],
    [/\b(find|calculate|determine|solve|evaluate|compute)\b.*\d/, "compute"],
    [/\b(find|calculate|determine|solve|evaluate|compute)\b/, "compute-short"],
    [/\b(state|define|identify|name|which|what is|true or false)\b/, "recall"],
    [/\b(explain|describe|interpret|justify|show that|prove)\b/, "explain"],
    [/\b(convert|express|simplify)\b/, "manipulate"],
  ];
  for (const [re, bucket] of patterns) {
    if (re.test(q)) return bucket;
  }
  if (wordCount(row.question) <= 8) return "very-short";
  if (wordCount(row.question) <= 14) return "short";
  return "other";
}

function easeScore(row) {
  const qWords = wordCount(row.question);
  const gWords = wordCount(row.guidance);
  const passageWords = wordCount(row.passage);
  const type = String(row.type ?? "short").toLowerCase();
  const marks = Math.max(1, Number(row.marks) || 1);
  const q = stripMath(row.question).toLowerCase();

  let score = 0;

  if (qWords <= 6) score += 35;
  else if (qWords <= 10) score += 28;
  else if (qWords <= 14) score += 20;
  else if (qWords <= 20) score += 10;
  else if (qWords <= 28) score += 4;

  if (marks === 1) score += 18;
  else if (marks === 2) score += 8;

  if (type === "mcq" || type === "multiple_choice") score += 12;

  if (!row.passage?.trim()) score += 6;
  if (!row.image_urls?.trim()) score += 3;

  if (gWords <= 5) score += 8;
  else if (gWords <= 12) score += 4;

  if (/^(what is|find|calculate|determine|state|identify|which|name|evaluate)\b/.test(q)) score += 10;
  if (/\?$/.test(q.trim()) && qWords <= 12) score += 6;
  if (/\b(true or false|yes or no)\b/.test(q)) score += 15;
  if (/\b(definition|meaning of)\b/.test(q)) score += 12;
  if (/^\s*(find|calculate|evaluate)\s+\d/.test(q)) score += 8;
  if ((q.match(/\d/g) || []).length >= 2 && qWords <= 12) score += 6;

  if (row.answer_parts_json?.trim()) {
    try {
      const parts = JSON.parse(row.answer_parts_json);
      if (Array.isArray(parts) && parts.length >= 2) score -= 30;
    } catch {
      score -= 10;
    }
  }
  if (passageWords > 20) score -= 20;
  if (/\b(explain|prove|show that|justify|discuss)\b/.test(q)) score -= 15;
  if (qWords > 35) score -= 12;
  if (marks >= 4) score -= 10;

  return score;
}

function pickDiverseRemovals(candidates, n) {
  const byBucket = new Map();
  for (const c of candidates) {
    const b = `${c.bucket}::${c.topic}`;
    if (!byBucket.has(b)) byBucket.set(b, []);
    byBucket.get(b).push(c);
  }
  for (const list of byBucket.values()) {
    list.sort((a, b) => b.ease - a.ease || a.id - b.id);
  }

  const buckets = [...byBucket.keys()].sort(
    (a, b) => byBucket.get(b).length - byBucket.get(a).length,
  );

  const picked = [];
  const pickedIds = new Set();
  const perBucketCap = Math.max(2, Math.ceil(n / Math.max(6, buckets.length)) + 1);

  let round = 0;
  while (picked.length < n && round < 300) {
    let added = false;
    for (const bucket of buckets) {
      if (picked.length >= n) break;
      const list = byBucket.get(bucket) ?? [];
      const bucketPicked = picked.filter((p) => `${p.bucket}::${p.topic}` === bucket).length;
      if (bucketPicked >= perBucketCap) continue;
      const next = list.find((x) => !pickedIds.has(x.id));
      if (!next) continue;
      picked.push(next);
      pickedIds.add(next.id);
      added = true;
    }
    if (!added) break;
    round++;
  }

  if (picked.length < n) {
    const rest = candidates
      .filter((c) => !pickedIds.has(c.id))
      .sort((a, b) => b.ease - a.ease || a.id - b.id);
    for (const c of rest) {
      if (picked.length >= n) break;
      picked.push(c);
      pickedIds.add(c.id);
    }
  }

  return picked.slice(0, n);
}

const databaseUrl = loadDatabaseUrl();
if (!databaseUrl) {
  console.error("Missing DATABASE_URL (.dev.vars or env).");
  process.exit(1);
}

const sql = neon(databaseUrl);
const rows = await sql`
  SELECT id, type, topic, marks, question, passage, guidance, image_urls, answer_parts_json, created_at
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = ${SUBJECT}
  ORDER BY id
`;

console.log(`Loaded ${rows.length} ${SUBJECT} questions.`);

const scored = rows.map((r) => {
  const ease = easeScore(r);
  const bucket = templateBucket(r);
  return {
    id: r.id,
    type: r.type,
    topic: r.topic || "General",
    marks: r.marks,
    ease,
    bucket,
    preview: stripMath(r.question).slice(0, 100),
  };
});

scored.sort((a, b) => b.ease - a.ease || a.id - b.id);

const easeThreshold = scored[Math.floor(scored.length * 0.45)]?.ease ?? 0;
const pool = scored.filter((s) => s.ease >= easeThreshold);
const toRemove = pickDiverseRemovals(pool, TARGET_REMOVE);

console.log(`\nEase threshold: ${easeThreshold}`);
console.log(`Candidate pool: ${pool.length}`);
console.log(`Selected for removal: ${toRemove.length}`);

const byBucket = new Map();
const byTopic = new Map();
for (const r of toRemove) {
  byBucket.set(r.bucket, (byBucket.get(r.bucket) ?? 0) + 1);
  byTopic.set(r.topic, (byTopic.get(r.topic) ?? 0) + 1);
}

console.log("\nRemoval by template bucket:");
for (const [k, v] of [...byBucket.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}`);
}
console.log("\nRemoval by topic:");
for (const [k, v] of [...byTopic.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k}: ${v}`);
}

console.log("\nSample removals (first 15):");
for (const r of toRemove.slice(0, 15)) {
  console.log(`  [${r.id}] ease=${r.ease} ${r.bucket} | ${r.preview}`);
}

const reportPath = resolve(process.cwd(), "scripts", "prune-specialist-maths-report.json");
writeFileSync(
  reportPath,
  JSON.stringify(
    {
      subject: SUBJECT,
      totalBefore: rows.length,
      removeCount: toRemove.length,
      totalAfter: rows.length - toRemove.length,
      byBucket: Object.fromEntries(byBucket),
      byTopic: Object.fromEntries(byTopic),
      removed: toRemove,
    },
    null,
    2,
  ),
);
console.log(`\nWrote report: ${reportPath}`);

if (!APPLY) {
  console.log("\nDry run only. Re-run with --apply to delete from database.");
  process.exit(0);
}

const ids = toRemove.map((r) => r.id);
const deleted = await sql`
  DELETE FROM custom_questions
  WHERE id = ANY(${ids}::int[])
  RETURNING id
`;
console.log(`\nDeleted ${deleted.length} questions. Remaining: ${rows.length - deleted.length}`);
