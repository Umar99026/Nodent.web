import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const raw = readFileSync(resolve(".dev.vars"), "utf8");
const m = raw.match(/^DATABASE_URL=(.+)$/m);
const sql = neon(m[1].trim());

const rows = await sql`
  SELECT id, question, options, guidance, accepted_answers
  FROM custom_questions
  WHERE subject_id = 'specialist-maths'
  ORDER BY id
`;

const patterns = [
  { name: "bare cis", re: /(?<!\\operatorname\{)(?<![A-Za-z])cis\s*\(/ },
  { name: "frac\\pi", re: /\\frac\\pi/ },
  { name: "Re(z", re: /(?<!\\operatorname\{)(?<![A-Za-z])Re\s*\(/ },
  { name: "Im(z", re: /(?<!\\operatorname\{)(?<![A-Za-z])Im\s*\(/ },
  { name: "double backslash log", re: /\\\\log/ },
  { name: "log_e", re: /log_e/ },
  { name: "hat space", re: /\\hat\s+[A-Za-z]/ },
];

let hits = 0;
for (const row of rows) {
  const fields = [
    ["question", row.question],
    ["guidance", row.guidance],
    ["options", row.options],
    ["accepted", row.accepted_answers],
  ];
  for (const [field, val] of fields) {
    if (!val) continue;
    const text = String(val);
    for (const p of patterns) {
      if (p.re.test(text)) {
        console.log(`${row.id} [${field}] ${p.name}:`, text.slice(0, 120));
        hits++;
        break;
      }
    }
  }
}
console.log(`\nTotal rows: ${rows.length}, hits: ${hits}`);

const reRows = await sql`
  SELECT id, question FROM custom_questions
  WHERE subject_id = 'specialist-maths'
    AND (question ILIKE '%Re(%' OR question ILIKE '%cis(%' OR question ILIKE '%8.800%')
  ORDER BY id
`;
console.log("\nRe/cis questions:");
for (const r of reRows) console.log(r.id, r.question);
