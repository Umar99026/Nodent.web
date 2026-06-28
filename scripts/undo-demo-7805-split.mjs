/**
 * Undo the 7805 split: merge oyster exam parts back into one question and
 * delete rows 7812–7815.
 *
 *   node scripts/undo-demo-7805-split.mjs           # dry-run
 *   node scripts/undo-demo-7805-split.mjs --apply
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

const sql = neon(loadDatabaseUrl());

const MERGE_INTO_ID = 7805;
const DELETE_IDS = [7812, 7813, 7814, 7815];

/** Reconstruct the pre-split single-row oyster question from split data. */
const MERGED = {
  question: "See figure.",
  type: "long_answer",
  marks: 13,
  acceptedAnswers: [
    "2",
    "11.42",
    "14.1",
    "volume",
    "9.53",
    "$\\text{volume}=0.002857+2.571\\times\\text{image size}$",
    "mean $=4.4$; standard deviation $=0.1$",
  ],
  parts: [
    {
      key: "a",
      label: "Write down the number of categorical variables in Table 1.",
      marks: 1,
    },
    {
      key: "i",
      label: "i. the mean weight of all the oysters in this sample",
      marks: 2,
    },
    {
      key: "ii",
      label: "ii. the median weight of the large oysters in this sample.",
      marks: 2,
    },
    {
      key: "i",
      label: "i. Name the response variable in this equation.",
      marks: 2,
    },
    {
      key: "ii",
      label:
        "ii. Complete the following sentence by filling in the box provided: This equation predicts that, on average, each 10 g increase in the weight of an oyster is associated with a $\\square\\;cm^3$ increase in its volume.",
      marks: 2,
    },
    {
      key: "d",
      label:
        "Determine the equation of this least squares line. Use the template below to write your answer. Round the values of the intercept and slope to four significant figures.",
      marks: 2,
    },
    {
      key: "e",
      label:
        "Use the 68-95-99.7% rule to determine, in megapixels, the mean and standard deviation of this normal distribution.",
      marks: 2,
    },
  ],
};

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

const [target] = await sql`SELECT id, passage, guidance FROM custom_questions WHERE id = ${MERGE_INTO_ID}`;
if (!target) {
  console.error("Row", MERGE_INTO_ID, "not found.");
  process.exit(1);
}

const splitRows = await sql`
  SELECT id FROM custom_questions WHERE id = ANY(${DELETE_IDS})
`;
console.log(`Merge ${MERGED.parts.length} parts back into id ${MERGE_INTO_ID}`);
console.log(`Delete split rows: ${splitRows.map((r) => r.id).join(", ") || "(none found)"}`);

if (!APPLY) {
  console.log("Dry run — pass --apply to update database.");
  process.exit(0);
}

await sql`
  UPDATE custom_questions
  SET question = ${MERGED.question},
      type = ${MERGED.type},
      marks = ${MERGED.marks},
      accepted_answers = ${JSON.stringify(MERGED.acceptedAnswers)},
      answer_parts_json = ${toAnswerPartsJson(MERGED.parts)}
  WHERE id = ${MERGE_INTO_ID}
`;

if (splitRows.length) {
  await sql`DELETE FROM custom_questions WHERE id = ANY(${DELETE_IDS})`;
}

const count = await sql`SELECT COUNT(*)::int AS n FROM custom_questions WHERE LOWER(TRIM(subject_id))='demo'`;
console.log("Undo complete. Demo question count:", count[0].n);
