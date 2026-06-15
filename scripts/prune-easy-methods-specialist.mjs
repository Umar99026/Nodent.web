/**
 * Remove 50 easiest methods + 50 easiest specialist-maths questions (diverse topics).
 * Protects the recent PDF import batch (demo → methods, ~2026-06-13 13:47).
 *
 *   node scripts/prune-easy-methods-specialist.mjs           # dry run
 *   node scripts/prune-easy-methods-specialist.mjs --apply   # delete
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const TARGET_PER_SUBJECT = 50;
const APPLY = process.argv.includes("--apply");

/** Do not delete the PDF import batch moved from demo. */
const METHODS_PROTECT_AFTER = "2026-06-13T13:45:00";

const SUBJECTS = [
  {
    id: "methods",
    protectCreatedAfter: METHODS_PROTECT_AFTER,
    protectIds: [6565, 6566, 6567, 6568, 6569, 6570, 6571],
  },
  { id: "specialist-maths", protectCreatedAfter: null, protectIds: [] },
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

function templateBucket(row, subjectId) {
  const q = stripMath(row.question).toLowerCase();
  const type = String(row.type ?? "short").toLowerCase();
  const topic = String(row.topic ?? "").toLowerCase();

  if (type === "mcq" || type === "multiple_choice") return "mcq";
  if (row.passage?.trim()) return "passage";

  const methodsPatterns = [
    [/\b(derivative|differentiate|f'|gradient|tangent)\b/, "calculus-derivative"],
    [/\b(integrat|antiderivative|area under)\b/, "calculus-integral"],
    [/\b(limit|continu|differentiab)\b/, "limits"],
    [/\b(binomial|normal|probability|pr\(|expected value|variance)\b/, "probability"],
    [/\b(domain|range|function|composite|inverse)\b/, "functions"],
    [/\b(log|exponential|e\^|ln\b)/, "exp-log"],
    [/\b(sin|cos|tan|trig)\b/, "trig"],
    [/\b(simultaneous|linear equation|matrix)\b/, "algebra"],
    [/\b(hypothesis|confidence|sample|p-?value)\b/, "stats"],
  ];

  const specialistPatterns = [
    [/\b(complex|argand|modulus|argument|polar)\b/, "complex"],
    [/\b(vector|dot product|cross product|resolute)\b/, "vectors"],
    [/\b(induction|inductive)\b/, "induction"],
    [/\b(differential equation|separable|euler)\b/, "de"],
    [/\b(integrat|volume|surface|solid)\b/, "calc-apps"],
    [/\b(derivative|differentiate|gradient)\b/, "calculus"],
    [/\b(probability|binomial|normal)\b/, "probability"],
    [/\b(matrix|matrices|transformation)\b/, "matrices"],
    [/\b(graph|sketch|asymptote)\b/, "graphs"],
  ];

  const common = [
    [/\b(find|calculate|determine|solve|evaluate|compute)\b.*\d/, "compute"],
    [/\b(find|calculate|determine|solve|evaluate|compute)\b/, "compute-short"],
    [/\b(state|define|identify|name|which|what is|true or false)\b/, "recall"],
    [/\b(explain|describe|interpret|justify|show that|prove)\b/, "explain"],
    [/\b(graph|plot|sketch)\b/, "graph"],
    [/\b(convert|express|simplify)\b/, "manipulate"],
  ];

  const patterns =
    subjectId === "specialist-maths"
      ? [...specialistPatterns, ...common]
      : [...methodsPatterns, ...common];

  for (const [re, bucket] of patterns) {
    if (re.test(q)) return bucket;
  }
  if (topic.includes("calculus")) return "topic-calculus";
  if (topic.includes("function")) return "topic-functions";
  if (topic.includes("prob")) return "topic-probability";
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
const allRemoved = [];

for (const cfg of SUBJECTS) {
  const rows = await sql`
    SELECT id, type, topic, marks, question, passage, guidance, image_urls, answer_parts_json, created_at
    FROM custom_questions
    WHERE LOWER(TRIM(subject_id)) = ${cfg.id}
    ORDER BY id
  `;

  const eligible = rows.filter((r) => {
    if (cfg.protectIds.includes(r.id)) return false;
    if (cfg.protectCreatedAfter && r.created_at) {
      const t = new Date(r.created_at).toISOString();
      if (t >= cfg.protectCreatedAfter) return false;
    }
    return true;
  });

  console.log(`\n=== ${cfg.id} ===`);
  console.log(`Total: ${rows.length}, eligible (pre-import): ${eligible.length}`);

  const scored = eligible.map((r) => {
    const ease = easeScore(r);
    const bucket = templateBucket(r, cfg.id);
    return {
      id: r.id,
      type: r.type,
      topic: r.topic || "General",
      marks: r.marks,
      ease,
      bucket,
      preview: stripMath(r.question).slice(0, 90),
    };
  });

  scored.sort((a, b) => b.ease - a.ease || a.id - b.id);

  const easeThreshold = scored[Math.floor(scored.length * 0.45)]?.ease ?? 0;
  const pool = scored.filter((s) => s.ease >= easeThreshold);
  const toRemove = pickDiverseRemovals(pool, TARGET_PER_SUBJECT);

  const byTopic = new Map();
  for (const r of toRemove) {
    byTopic.set(r.topic, (byTopic.get(r.topic) ?? 0) + 1);
  }

  console.log(`Ease threshold: ${easeThreshold}, pool: ${pool.length}, removing: ${toRemove.length}`);
  console.log("By topic:");
  for (const [k, v] of [...byTopic.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v}`);
  }
  console.log("Sample:");
  for (const r of toRemove.slice(0, 8)) {
    console.log(`  [${r.id}] ease=${r.ease} ${r.bucket} | ${r.preview}`);
  }

  allRemoved.push({ subject: cfg.id, totalBefore: rows.length, removed: toRemove });
}

const reportPath = resolve(process.cwd(), "scripts", "prune-methods-specialist-report.json");
writeFileSync(
  reportPath,
  JSON.stringify(
    {
      targetPerSubject: TARGET_PER_SUBJECT,
      methodsProtectAfter: METHODS_PROTECT_AFTER,
      subjects: allRemoved.map((s) => ({
        subject: s.subject,
        totalBefore: s.totalBefore,
        removeCount: s.removed.length,
        totalAfter: s.totalBefore - s.removed.length,
        removed: s.removed,
      })),
    },
    null,
    2,
  ),
);
console.log(`\nWrote ${reportPath}`);

if (!APPLY) {
  console.log("\nDry run — re-run with --apply to delete.");
  process.exit(0);
}

let totalDeleted = 0;
for (const s of allRemoved) {
  const ids = s.removed.map((r) => r.id);
  if (!ids.length) continue;
  const deleted = await sql`
    DELETE FROM custom_questions
    WHERE id = ANY(${ids}::int[])
    RETURNING id
  `;
  totalDeleted += deleted.length;
  console.log(`Deleted ${deleted.length} from ${s.subject} (remaining ~${s.totalBefore - deleted.length})`);
}
console.log(`\nTotal deleted: ${totalDeleted}`);
