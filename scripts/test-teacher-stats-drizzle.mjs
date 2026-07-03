import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(resolve(__dirname, "../.dev.vars"), "utf8");
const url = raw.match(/DATABASE_URL=(.+)/)[1].trim();
const db = drizzle(neon(url));

const admin = await db.execute(sql`SELECT id FROM users WHERE lower(email) = 'nodent.app@gmail.com' LIMIT 1`);
const cls = await db.execute(sql`SELECT id FROM teacher_classes WHERE teacher_id = ${admin.rows[0].id}`);
const classId = cls.rows[0].id;
const members = await db.execute(sql`SELECT user_id FROM class_members WHERE class_id = ${classId}`);
const memberIds = members.rows.map((r) => Number(r.user_id));

const t0 = Date.now();
function sqlIntInList(ids) {
  if (!ids.length) return sql`-1`;
  return sql.join(ids.map((id) => sql`${id}`), sql`, `);
}

const topicRows = await db.execute(sql`
  SELECT qa.topic, qa.subject_id,
         SUM(COALESCE(qa.marks_earned, CASE WHEN qa.is_correct = 1 THEN qa.marks ELSE 0 END))::int AS marks_correct,
         SUM(qa.marks)::int AS marks_attempted,
         COUNT(DISTINCT qa.user_id)::int AS students_attempted
  FROM question_attempts qa
  WHERE qa.user_id IN (${sqlIntInList(memberIds)})
  GROUP BY qa.topic, qa.subject_id
  HAVING SUM(qa.marks) > 0
`);
console.log("drizzle IN ok", topicRows.rows.length, "ms", Date.now() - t0);
