/**
 * Audit custom question formatting across subjects.
 *   node scripts/_audit-question-format.mjs [subjectId]
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const subjectFilter = process.argv[2]?.trim().toLowerCase();

function loadDatabaseUrl() {
  const raw = readFileSync(".dev.vars", "utf8");
  const m = raw.match(/^DATABASE_URL=(.+)$/m);
  if (!m?.[1]) throw new Error("DATABASE_URL missing in .dev.vars");
  return m[1].trim();
}

const sql = neon(loadDatabaseUrl());

const rows = subjectFilter
  ? await sql`
      SELECT id, subject_id, question, answer_parts_json, accepted_answers, type
      FROM custom_questions
      WHERE LOWER(TRIM(subject_id)) = ${subjectFilter}
      ORDER BY id
    `
  : await sql`
      SELECT id, subject_id, question, answer_parts_json, accepted_answers, type
      FROM custom_questions
      ORDER BY subject_id, id
    `;

let issueCount = 0;

function report(id, subject, kind, detail) {
  issueCount++;
  console.log(`[${subject} #${id}] ${kind}: ${detail}`);
}

for (const r of rows) {
  const subject = String(r.subject_id ?? "").trim().toLowerCase();
  const q = String(r.question ?? "");
  let parts = [];
  try {
    parts = r.answer_parts_json ? JSON.parse(r.answer_parts_json) : [];
  } catch {
    report(r.id, subject, "bad-json", "answer_parts_json parse failed");
    continue;
  }

  const dollars = (q.match(/(?<!\\)\$/g) || []).length;
  if (dollars % 2 === 1) report(r.id, subject, "odd-math", `stem has ${dollars} dollar signs`);
  if (/\$[A-Za-z][A-Za-z0-9_]*\s*=\s*\$?\s*$/i.test(q.trim())) {
    report(r.id, subject, "broken-math", "stem ends with dangling formula");
  }

  if (!Array.isArray(parts)) continue;

  if (parts.length >= 2) {
    if (/(?:^|\n)\s*[a-z]\)\s/i.test(q)) {
      report(r.id, subject, "stem-has-parts", q.slice(0, 80).replace(/\s+/g, " "));
    }
    const keys = parts.map((p) => String(p.key ?? "").toLowerCase());
    if (new Set(keys).size < keys.length) {
      report(r.id, subject, "dup-keys", keys.join(", "));
    }
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const k = String(p.key ?? "").toLowerCase();
      const l = String(p.label ?? "");
      const isRoman = /^(?:i{1,3}|iv)$/.test(k);
      if (!l.trim()) report(r.id, subject, "empty-label", `part ${k || i}`);
      if (isRoman && /^a\)\s/i.test(l)) {
        report(r.id, subject, "roman-wrong-label", `${k}: ${l.slice(0, 50)}`);
      }
      if (!isRoman && /^[a-z]$/.test(k) && l.trim() && !/^[a-z]\)/i.test(l) && !/^[a-z]\./i.test(l)) {
        report(r.id, subject, "missing-letter-prefix", `${k}: ${l.slice(0, 50)}`);
      }
      const ld = (l.match(/(?<!\\)\$/g) || []).length;
      if (ld % 2 === 1) report(r.id, subject, "odd-math-label", `${k}: ${l.slice(0, 60)}`);
    }
    const accepted = Array.isArray(r.accepted_answers)
      ? r.accepted_answers
      : typeof r.accepted_answers === "string"
        ? (() => {
            try {
              return JSON.parse(r.accepted_answers);
            } catch {
              return [];
            }
          })()
        : [];
    if (accepted.length && accepted.length !== parts.length) {
      report(
        r.id,
        subject,
        "answer-count",
        `${accepted.length} accepted vs ${parts.length} parts`,
      );
    }
  }
}

console.log(`\nAudited ${rows.length} rows, ${issueCount} issue(s).`);
