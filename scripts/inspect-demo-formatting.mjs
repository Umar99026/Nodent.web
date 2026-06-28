import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const raw = readFileSync(resolve(".dev.vars"), "utf8");
const sql = neon(raw.match(/^DATABASE_URL=(.+)$/m)[1].trim().replace(/^["']|["']$/g, ""));

const rows = await sql`
  SELECT id, topic, question, answer_parts_json
  FROM custom_questions
  WHERE LOWER(TRIM(subject_id))='demo'
  ORDER BY id
`;
for (const r of rows) {
  const issues = [];
  if (/\*\*/.test(r.question)) issues.push("markdown-bold");
  if (/\\\\text\{/.test(r.question) && !/\$/.test(r.question)) issues.push("text-outside-math");
  if (r.question.includes("**")) issues.push("asterisk-bold");
  const parts = r.answer_parts_json ? JSON.parse(r.answer_parts_json) : [];
  for (const p of parts) {
    if (p.label?.includes("**")) issues.push("part-bold");
  }
  console.log(`[${r.id}] ${issues.join(", ") || "ok"} | ${r.topic}`);
  if (issues.length) {
    console.log(`  Q: ${r.question.slice(0, 120)}...`);
    for (const p of parts) console.log(`  ${p.key}: ${p.label?.slice(0, 100)}`);
  }
}
