const fs = require("fs");
const path = require("path");
const sqlite3 = require("sqlite3");
const { neon } = require("@neondatabase/serverless");

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const devVars = fs.readFileSync(path.resolve(__dirname, "..", ".dev.vars"), "utf8");
  const match = devVars.match(/^DATABASE_URL=(.+)$/m);
  if (!match) throw new Error("DATABASE_URL not found in backend/.dev.vars");
  return match[1].trim();
}

async function main() {
  const sqlitePath = path.resolve(__dirname, "..", "..", "nodent.db");
  const sqliteDb = new sqlite3.Database(sqlitePath);
  const sql = neon(readDatabaseUrl());

  const rows = await new Promise((resolve, reject) => {
    sqliteDb.all("select * from custom_questions order by id asc", (err, r) => {
      if (err) reject(err);
      else resolve(r || []);
    });
  });

  await sql`begin`;
  try {
    await sql`delete from custom_questions`;
    for (const r of rows) {
      const parsedMarks = Number(r.marks);
      const marks = Number.isFinite(parsedMarks) && parsedMarks > 0 ? Math.round(parsedMarks) : 1;
      await sql`
        insert into custom_questions
          (subject_id, type, topic, question, image_urls, options, answer, accepted_answers, guidance, passage, marks, created_at)
        values
          (${String(r.subject_id || "")}, ${String(r.type || "")}, ${String(r.topic || "General")}, ${String(r.question || "")},
           ${r.image_urls == null ? null : String(r.image_urls)}, ${r.options == null ? null : String(r.options)},
           ${r.answer == null ? null : String(r.answer)}, ${r.accepted_answers == null ? null : String(r.accepted_answers)},
           ${r.guidance == null ? null : String(r.guidance)}, ${r.passage == null ? null : String(r.passage)},
           ${marks}, ${String(r.created_at || new Date().toISOString())})
      `;
    }
    await sql`commit`;
  } catch (error) {
    await sql`rollback`;
    throw error;
  } finally {
    sqliteDb.close();
  }

  const countRows = await sql`select count(*)::int as c from custom_questions`;
  console.log(`Synced ${rows.length} questions. Neon now has ${countRows[0].c}.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
