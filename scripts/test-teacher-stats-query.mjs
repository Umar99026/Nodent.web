import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(resolve(__dirname, "../.dev.vars"), "utf8");
const url = raw.match(/DATABASE_URL=(.+)/)[1].trim();
const sql = neon(url);

const admin = await sql`SELECT id FROM users WHERE lower(email) = 'nodent.app@gmail.com' LIMIT 1`;
const cls = await sql`SELECT id FROM teacher_classes WHERE teacher_id = ${admin[0].id}`;
const classId = cls[0].id;
const members = await sql`SELECT user_id FROM class_members WHERE class_id = ${classId}`;
const memberIds = members.map((r) => Number(r.user_id));
console.log("memberIds", memberIds);

for (const label of ["ANY array", "IN list"]) {
  const t0 = Date.now();
  try {
    let rows;
    if (label === "ANY array") {
      rows = await sql`
        SELECT COUNT(*)::int AS n FROM question_attempts qa
        WHERE qa.user_id = ANY(${memberIds}::int[])
      `;
    } else {
      rows = await sql`
        SELECT COUNT(*)::int AS n FROM question_attempts qa
        WHERE qa.user_id IN ${sql(memberIds)}
      `;
    }
    console.log(label, "ok", rows[0].n, "ms", Date.now() - t0);
  } catch (e) {
    console.error(label, "FAIL", e.message, "ms", Date.now() - t0);
  }
}
