/**
 * Apply normalizeQuestionMathText to every custom_questions text field.
 *
 *   cd frontend && npx tsx ../scripts/repair-all-question-math.mjs           # dry-run
 *   cd frontend && npx tsx ../scripts/repair-all-question-math.mjs --apply
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { neon } from "@neondatabase/serverless";

const APPLY = process.argv.includes("--apply");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function stemKey(subjectId, question) {
  return `${String(subjectId ?? "").trim().toLowerCase()}\0${String(question ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()}`;
}

const { normalizeQuestionMathText } = await import(
  pathToFileURL(resolve(root, "frontend/src/lib/questionMathText.ts")).href
);
const { formatPartDescriptor } = await import(
  pathToFileURL(resolve(root, "frontend/src/lib/questionDisplay.ts")).href
);

function loadDatabaseUrl() {
  const raw = readFileSync(resolve(root, ".dev.vars"), "utf8");
  const m = raw.match(/^DATABASE_URL=(.+)$/m);
  if (!m?.[1]) throw new Error("DATABASE_URL missing in .dev.vars");
  return m[1].trim();
}

function normField(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return raw;
  return normalizeQuestionMathText(raw);
}

function normOptions(json) {
  if (!json) return { next: null, changed: false };
  let opts;
  try {
    opts = JSON.parse(json);
  } catch {
    return { next: json, changed: false };
  }
  if (!Array.isArray(opts)) return { next: json, changed: false };
  let changed = false;
  const next = opts.map((o) => {
    const n = normField(o);
    if (n !== String(o ?? "")) changed = true;
    return n;
  });
  return { next: changed ? JSON.stringify(next) : json, changed };
}

function normParts(json) {
  if (!json) return { next: null, changed: false };
  let parts;
  try {
    parts = JSON.parse(json);
  } catch {
    return { next: json, changed: false };
  }
  if (!Array.isArray(parts) || !parts.length) return { next: json, changed: false };
  let changed = false;
  const next = parts.map((p, idx) => {
    const key = String(p.key ?? String.fromCharCode(97 + (idx % 26))).toLowerCase();
    const base = normField(p.label ?? "");
    const label = base ? formatPartDescriptor(key, base) : p.label;
    if (label !== p.label || base !== String(p.label ?? "").trim()) changed = true;
    return { ...p, key, label };
  });
  return { next: changed ? JSON.stringify(next) : json, changed };
}

const sql = neon(loadDatabaseUrl());
const rows = await sql`
  SELECT id, subject_id, question, passage, guidance, options, answer_parts_json
  FROM custom_questions
  ORDER BY id
`;

const stemIndex = new Map();
for (const row of rows) {
  const key = stemKey(row.subject_id, row.question);
  if (!stemIndex.has(key)) stemIndex.set(key, row.id);
}

let changed = 0;
let skipped = 0;

for (const row of rows) {
  const nextQuestion = normField(row.question);
  const nextPassage = row.passage ? normField(row.passage) : null;
  const nextGuidance = row.guidance ? normField(row.guidance) : null;
  const { next: nextOptions, changed: optionsChanged } = normOptions(row.options);
  const { next: nextParts, changed: partsChanged } = normParts(row.answer_parts_json);

  const questionChanged = nextQuestion !== String(row.question ?? "").trim();
  const passageChanged = row.passage && nextPassage !== String(row.passage ?? "").trim();
  const guidanceChanged = row.guidance && nextGuidance !== String(row.guidance ?? "").trim();

  if (!questionChanged && !passageChanged && !guidanceChanged && !optionsChanged && !partsChanged) {
    continue;
  }

  let finalQuestion = nextQuestion;
  if (questionChanged) {
    const oldKey = stemKey(row.subject_id, row.question);
    const newKey = stemKey(row.subject_id, nextQuestion);
    const conflict = stemIndex.get(newKey);
    if (conflict && conflict !== row.id) {
      skipped++;
      finalQuestion = String(row.question ?? "").trim();
      console.log(`#${row.id} [${row.subject_id}] SKIP stem (duplicate of #${conflict})`);
    } else {
      stemIndex.delete(oldKey);
      stemIndex.set(newKey, row.id);
    }
  }

  const willUpdateQuestion = finalQuestion !== String(row.question ?? "").trim();
  if (!willUpdateQuestion && !passageChanged && !guidanceChanged && !optionsChanged && !partsChanged) {
    continue;
  }

  changed++;
  const bits = [];
  if (willUpdateQuestion) bits.push("stem");
  if (passageChanged) bits.push("passage");
  if (guidanceChanged) bits.push("guidance");
  if (optionsChanged) bits.push("options");
  if (partsChanged) bits.push("parts");

  console.log(`#${row.id} [${row.subject_id}] ${bits.join(", ")}`);
  if (willUpdateQuestion) {
    console.log(`  was: ${String(row.question).slice(0, 100)}`);
    console.log(`  now: ${finalQuestion.slice(0, 100)}`);
  }

  if (!APPLY) continue;

  await sql`
    UPDATE custom_questions
    SET question = ${finalQuestion},
        passage = ${passageChanged ? nextPassage : row.passage},
        guidance = ${guidanceChanged ? nextGuidance : row.guidance},
        options = ${optionsChanged ? nextOptions : row.options},
        answer_parts_json = ${partsChanged ? nextParts : row.answer_parts_json}
    WHERE id = ${row.id}
  `;
}

console.log(
  APPLY
    ? `Updated ${changed} question(s). Skipped ${skipped} duplicate stem(s).`
    : `Would update ${changed} question(s). Skipped ${skipped} duplicate stem(s). Pass --apply to write.`,
);
