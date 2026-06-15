/**
 * Remove N easiest general-maths questions with diverse templates/topics.
 *
 * Usage:
 *   node scripts/prune-easy-general-maths.mjs           # dry run
 *   node scripts/prune-easy-general-maths.mjs --apply   # delete from DB
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const SUBJECT = "general-maths";
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

/** Coarse template bucket for diversity when picking removals. */
function templateBucket(row) {
  const q = stripMath(row.question).toLowerCase();
  const type = String(row.type ?? "short").toLowerCase();

  if (type === "mcq" || type === "multiple_choice") return "mcq";
  if (row.passage?.trim()) return "passage";

  const patterns = [
    [/\b(mean|median|mode|range|quartile|iqr|percentile|standard deviation|z-?score)\b/, "stats-vocab"],
    [/\b(residual|least.?squares|regression|correlation|scatter)\b/, "stats-regression"],
    [/\b(seasonal|trend|deseasonal|time series|smoothing)\b/, "stats-time-series"],
    [/\b(recurrence|recursive|sequence|fibonacci)\b/, "recursion"],
    [/\b(loan|interest|repayment|annuity|compound|depreciation|reducing balance)\b/, "finance"],
    [/\b(matrix|matrices|transition|markov)\b/, "matrices"],
    [/\b(network|critical path|activity|precedence|spanning|shortest path|dijkstra)\b/, "networks"],
    [/\b(find|calculate|determine|solve|evaluate|compute)\b.*\d/, "compute"],
    [/\b(find|calculate|determine|solve|evaluate|compute)\b/, "compute-short"],
    [/\b(state|define|identify|name|which|what is|true or false)\b/, "recall"],
    [/\b(explain|describe|interpret|justify|show that)\b/, "explain"],
    [/\b(graph|plot|sketch)\b/, "graph"],
    [/\b(simultaneous|equation|formula|substitute)\b/, "algebra"],
    [/\b(probability|chance|odds|expected)\b/, "probability"],
    [/\b(convert|change|express)\b/, "convert"],
  ];
  for (const [re, bucket] of patterns) {
    if (re.test(q)) return bucket;
  }
  if (wordCount(row.question) <= 8) return "very-short";
  if (wordCount(row.question) <= 14) return "short";
  return "other";
}

/** Higher = easier (more eligible for removal). */
function easeScore(row) {
  const qWords = wordCount(row.question);
  const gWords = wordCount(row.guidance);
  const passageWords = wordCount(row.passage);
  const type = String(row.type ?? "short").toLowerCase();
  const marks = Math.max(1, Number(row.marks) || 1);
  const q = stripMath(row.question).toLowerCase();

  let score = 0;

  // Short stem = easier
  if (qWords <= 6) score += 35;
  else if (qWords <= 10) score += 28;
  else if (qWords <= 14) score += 20;
  else if (qWords <= 20) score += 10;
  else if (qWords <= 28) score += 4;

  // Low marks
  if (marks === 1) score += 18;
  else if (marks === 2) score += 8;

  // MCQ often simpler
  if (type === "mcq" || type === "multiple_choice") score += 12;

  // No passage / images
  if (!row.passage?.trim()) score += 6;
  if (!row.image_urls?.trim()) score += 3;

  // Minimal guidance
  if (gWords <= 5) score += 8;
  else if (gWords <= 12) score += 4;

  // Recall / one-step patterns
  if (/^(what is|find|calculate|determine|state|identify|which|name)\b/.test(q)) score += 10;
  if (/\b(true or false|yes or no)\b/.test(q)) score += 15;
  if (/\b(definition|meaning of)\b/.test(q)) score += 12;

  // Very basic arithmetic-looking
  if (/^\s*(find|calculate|evaluate)\s+\d/.test(q)) score += 8;
  if ((q.match(/\d/g) || []).length >= 2 && qWords <= 12) score += 6;

  // Penalise multipart / long / explain
  if (row.answer_parts_json?.trim()) score -= 25;
  if (passageWords > 20) score -= 20;
  if (/\b(explain|prove|show that|justify|discuss)\b/.test(q)) score -= 15;
  if (qWords > 35) score -= 12;
  if (marks >= 4) score -= 10;

  return score;
}

function pickDiverseRemovals(candidates, n) {
  const byBucket = new Map();
  for (const c of candidates) {
    const b = c.bucket;
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
  const perBucketCap = Math.max(3, Math.ceil(n / Math.max(4, buckets.length)) + 2);

  // Round-robin across buckets, taking easiest from each until we hit N
  let round = 0;
  while (picked.length < n && round < 200) {
    let added = false;
    for (const bucket of buckets) {
      if (picked.length >= n) break;
      const list = byBucket.get(bucket) ?? [];
      const bucketPicked = picked.filter((p) => p.bucket === bucket).length;
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

  // Fill remainder from global easiest not yet picked
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
    topic: r.topic,
    marks: r.marks,
    ease,
    bucket,
    preview: stripMath(r.question).slice(0, 100),
  };
});

scored.sort((a, b) => b.ease - a.ease || a.id - b.id);

// Only consider reasonably easy questions (top ~45% by ease score)
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

const reportPath = resolve(process.cwd(), "scripts", "prune-general-maths-report.json");
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
