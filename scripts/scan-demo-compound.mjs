import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const raw = readFileSync(resolve(".dev.vars"), "utf8");
const m = raw.match(/^DATABASE_URL=(.+)$/m);
const sql = neon(m[1].trim());

const rows = await sql`
  SELECT id, type, question, accepted_answers, answer_parts_json, marks, guidance
  FROM custom_questions
  WHERE subject_id = 'demo'
  ORDER BY id
`;

function needsSplit(r) {
  const parts = r.answer_parts_json ? JSON.parse(r.answer_parts_json) : [];
  if (parts.length >= 2) return false;
  const q = r.question ?? "";
  const acc = r.accepted_answers ? JSON.parse(r.accepted_answers) : [];

  if (/find\s+\$?f''?\(x\)\$?\s+and\s+evaluate/i.test(q)) return true;
  if (/simplify the function and state/i.test(q)) return true;
  if (/feel stressed.*and provide.*confidence/i.test(q)) return true;
  if (/simultaneous equations/i.test(q) && acc.length === 1 && /;/.test(acc[0])) return true;
  if (/local maximum or minimum/i.test(q)) return true;
  if (acc.length >= 2 && !/see marking guide/i.test(acc.join(" "))) return true;
  return false;
}

for (const r of rows) {
  if (!needsSplit(r)) continue;
  console.log(r.id, r.type);
  console.log(" Q:", r.question?.slice(0, 160));
  console.log(" A:", r.accepted_answers);
}
