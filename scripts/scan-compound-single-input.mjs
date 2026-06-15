import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const raw = readFileSync(resolve(".dev.vars"), "utf8");
const m = raw.match(/^DATABASE_URL=(.+)$/m);
const sql = neon(m[1].trim());

const rows = await sql`
  SELECT id, subject_id, type, question, accepted_answers, answer_parts_json, marks
  FROM custom_questions
  WHERE type IN ('short_answer', 'long_answer')
    AND (answer_parts_json IS NULL OR answer_parts_json = '[]' OR answer_parts_json = 'null')
  ORDER BY id
`;

const compoundStem =
  /\b(find|determine|calculate|evaluate|simplify|solve|state|estimate|provide)\b[^.]{0,120}\band\b[^.]{0,120}\b(find|determine|calculate|evaluate|simplify|solve|state|estimate|provide|restrictions|interval|proportion|value|domain)\b/i;

const hits = [];
for (const r of rows) {
  const acc = r.accepted_answers ? JSON.parse(r.accepted_answers) : [];
  const multiAcc =
    acc.length >= 2 &&
    acc.some((a) => /;/.test(String(a))) === false &&
    acc.every((a) => String(a).trim().length > 0);
  const stemHit = compoundStem.test(r.question ?? "");
  if (stemHit || multiAcc) {
    hits.push({ ...r, accepted: acc, reason: stemHit ? "compound stem" : "multiple acceptedAnswers" });
  }
}

console.log("Found", hits.length);
for (const h of hits) {
  console.log("---", h.id, h.subject_id, h.type, `(${h.reason})`);
  console.log(h.question?.slice(0, 180));
  console.log("acc:", h.accepted);
}
