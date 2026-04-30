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
  const [bookCount] = await sql`select count(*)::int as c from english_books`;
  const [promptCount] = await sql`select count(*)::int as c from english_prompts`;
  const [orphanCount] = await sql`
    select count(*)::int as c
    from english_prompts p
    left join english_books b on b.id = p.book_id
    where b.id is null
  `;
  const sectionCounts = await sql`
    select section, count(*)::int as c
    from english_prompts
    group by section
    order by section
  `;
  const topBooks = await sql`
    select
      b.id,
      b.title,
      sum(case when p.section = 'A' then 1 else 0 end)::int as a_count
    from english_books b
    left join english_prompts p on p.book_id = b.id
    group by b.id, b.title
    order by a_count desc, b.title asc
    limit 8
  `;

  console.log({
    books: bookCount.c,
    prompts: promptCount.c,
    orphans: orphanCount.c,
  });
  console.log("sections:", sectionCounts);
  console.log("topBooks:", topBooks);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
