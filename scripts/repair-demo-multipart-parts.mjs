/**
 * Repair demo multipart rows with wrong roman labels (a) on i/ii parts).
 * Does NOT split or delete questions — display fixes handle merged rows.
 *
 *   node scripts/repair-demo-multipart-parts.mjs           # dry-run
 *   node scripts/repair-demo-multipart-parts.mjs --apply
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

function stripLetterPrefix(label) {
  let out = String(label ?? "").trim();
  while (/^(?:[a-z])\s*[).:\-–—]\s*/i.test(out)) {
    out = out.replace(/^(?:[a-z])\s*[).:\-–—]\s*/i, "").trim();
  }
  return out;
}

function romanLabel(key, label) {
  const k = key.toLowerCase();
  let clean = stripLetterPrefix(label);
  if (!/^(?:i{1,3}|iv)\.\s+/i.test(clean)) clean = `${k}. ${clean}`;
  return clean;
}

const sql = neon(loadDatabaseUrl());

/** Fix roman labels on an existing row (7807, 7809). */
const LABEL_FIXES = [
  {
    id: 7807,
    question:
      "Arthur takes out a new loan of \\$60000 to pay for an overseas holiday. Interest on this loan compounds weekly. The balance of the loan, in dollars, after $n$ weeks, $V_n$, can be determined using a recurrence relation of the form $V_0=60000$, $V_{n+1}=1.0015V_n-d$.",
    parts: [
      {
        key: "a",
        label: "Show that the interest rate for this loan is $7.8\\%$ per annum.",
        marks: 1,
        answer: "$(1.0015-1)\\times52\\times100\\%=7.8\\%$.",
      },
      {
        key: "i",
        label: romanLabel("i", "Determine the value of d in the recurrence relation if Arthur makes interest-only repayments"),
        marks: 2,
        answer: "d=90",
      },
      {
        key: "ii",
        label: romanLabel(
          "ii",
          "Determine the value of d in the recurrence relation if Arthur fully repays the loan in five years. Round your answer to the nearest cent.",
        ),
        marks: 2,
        answer: "d=278.86.",
      },
      {
        key: "c",
        label:
          "Arthur decides that the value of $d$ will be $300$ for the first year of repayments. If Arthur fully repays the loan with exactly three more years of repayments, what new value of $d$ will apply for these three years? Round your answer to the nearest cent.",
        marks: 1,
        answer: "$350.01$",
      },
      {
        key: "d",
        label: "For what value of $d$ does the recurrence relation generate a geometric sequence?",
        marks: 1,
        answer: "$d=0$",
      },
    ],
    acceptedAnswers: [
      "$(1.0015-1)\\times52\\times100\\%=7.8\\%$.",
      "d=90",
      "d=278.86.",
      "$350.01$",
      "$d=0$",
    ],
  },
  {
    id: 7809,
    question:
      "A country has five states, $A$, $B$, $C$, $D$ and $E$. A graph can be drawn with vertices to represent each of the states. Edges represent a border shared between two states.",
    parts: [
      {
        key: "a",
        label: "What is the sum of the degrees of the vertices of the graph above?",
        marks: 1,
        answer: "$14$",
      },
      {
        key: "i",
        label: romanLabel(
          "i",
          "Euler's formula, $v+f=e+2$, holds for this graph. Complete the formula by writing the appropriate numbers in the boxes provided below.",
        ),
        marks: 2,
        answer: "5+4=7+2",
      },
      {
        key: "ii",
        label: romanLabel(
          "ii",
          "Complete the sentence by writing the appropriate word in the box provided below: Euler's formula holds for this graph because the graph is connected and ______.",
        ),
        marks: 2,
        answer: "planar",
      },
    ],
    acceptedAnswers: ["$14$", "5+4=7+2", "planar"],
  },
];

function toAnswerPartsJson(parts) {
  return JSON.stringify(
    parts.map((p) => ({
      key: p.key,
      label: p.label,
      marks: p.marks,
      placeholder: "Type your answer…",
    })),
  );
}

async function applyLabelFix(row) {
  console.log(`Fix id ${row.id}: ${row.parts.length} parts`);
  if (!APPLY) return;
  await sql`
    UPDATE custom_questions
    SET question = ${row.question},
        answer_parts_json = ${toAnswerPartsJson(row.parts)},
        accepted_answers = ${JSON.stringify(row.acceptedAnswers)},
        marks = ${row.parts.reduce((s, p) => s + p.marks, 0)}
    WHERE id = ${row.id}
  `;
}

for (const fix of LABEL_FIXES) {
  await applyLabelFix(fix);
}

console.log(APPLY ? "Repair applied." : "Dry run — pass --apply to update database.");
