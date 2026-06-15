/**
 * Split compound single-input questions into multipart answerParts.
 *
 *   node scripts/fix-compound-single-input.mjs           # dry-run
 *   node scripts/fix-compound-single-input.mjs --apply
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const APPLY = process.argv.includes("--apply");

const raw = readFileSync(resolve(".dev.vars"), "utf8");
const m = raw.match(/^DATABASE_URL=(.+)$/m);
const sql = neon(m[1].trim());

const FIXES = [
  {
    match: (q) => /find\s+\$?f''?\(x\)\$?\s+and\s+evaluate/i.test(q.question),
    apply: () => ({
      type: "long_answer",
      question: "For the function $f(x) = 3x^4 - 8x^3 + 6$,",
      accepted_answers: JSON.stringify([
        "$f''(x) = 36x^2 - 48x$",
        "$f''(1) = -12$",
      ]),
      answer_parts_json: JSON.stringify([
        {
          key: "a",
          label: "a) Find $f''(x)$.",
          marks: 1,
          acceptedAnswer: "$f''(x) = 36x^2 - 48x$",
          placeholder: "Type your answer…",
        },
        {
          key: "b",
          label: "b) Evaluate $f''(x)$ at $x = 1$.",
          marks: 1,
          acceptedAnswer: "$f''(1) = -12$",
          placeholder: "Type your answer…",
        },
      ]),
      guidance: "Differentiate twice, then substitute $x=1$ into $f''(x)$.",
      ai_marking_enabled: 0,
      marks: 2,
    }),
  },
  {
    match: (q) => /simplify the function and state any restrictions on the domain/i.test(q.question),
    apply: () => ({
      type: "long_answer",
      question: "For the function $g(x) = \\frac{x^2 - 1}{x - 1}$,",
      accepted_answers: JSON.stringify(["$g(x) = x + 1$", "$x \\neq 1$"]),
      answer_parts_json: JSON.stringify([
        {
          key: "a",
          label: "a) Simplify $g(x)$.",
          marks: 1,
          acceptedAnswer: "$g(x) = x + 1$",
          placeholder: "Type your answer…",
        },
        {
          key: "b",
          label: "b) State any restrictions on the domain.",
          marks: 1,
          acceptedAnswer: "$x \\neq 1$",
          placeholder: "Type your answer…",
        },
      ]),
      guidance: "Factor and simplify, then state where the original function is undefined.",
      ai_marking_enabled: 0,
      marks: 2,
    }),
  },
  {
    match: (q) => /Solve the simultaneous equations:\s*\$3x \+ 4y = 24\$/i.test(q.question),
    apply: () => ({
      type: "long_answer",
      accepted_answers: JSON.stringify(["$x=2$", "$y=3$"]),
      answer_parts_json: JSON.stringify([
        {
          key: "a",
          label: "a) Find $x$.",
          marks: 2,
          acceptedAnswer: "$x=2$",
          placeholder: "Type your answer…",
        },
        {
          key: "b",
          label: "b) Find $y$.",
          marks: 1,
          acceptedAnswer: "$y=3$",
          placeholder: "Type your answer…",
        },
      ]),
      ai_marking_enabled: 0,
      marks: 3,
    }),
  },
  {
    match: (q) => /local maximum or minimum values of the function \$f\(x\) = -2x/i.test(q.question),
    apply: () => ({
      type: "long_answer",
      question: "Consider the function $f(x) = -2x^2 + 4x + 1$.",
      accepted_answers: JSON.stringify(["$x = 1$", "$f(1) = 3$"]),
      answer_parts_json: JSON.stringify([
        {
          key: "a",
          label: "a) Find the $x$-value at which the local maximum occurs.",
          marks: 1,
          acceptedAnswer: "$x = 1$",
          placeholder: "Type your answer…",
        },
        {
          key: "b",
          label: "b) Find the maximum value of $f(x)$.",
          marks: 1,
          acceptedAnswer: "$f(1) = 3$",
          placeholder: "Type your answer…",
        },
      ]),
      guidance: "Use the first derivative test to identify the local maximum.",
      ai_marking_enabled: 0,
      marks: 2,
    }),
  },
  {
    match: (q) =>
      /felt stressed during exams/i.test(q.question) &&
      /provide a 90% confidence interval/i.test(q.question),
    apply: () => ({
      type: "long_answer",
      question:
        "In a random sample of 150 students, 45 reported that they felt stressed during exams.",
      accepted_answers: JSON.stringify(["$0.30$; $30\\%$", "$[0.25, 0.35]$"]),
      answer_parts_json: JSON.stringify([
        {
          key: "a",
          label:
            "a) Estimate the proportion of all students who feel stressed during exams.",
          marks: 1,
          acceptedAnswer: "$0.30$; $30\\%$",
          placeholder: "Type your answer…",
        },
        {
          key: "b",
          label: "b) Provide a 90% confidence interval for this estimate.",
          marks: 2,
          acceptedAnswer: "$[0.25, 0.35]$",
          placeholder: "Type your answer…",
        },
      ]),
      guidance: "Calculate the sample proportion, then the 90% confidence interval.",
      ai_marking_enabled: 0,
      marks: 3,
    }),
  },
];

const rows = await sql`
  SELECT id, subject_id, type, question, accepted_answers, answer_parts_json, guidance, marks, ai_marking_enabled
  FROM custom_questions
  ORDER BY id
`;

let updated = 0;
for (const row of rows) {
  const parts = row.answer_parts_json ? JSON.parse(row.answer_parts_json) : [];
  if (parts.length >= 2) continue;

  for (const fix of FIXES) {
    if (!fix.match(row)) continue;
    const patch = fix.apply(row);
    console.log(`[fix] id=${row.id} subject=${row.subject_id}`);
    console.log("  was:", row.question.slice(0, 120));
    if (APPLY) {
      await sql`
        UPDATE custom_questions
        SET
          type = COALESCE(${patch.type ?? null}, type),
          question = COALESCE(${patch.question ?? null}, question),
          guidance = COALESCE(${patch.guidance ?? null}, guidance),
          marks = COALESCE(${patch.marks ?? null}, marks),
          accepted_answers = COALESCE(${patch.accepted_answers ?? null}, accepted_answers),
          answer_parts_json = COALESCE(${patch.answer_parts_json ?? null}, answer_parts_json),
          ai_marking_enabled = COALESCE(${patch.ai_marking_enabled ?? null}, ai_marking_enabled)
        WHERE id = ${row.id}
      `;
      console.log("  applied");
    } else {
      console.log("  would apply:", Object.keys(patch).join(", "));
    }
    updated++;
    break;
  }
}

console.log(APPLY ? `Updated ${updated} question(s).` : `Would update ${updated} question(s). Run with --apply.`);
