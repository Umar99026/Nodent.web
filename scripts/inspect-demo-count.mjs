import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const raw = readFileSync(resolve(".dev.vars"), "utf8");
const sql = neon(raw.match(/^DATABASE_URL=(.+)$/m)[1].trim());

const total = await sql`SELECT COUNT(*)::int AS n FROM custom_questions WHERE LOWER(TRIM(subject_id))='demo'`;
const byTopic = await sql`
  SELECT topic, COUNT(*)::int AS n,
         SUM(CASE WHEN answer_parts_json IS NOT NULL THEN 1 ELSE 0 END)::int AS multipart,
         SUM(CASE WHEN type='mcq' THEN 1 ELSE 0 END)::int AS mcq,
         SUM(CASE WHEN ai_marking_enabled=1 THEN 1 ELSE 0 END)::int AS ai
  FROM custom_questions WHERE LOWER(TRIM(subject_id))='demo'
  GROUP BY topic ORDER BY topic
`;
console.log("Demo total:", total[0].n);
console.log("\nBy topic:");
for (const r of byTopic) console.log(`  ${r.topic}: ${r.n} (multipart=${r.multipart}, mcq=${r.mcq}, ai=${r.ai})`);

const sample = await sql`
  SELECT id, type, topic, LEFT(question,70) AS q, ai_marking_enabled
  FROM custom_questions WHERE LOWER(TRIM(subject_id))='demo'
  ORDER BY id DESC LIMIT 5
`;
console.log("\nLatest 5:");
for (const r of sample) console.log(r.id, r.type, r.topic, "ai="+r.ai_marking_enabled, r.q);
