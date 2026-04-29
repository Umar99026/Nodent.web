const fs = require("fs");
const path = require("path");
const { neon } = require("@neondatabase/serverless");

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const vars = fs.readFileSync(path.resolve(__dirname, "..", ".dev.vars"), "utf8");
  const m = vars.match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error("DATABASE_URL not found");
  return m[1].trim();
}

async function main() {
  const sql = neon(readDatabaseUrl());
  const counts = await sql`
    SELECT section, COUNT(*)::int AS c
    FROM english_prompts
    GROUP BY section
    ORDER BY section
  `;
  console.log("counts:", counts);

  for (const section of ["A", "B", "C"]) {
    const rows = await sql`
      SELECT id, prompt_text
      FROM english_prompts
      WHERE section = ${section}
      ORDER BY id DESC
      LIMIT 8
    `;
    console.log(`\nSection ${section}:`);
    for (const r of rows) {
      console.log(`${r.id}: ${String(r.prompt_text).slice(0, 140)}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
