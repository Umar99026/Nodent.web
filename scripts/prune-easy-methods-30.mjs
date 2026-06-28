/**
 * Remove 30 easiest methods questions (short recall / z-value drills).
 *
 *   node scripts/prune-easy-methods-30.mjs
 *   node scripts/prune-easy-methods-30.mjs --apply
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const SUBJECT = "methods";
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
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

function isTrivialRecall(row) {
  const q = stripMath(row.question).toLowerCase();
  const raw = String(row.question ?? "").toLowerCase();
  if (/\bconfidence uses\b/i.test(raw) && /z/i.test(raw)) return true;
  if (/z\s*\\approx|z\s*approx/i.test(raw)) return true;
  if (/\b(true or false|yes or no)\b/.test(q)) return true;
  if (/\bone word\b/.test(q)) return true;
  if (/\bempirical rule\b/.test(q)) return true;
  if (/\brefers to the long-run\b/.test(q)) return true;
  if (/\b(includes which function|which letter)\b/.test(q)) return true;
  if (/\bexact value\b/.test(q) && wordCount(row.question) <= 14) return true;
  if (wordCount(row.question) <= 6 && /\?$/.test(q.trim())) return true;
  if (/\b(is this allowed|is .* known|is .* valid)\b/.test(q)) return true;
  if (/\b(wider than|more or less)\b/.test(q) && wordCount(row.question) <= 16) return true;
  if (/^\s*(evaluate|solve|simplify)\s+/i.test(q) && wordCount(row.question) <= 8) return true;
  if (/\b(coefficient of|equals\?|=\s*\?)\b/.test(raw) && wordCount(row.question) <= 12) return true;
  return false;
}

function templateBucket(row) {
  const q = stripMath(row.question).toLowerCase();
  const type = String(row.type ?? "short").toLowerCase();

  if (type === "mcq" || type === "multiple_choice") return "mcq";
  if (row.passage?.trim()) return "passage";
  if (row.answer_parts_json?.trim()) return "multipart";

  const patterns = [
    [/\b(confidence|margin of error|z\s*approx|z-score|empirical rule)\b/, "stats-recall"],
    [/\b(true or false|yes or no|one word|one-word|2 d\.p\.|3 d\.p\.)\b/, "recall-format"],
    [/\b(definition|meaning of|refers to the)\b/, "definition"],
    [/\b(evaluate|simplify|solve|find|calculate|determine|state|identify)\b/, "compute"],
    [/\b(domain|range|asymptote|period|amplitude|median|expected|variance)\b/, "concept"],
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
  const type = String(row.type ?? "short").toLowerCase();
  const marks = Math.max(1, Number(row.marks) || 1);
  const q = stripMath(row.question).toLowerCase();
  const raw = String(row.question ?? "").toLowerCase();

  let score = 0;

  if (qWords <= 6) score += 40;
  else if (qWords <= 10) score += 32;
  else if (qWords <= 14) score += 24;
  else if (qWords <= 20) score += 12;

  if (marks <= 2) score += 10;
  if (!row.passage?.trim()) score += 4;
  if (!row.image_urls?.trim()) score += 3;
  if (gWords <= 5) score += 10;

  if (/\bconfidence uses\b/i.test(raw) && /z/i.test(raw)) score += 40;
  if (/\b(true or false|yes or no)\b/.test(q)) score += 25;
  if (/\bone word\b/.test(q)) score += 22;
  if (/\b\(2 d\.p\.\)|\(3 d\.p\.\)/.test(raw)) score += 12;
  if (/\bconfidence uses\b.*\bz\b/.test(q)) score += 25;
  if (/\bz\s*approx/.test(q)) score += 22;
  if (/\bempirical rule\b/.test(q)) score += 18;
  if (/\bexact value\b/.test(q)) score += 10;
  if (/^(find|evaluate|solve|state|what is|which)\b/.test(q) && qWords <= 12) score += 12;
  if (/\?$/.test(q.trim()) && qWords <= 10) score += 8;

  if (row.answer_parts_json?.trim()) {
    try {
      const parts = JSON.parse(row.answer_parts_json);
      if (Array.isArray(parts) && parts.length >= 2) score -= 50;
    } catch {
      score -= 15;
    }
  }
  if (qWords > 30) score -= 20;
  if (marks >= 4) score -= 15;
  if (/\b(explain|prove|show that|justify|discuss|hence)\b/.test(q)) score -= 20;

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
  const perBucketCap = Math.max(2, Math.ceil(n / Math.max(5, buckets.length)) + 1);

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
    for (const c of candidates.filter((x) => !pickedIds.has(x.id)).sort((a, b) => b.ease - a.ease)) {
      if (picked.length >= n) break;
      picked.push(c);
      pickedIds.add(c.id);
    }
  }

  return picked.slice(0, n);
}

const databaseUrl = loadDatabaseUrl();
if (!databaseUrl) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const sql = neon(databaseUrl);
const rows = await sql`
  SELECT id, type, topic, marks, question, passage, guidance, image_urls, answer_parts_json
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = ${SUBJECT}
  ORDER BY id
`;

const scored = rows.map((r) => {
  const ease = easeScore(r) + (isTrivialRecall(r) ? 120 : 0);
  const bucket = templateBucket(r);
  return {
    id: r.id,
    type: r.type,
    topic: r.topic || "General",
    marks: r.marks,
    ease,
    trivial: isTrivialRecall(r),
    bucket,
    question: r.question,
    preview: stripMath(r.question).slice(0, 100),
  };
});

scored.sort((a, b) => b.ease - a.ease || a.id - b.id);
const toRemove = scored.slice(0, TARGET_REMOVE);

console.log(`Methods total: ${rows.length}`);
console.log(`Removing ${toRemove.length} easiest:\n`);
for (const r of toRemove) {
  console.log(`  [${r.id}] ease=${r.ease} | ${r.preview}`);
}

const reportPath = resolve(process.cwd(), "scripts", "prune-easy-methods-30-report.json");
writeFileSync(
  reportPath,
  JSON.stringify({ removed: toRemove, questions: toRemove.map((r) => r.question) }, null, 2),
);
console.log(`\nWrote ${reportPath}`);

if (!APPLY) {
  console.log("\nDry run — pass --apply to delete.");
  process.exit(0);
}

const ids = toRemove.map((r) => r.id);
const deleted = await sql`
  DELETE FROM custom_questions WHERE id = ANY(${ids}::int[]) RETURNING id
`;
console.log(`\nDeleted ${deleted.length} methods question(s).`);
