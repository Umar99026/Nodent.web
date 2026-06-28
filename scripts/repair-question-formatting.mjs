/**
 * Repair stored question stems + multipart labels in custom_questions.
 *
 *   node scripts/repair-question-formatting.mjs           # dry-run
 *   node scripts/repair-question-formatting.mjs --apply
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const APPLY = process.argv.includes("--apply");

function loadDatabaseUrl() {
  const raw = readFileSync(".dev.vars", "utf8");
  const m = raw.match(/^DATABASE_URL=(.+)$/m);
  if (!m?.[1]) throw new Error("DATABASE_URL missing in .dev.vars");
  return m[1].trim();
}

function isRomanPartKey(key) {
  return /^(?:i{1,3}|iv)$/i.test(String(key ?? "").trim());
}

function stripRomanPartPrefix(label) {
  let out = String(label ?? "").trim();
  out = out.replace(/^([a-z])\.(?:i{1,3}|iv)\.\s*/i, "$1. ");
  out = out.replace(/^(?:i{1,3}|iv)\.\s*/i, "");
  return out.trim();
}

function stripMainPartPrefix(label) {
  let out = stripRomanPartPrefix(String(label ?? "").trim());
  if (!out) return "";
  out = out.replace(/^(?:[a-z])\s*[).:\-–—]\s*/i, "");
  return out.trim();
}

function normalizePartKey(key, index) {
  const k = String(key ?? "").trim().toLowerCase();
  if (/^[a-z]$/.test(k) && !isRomanPartKey(k)) return k;
  if (isRomanPartKey(k)) return k;
  const m = k.match(/^part(\d+)$/i);
  if (m?.[1]) {
    const n = Number(m[1]);
    if (Number.isFinite(n) && n >= 1 && n <= 26) {
      return String.fromCharCode(96 + n);
    }
  }
  return String.fromCharCode(97 + (index % 26));
}

function formatPartDescriptor(letter, label) {
  const L = letter.trim().toLowerCase();
  const clean = stripMainPartPrefix(label);
  const suffix = isRomanPartKey(L) ? "." : ")";
  if (!clean || /^answer$/i.test(clean)) return `${L}${suffix}`;
  return `${L}${suffix} ${clean}`;
}

function repairCommonMathGlitches(text) {
  let out = String(text ?? "");
  out = out.replace(/\(\s*\\?\$\s*,\s*/g, "(in dollars, ");
  out = out.replace(/\$([0-9][0-9,]*(?:\.\d+)?)(?=\s+[A-Za-z])/g, "$$$1$");
  out = out.replace(
    /\b(?:then|hence)\s+\$([A-Za-z][A-Za-z0-9_]*)\s*=\s*\$/g,
    (_m, v) => `find $${v}$.`,
  );
  out = out.replace(
    /\b(?:find|determine|calculate|compute|evaluate)\s+\$([A-Za-z][A-Za-z0-9_]*)\s*=\s*$/gi,
    (_m, v) => `find $${v}$.`,
  );
  out = out.replace(
    /\$([A-Za-z][A-Za-z0-9_]*)\s*=\s*\$(?!\s*\?)/g,
    (_m, v) => `find $${v}$.`,
  );
  out = out.replace(/\$([A-Za-z][A-Za-z0-9_]*)\s*=\s*$/g, (_m, v) => `find $${v}$.`);
  return out;
}

function repairQuestionText(text) {
  let out = repairCommonMathGlitches(String(text ?? "").trim());
  out = out.replace(/\$\\?\$([0-9][0-9,\\{}]*)\$/g, (_, raw) => {
    const n = raw.replace(/\\,/g, ",").replace(/\{,\}/g, ",").replace(/[{}\\]/g, "");
    return `$${n}`;
  });
  out = out.replace(/\$([0-9]+(?:\.[0-9]+)?)\s*\\?%\s*\$/g, "$1%");
  out = out.replace(/p\.a\.compoundedannually/gi, "p.a. compounded annually");
  out = out.replace(/compoundedannually/gi, "compounded annually");
  out = out.replace(/earns(\d)/gi, "earns $1");
  return out;
}

function repairParts(parts) {
  if (!Array.isArray(parts) || !parts.length) return parts;
  return parts.map((p, idx) => {
    const key = normalizePartKey(p.key, idx);
    const base = repairQuestionText(p.label ?? "");
    const label = base
      ? formatPartDescriptor(key, base)
      : `${key}${isRomanPartKey(key) ? "." : ")"}`;
    return { ...p, key, label };
  });
}

const sql = neon(loadDatabaseUrl());
const rows = await sql`
  SELECT id, subject_id, question, answer_parts_json
  FROM custom_questions
  ORDER BY id
`;

let changed = 0;

for (const row of rows) {
  const nextQuestion = repairQuestionText(row.question);
  let parts = [];
  try {
    parts = row.answer_parts_json ? JSON.parse(row.answer_parts_json) : [];
  } catch {
    parts = [];
  }
  const nextParts = repairParts(parts);
  const nextPartsJson = nextParts.length ? JSON.stringify(nextParts) : null;

  const questionChanged = nextQuestion !== String(row.question ?? "");
  const partsChanged =
    nextPartsJson !== (row.answer_parts_json ? String(row.answer_parts_json) : null);

  if (!questionChanged && !partsChanged) continue;
  changed++;
  console.log(
    `#${row.id} [${row.subject_id}]`,
    questionChanged ? "stem" : "",
    partsChanged ? `parts(${nextParts.length})` : "",
  );

  if (!APPLY) continue;

  await sql`
    UPDATE custom_questions
    SET question = ${nextQuestion},
        answer_parts_json = ${nextPartsJson}
    WHERE id = ${row.id}
  `;
}

console.log(
  APPLY
    ? `Updated ${changed} question(s).`
    : `Would update ${changed} question(s). Pass --apply to write.`,
);
