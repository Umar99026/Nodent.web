/**
 * Fix demo questions where multipart part text was duplicated into question stem.
 *
 * Usage:
 *   node scripts/repair-demo-multipart-stems.mjs
 *   node scripts/repair-demo-multipart-stems.mjs --apply
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

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

function isBrokenMathStem(text) {
  const t = String(text ?? "").trim();
  if (!t) return false;
  if (/\$\s*$/.test(t)) return true;
  const dollars = (t.match(/(?<!\\)\$/g) ?? []).length;
  return dollars % 2 === 1;
}

function repairStem(question, answerParts) {
  const parts = Array.isArray(answerParts) ? answerParts : [];
  if (parts.length < 2) {
    const stem = String(question ?? "").trim();
    return isBrokenMathStem(stem) ? "" : stem;
  }

  let stem = String(question ?? "").trim();
  const firstPart = stem.search(/(?:^|\n)\s*(?:[a-z][.)]|[a-z]\.\s*i{1,3}\.)/i);
  if (firstPart < 0) stem = stem.trim();
  else if (firstPart === 0) stem = "";
  else stem = stem.slice(0, firstPart).trim();

  stem = stem
    .replace(/^(?:question|q)\s*\d{1,4}\s*[:.)-]?\s*/i, "")
    .replace(/^\d{1,4}\s*[a-z]?\s*[:.)-]\s*/i, "")
    .trim();

  if (/^question\s*\d*$/i.test(stem.replace(/\s+/g, " ").trim())) stem = "";
  if (isBrokenMathStem(stem)) stem = "";
  return stem;
}

const databaseUrl = loadDatabaseUrl();
if (!databaseUrl) {
  console.error("Missing DATABASE_URL");
  process.exit(1);
}

const sql = neon(databaseUrl);

const rows = await sql`
  SELECT id, question, answer_parts_json, image_urls
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id)) = 'demo'
  ORDER BY id
`;

let changed = 0;
for (const row of rows) {
  let parts = [];
  try {
    parts = row.answer_parts_json ? JSON.parse(row.answer_parts_json) : [];
  } catch {
    parts = [];
  }
  const next = repairStem(row.question, parts);
  const prev = String(row.question ?? "").trim();
  if (next === prev) continue;
  changed++;
  console.log(`\n[${row.id}]`);
  console.log("  BEFORE:", prev.slice(0, 120).replace(/\n/g, " "));
  console.log("  AFTER: ", next ? next.slice(0, 120).replace(/\n/g, " ") : "(empty — figure/stimulus only)");

  if (APPLY) {
    await sql`
      UPDATE custom_questions
      SET question = ${next}
      WHERE id = ${row.id}
    `;
  }
}

console.log(`\n${changed} question(s) ${APPLY ? "updated" : "would update"}.`);
if (!APPLY && changed) console.log("Pass --apply to write changes.");
