/**
 * Fix questions that ask students to create tables/graphs/diagrams
 * (impossible in plain-text answer fields).
 *
 *   node scripts/fix-impossible-question-tasks.mjs           # dry-run
 *   node scripts/fix-impossible-question-tasks.mjs --apply
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
    match: (q) =>
      /construct the probability distribution table/i.test(q.question) ||
      /construct the probability distribution table/i.test(q.answer_parts_json ?? ""),
    apply: () => ({
      question:
        "In a game, a player rolls two six-sided dice. Let the random variable $X$ represent the sum of the numbers shown on the two dice.",
      accepted_answers: JSON.stringify([
        "$P(X=7)=\\frac{6}{36}=\\frac{1}{6}$",
        "$E(X)=7$",
      ]),
      answer_parts_json: JSON.stringify([
        {
          key: "a",
          label: "a) Find $P(X=7)$.",
          marks: 2,
          acceptedAnswer: "$P(X=7)=\\frac{6}{36}=\\frac{1}{6}$",
          placeholder: "Type your answer…",
        },
        {
          key: "b",
          label: "b) Calculate the expected value $E(X)$.",
          marks: 1,
          acceptedAnswer: "$E(X)=7$",
          placeholder: "Type your answer…",
        },
      ]),
      guidance:
        "Part a) count outcomes with sum 7. Part b) use $E(X)=\\sum x\\cdot P(X=x)$ or symmetry.",
      ai_marking_enabled: 0,
    }),
  },
  {
    match: (q) =>
      /construct a 95% confidence interval/i.test(q.answer_parts_json ?? "") &&
      /public transport initiative/i.test(q.question),
    apply: () => ({
      answer_parts_json: JSON.stringify([
        {
          key: "a",
          label:
            "a) Calculate the sample proportion of adults who support the initiative.",
          marks: 2,
          acceptedAnswer: "$0.6$; $60\\%$",
          placeholder: "Type your answer…",
        },
        {
          key: "b",
          label:
            "b) Calculate the 95% confidence interval for the proportion of adults who support the initiative using $z=1.96$.",
          marks: 2,
          acceptedAnswer: "$\\pm 0.067$; $[0.533, 0.667]$",
          placeholder: "Type your answer…",
        },
      ]),
    }),
  },
];

const rows = await sql`
  SELECT id, subject_id, question, guidance, accepted_answers, answer_parts_json, ai_marking_enabled
  FROM custom_questions
  ORDER BY id
`;

let updated = 0;
for (const row of rows) {
  for (const fix of FIXES) {
    if (!fix.match(row)) continue;
    const patch = fix.apply(row);
    console.log(`[fix] id=${row.id} subject=${row.subject_id}`);
    console.log("  was:", row.question.slice(0, 120));
    if (APPLY) {
      await sql`
        UPDATE custom_questions
        SET
          question = COALESCE(${patch.question ?? null}, question),
          guidance = COALESCE(${patch.guidance ?? null}, guidance),
          accepted_answers = COALESCE(${patch.accepted_answers ?? null}, accepted_answers),
          answer_parts_json = COALESCE(${patch.answer_parts_json ?? null}, answer_parts_json),
          ai_marking_enabled = COALESCE(${patch.ai_marking_enabled ?? null}, ai_marking_enabled)
        WHERE id = ${row.id}
      `;
      console.log("  applied");
    } else {
      console.log("  would apply patch keys:", Object.keys(patch).join(", "));
    }
    updated++;
    break;
  }
}

console.log(APPLY ? `Updated ${updated} question(s).` : `Would update ${updated} question(s). Run with --apply.`);
