/**
 * Remove 50 easiest questions per maths subject with even topic spread.
 *
 *   node scripts/prune-easy-maths-all.mjs           # dry run
 *   node scripts/prune-easy-maths-all.mjs --apply   # delete
 */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const TARGET_PER_SUBJECT = 50;
const APPLY = process.argv.includes("--apply");

const METHODS_PROTECT_AFTER = "2026-06-13T13:45:00";

const SUBJECTS = [
  {
    id: "methods",
    protectCreatedAfter: METHODS_PROTECT_AFTER,
    protectIds: [6565, 6566, 6567, 6568, 6569, 6570, 6571],
  },
  { id: "specialist-maths", protectCreatedAfter: null, protectIds: [] },
  { id: "general-maths", protectCreatedAfter: null, protectIds: [] },
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

/** Round-robin across topics, taking easiest per topic each round. */
function pickEvenTopicRemovals(candidates, n) {
  const byTopic = new Map();
  for (const c of candidates) {
    const topic = c.topic || "General";
    if (!byTopic.has(topic)) byTopic.set(topic, []);
    byTopic.get(topic).push(c);
  }
  for (const list of byTopic.values()) {
    list.sort((a, b) => b.ease - a.ease || a.id - b.id);
  }

  const topics = [...byTopic.keys()].sort(
    (a, b) => byTopic.get(b).length - byTopic.get(a).length,
  );

  const picked = [];
  const pickedIds = new Set();
  const topicCounts = new Map();
  const perTopicCap = Math.max(2, Math.ceil(n / Math.max(4, topics.length)) + 1);

  let round = 0;
  while (picked.length < n && round < 400) {
    let added = false;
    for (const topic of topics) {
      if (picked.length >= n) break;
      const count = topicCounts.get(topic) ?? 0;
      if (count >= perTopicCap) continue;
      const list = byTopic.get(topic) ?? [];
      const next = list.find((x) => !pickedIds.has(x.id));
      if (!next) continue;
      picked.push(next);
      pickedIds.add(next.id);
      topicCounts.set(topic, count + 1);
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
  console.log(`Total: ${rows.length}, eligible: ${eligible.length}`);

  const scored = eligible.map((r) => ({
    id: r.id,
    type: r.type,
    topic: r.topic || "General",
    marks: r.marks,
    ease: easeScore(r),
    preview: stripMath(r.question).slice(0, 90),
  }));

  scored.sort((a, b) => b.ease - a.ease || a.id - b.id);

  const easeThreshold = scored[Math.floor(scored.length * 0.4)]?.ease ?? 0;
  const pool = scored.filter((s) => s.ease >= easeThreshold);
  const toRemove = pickEvenTopicRemovals(pool, TARGET_PER_SUBJECT);

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
  for (const r of toRemove.slice(0, 6)) {
    console.log(`  [${r.id}] ease=${r.ease} | ${r.topic} | ${r.preview}`);
  }

  allRemoved.push({ subject: cfg.id, totalBefore: rows.length, removed: toRemove });
}

const reportPath = resolve(process.cwd(), "scripts", "prune-easy-maths-all-report.json");
writeFileSync(
  reportPath,
  JSON.stringify(
    {
      targetPerSubject: TARGET_PER_SUBJECT,
      subjects: allRemoved.map((s) => ({
        subject: s.subject,
        totalBefore: s.totalBefore,
        removeCount: s.removed.length,
        totalAfter: s.totalBefore - s.removed.length,
        byTopic: Object.fromEntries(
          s.removed.reduce((m, r) => {
            m.set(r.topic, (m.get(r.topic) ?? 0) + 1);
            return m;
          }, new Map()),
        ),
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
