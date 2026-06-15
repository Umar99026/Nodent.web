/**
 * Align ai_marking_enabled for maths subjects with app rules:
 * - short_answer / mcq → off
 * - long_answer → on only if open-ended stem or prose rubric
 *
 *   node scripts/fix-maths-ai-marking.mjs           # dry run
 *   node scripts/fix-maths-ai-marking.mjs --apply
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const APPLY = process.argv.includes("--apply");
const MATHS = ["methods", "general-maths", "specialist-maths", "demo"];

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  const devVars = resolve(process.cwd(), ".dev.vars");
  const raw = readFileSync(devVars, "utf8");
  const m = raw.match(/^DATABASE_URL=(.+)$/m);
  return m[1].trim();
}

function stripLatex(s) {
  return String(s ?? "")
    .replace(/\$[^$]*\$/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const OPEN_ENDED =
  /\b(explain|prove|show\s+that|justify|verify|discuss|outline|identify|describe|compare|evaluate|comment|analyse|analyze|deduce|demonstrate|interpret|suggest|account\s+for|give\s+reasons|how\s+does|how\s+do|why\s+does|why\s+do|why\s+is|why\s+are|what\s+evidence|in\s+words|argue|assess|examine|sketch\s+the\s+graph\s+of|state\s+a\s+sequence)\b/i;

function parseNumeric(t) {
  const s = String(t ?? "").trim().toLowerCase().replace(/,/g, "");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function isAutoMarkable(raw) {
  const t = String(raw ?? "").trim();
  if (!t) return false;
  if (/^[a-d]$/i.test(t)) return true;
  if (parseNumeric(t) != null) return true;
  if (!/\s/.test(t) && t.length <= 32 && /^[a-z0-9$%/°π.-]+$/i.test(t)) return true;
  return false;
}

function stemNeedsAi(question, parts) {
  const texts = [question, ...parts.map((p) => p.label)].map(stripLatex).filter(Boolean);
  return texts.some((t) => OPEN_ENDED.test(t));
}

function answersNeedAi(accepted) {
  const list = accepted.filter(Boolean);
  if (!list.length) return false;
  if (list.every((a) => /see marking guide/i.test(a))) return true;
  if (list.every((a) => isAutoMarkable(a))) return false;
  return true;
}

function shouldEnable(row, parts, accepted) {
  const type = String(row.type ?? "").toLowerCase();
  if (type === "mcq" || type === "short_answer" || type === "short") return 0;
  if (type !== "long_answer" && type !== "long") return 0;
  if (stemNeedsAi(row.question, parts)) return 1;
  return answersNeedAi(accepted) ? 1 : 0;
}

const sql = neon(loadDatabaseUrl());
const rows = await sql`
  SELECT id, subject_id, type, question, accepted_answers, answer_parts_json, ai_marking_enabled
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = ANY(${MATHS})
  ORDER BY id
`;

let toOff = 0;
let toOn = 0;
const changes = [];

for (const row of rows) {
  let parts = [];
  let accepted = [];
  try {
    if (row.answer_parts_json) parts = JSON.parse(row.answer_parts_json);
  } catch {
    parts = [];
  }
  try {
    if (row.accepted_answers) accepted = JSON.parse(row.accepted_answers);
  } catch {
    accepted = [];
  }
  if (parts.length && parts.every((p) => p.acceptedAnswer)) {
    accepted = parts.map((p) => p.acceptedAnswer);
  }

  const next = shouldEnable(row, parts, accepted);
  const cur = row.ai_marking_enabled === 1 ? 1 : 0;
  if (next !== cur) {
    changes.push({ id: row.id, subject: row.subject_id, type: row.type, cur, next });
    if (next) toOn++;
    else toOff++;
  }
}

console.log(`Scanned ${rows.length} maths questions.`);
console.log(`Would turn OFF: ${toOff}, turn ON: ${toOn}`);
for (const c of changes.slice(0, 12)) {
  console.log(`  [${c.id}] ${c.subject} ${c.type}: ${c.cur} → ${c.next}`);
}
if (changes.length > 12) console.log(`  ... and ${changes.length - 12} more`);

if (!APPLY) {
  console.log("\nDry run — pass --apply to update.");
  process.exit(0);
}

for (const c of changes) {
  await sql`
    UPDATE custom_questions
    SET ai_marking_enabled = ${c.next}
    WHERE id = ${c.id}
  `;
}
console.log(`\nUpdated ${changes.length} row(s).`);
