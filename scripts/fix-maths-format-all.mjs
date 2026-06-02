/**
 * Fix LaTeX / math delimiters for Methods, Specialist, and General Maths questions.
 * Usage: ADMIN_KEY=localdev node scripts/fix-maths-format-all.mjs [baseUrl]
 */
import {
  mathifyQuestionText,
  questionNeedsMathFormat,
} from "./lib/mathify-question-text.mjs";

const base = (process.argv[2] || "http://127.0.0.1:8787").replace(/\/$/, "");
const adminKey = process.env.ADMIN_KEY || process.env.NODENT_ADMIN_KEY;
if (!adminKey) {
  console.error("Set ADMIN_KEY");
  process.exit(1);
}

const MATH_SUBJECTS = new Set(["methods", "specialist", "general"]);

function mathifyField(text) {
  if (!text?.trim()) return null;
  const next = mathifyQuestionText(text);
  return next !== text ? next : null;
}

function mathifyOptions(options) {
  if (!Array.isArray(options) || !options.length) return null;
  let changed = false;
  const next = options.map((opt) => {
    const n = mathifyQuestionText(String(opt ?? ""));
    if (n !== opt) changed = true;
    return n;
  });
  return changed ? next : null;
}

const listRes = await fetch(`${base}/api/admin/questions`, {
  headers: { "X-Admin-Key": adminKey },
  signal: AbortSignal.timeout(120_000),
});
const list = await listRes.json();
if (!listRes.ok) {
  console.error("List failed", list);
  process.exit(1);
}

const candidates = list.filter(
  (q) =>
    MATH_SUBJECTS.has(q.subjectId) &&
    (questionNeedsMathFormat(q.question) ||
      questionNeedsMathFormat(q.guidance) ||
      questionNeedsMathFormat(q.passage) ||
      (Array.isArray(q.options) && q.options.some((o) => questionNeedsMathFormat(o)))),
);

console.log(`Found ${candidates.length} maths question(s) to fix.`);

let updated = 0;
for (const q of candidates) {
  const body = {};
  const nq = mathifyField(q.question);
  if (nq) body.question = nq;
  const ng = mathifyField(q.guidance);
  if (ng) body.guidance = ng;
  const np = mathifyField(q.passage);
  if (np) body.passage = np;
  const no = mathifyOptions(q.options);
  if (no) body.options = no;

  if (!Object.keys(body).length) continue;

  const putRes = await fetch(`${base}/api/admin/questions/${q.id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Admin-Key": adminKey,
    },
    body: JSON.stringify(body),
  });
  if (!putRes.ok) {
    console.error(`Failed ${q.id}:`, await putRes.text());
    continue;
  }
  updated++;
  if (updated <= 5 || updated % 25 === 0) {
    console.log(`  updated ${q.id}: ${String(body.question ?? q.question).slice(0, 80)}…`);
  }
}

console.log(`Done. Updated ${updated} question(s).`);
