import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const env = readFileSync(".dev.vars", "utf8");
const match = env.match(/^DATABASE_URL=(.+)$/m);
if (!match) throw new Error("DATABASE_URL not found");
const sql = neon(match[1].trim());

const rows = await sql`
  SELECT pe.subject_id, pe.year, pe.exam_number, pe.published, pe.layout, pe.mcq_count,
    (SELECT COUNT(*)::integer FROM practice_exam_pages pep WHERE pep.exam_id = pe.id) AS page_count,
    pe.updated_at
  FROM practice_exams pe
  ORDER BY pe.subject_id, pe.year DESC, pe.exam_number
`;

for (const r of rows) {
  const paper = Number(r.exam_number) === 2 ? "Exam 2" : "Exam 1";
  const status = Number(r.published) === 1 ? "PUBLISHED" : "DRAFT";
  console.log(
    `${r.subject_id} | ${r.year} | ${paper} | ${status} | ${r.page_count} pages | layout=${r.layout} | updated ${r.updated_at}`,
  );
}
if (!rows.length) console.log("(no practice exams in database)");
