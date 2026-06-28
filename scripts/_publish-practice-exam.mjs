import { neon } from "@neondatabase/serverless";
import { readFileSync } from "fs";

const env = readFileSync(".dev.vars", "utf8");
const match = env.match(/^DATABASE_URL=(.+)$/m);
if (!match) throw new Error("DATABASE_URL not found");
const sql = neon(match[1].trim());

const subjectId = process.argv[2] ?? "methods";
const year = Number(process.argv[3] ?? 2025);
const examNumber = Number(process.argv[4] ?? 1) === 2 ? 2 : 1;

const rows = await sql`
  UPDATE practice_exams
  SET published = 1, updated_at = ${new Date().toISOString()}
  WHERE subject_id = ${subjectId}
    AND year = ${year}
    AND exam_number = ${examNumber}
  RETURNING subject_id, year, exam_number, published
`;

if (!rows.length) {
  console.error(`No exam found: ${subjectId} ${year} Exam ${examNumber}`);
  process.exit(1);
}

console.log("Published:", rows[0]);
