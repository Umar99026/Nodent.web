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

  const all = (query) =>
    new Promise((resolve, reject) => {
      sqliteDb.all(query, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

  const books = await all("select id, title, created_at from english_books order by id asc");
  const prompts = await all(
    "select id, book_id, prompt_text, created_at, section from english_prompts order by id asc",
  );
  const responses = await all(
    "select id, prompt_id, user_id, response_type, response_text, image_urls, created_at, updated_at from english_responses order by id asc",
  );
  const ratings = await all(
    "select id, response_id, rater_user_id, score, created_at from english_response_ratings order by id asc",
  );

  await sql`begin`;
  try {
    await sql`
      create table if not exists english_books (
        id serial primary key,
        title text not null,
        created_at text not null
      )
    `;
    await sql`
      create table if not exists english_prompts (
        id serial primary key,
        book_id integer not null,
        prompt_text text not null,
        created_at text not null,
        section text not null default 'A'
      )
    `;
    await sql`
      create table if not exists english_responses (
        id serial primary key,
        prompt_id integer not null,
        user_id integer not null,
        response_type text not null default 'essay',
        response_text text not null default '',
        image_urls text,
        created_at text not null,
        updated_at text not null
      )
    `;
    await sql`
      create table if not exists english_response_ratings (
        id serial primary key,
        response_id integer not null,
        rater_user_id integer not null,
        score integer not null,
        created_at text not null,
        unique(response_id, rater_user_id)
      )
    `;

    await sql`delete from english_response_ratings`;
    await sql`delete from english_responses`;
    await sql`delete from english_prompts`;
    await sql`delete from english_books`;

    for (const row of books) {
      await sql`
        insert into english_books (id, title, created_at)
        values (${Number(row.id)}, ${String(row.title || "")}, ${String(row.created_at || new Date().toISOString())})
      `;
    }
    for (const row of prompts) {
      await sql`
        insert into english_prompts (id, book_id, prompt_text, created_at, section)
        values (
          ${Number(row.id)},
          ${Number(row.book_id)},
          ${String(row.prompt_text || "")},
          ${String(row.created_at || new Date().toISOString())},
          ${String(row.section || "A")}
        )
      `;
    }
    for (const row of responses) {
      await sql`
        insert into english_responses (id, prompt_id, user_id, response_type, response_text, image_urls, created_at, updated_at)
        values (
          ${Number(row.id)},
          ${Number(row.prompt_id)},
          ${Number(row.user_id)},
          ${String(row.response_type || "essay")},
          ${String(row.response_text || "")},
          ${row.image_urls == null ? null : String(row.image_urls)},
          ${String(row.created_at || new Date().toISOString())},
          ${String(row.updated_at || row.created_at || new Date().toISOString())}
        )
      `;
    }
    for (const row of ratings) {
      const score = Number(row.score);
      await sql`
        insert into english_response_ratings (id, response_id, rater_user_id, score, created_at)
        values (
          ${Number(row.id)},
          ${Number(row.response_id)},
          ${Number(row.rater_user_id)},
          ${Number.isFinite(score) ? score : 1},
          ${String(row.created_at || new Date().toISOString())}
        )
      `;
    }

    await sql`select setval('english_books_id_seq', coalesce((select max(id) from english_books), 1), true)`;
    await sql`select setval('english_prompts_id_seq', coalesce((select max(id) from english_prompts), 1), true)`;
    await sql`select setval('english_responses_id_seq', coalesce((select max(id) from english_responses), 1), true)`;
    await sql`select setval('english_response_ratings_id_seq', coalesce((select max(id) from english_response_ratings), 1), true)`;

    await sql`commit`;
  } catch (error) {
    await sql`rollback`;
    throw error;
  } finally {
    sqliteDb.close();
  }

  const [bookCount] = await sql`select count(*)::int as c from english_books`;
  const [promptCount] = await sql`select count(*)::int as c from english_prompts`;
  const [responseCount] = await sql`select count(*)::int as c from english_responses`;
  const [ratingCount] = await sql`select count(*)::int as c from english_response_ratings`;
  console.log(
    `Synced English tables. books=${bookCount.c}, prompts=${promptCount.c}, responses=${responseCount.c}, ratings=${ratingCount.c}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
