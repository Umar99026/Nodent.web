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
  const sessions = await sql`
    select token, user_id
    from sessions
    order by created_at desc
    limit 1
  `;
  const prompts = await sql`
    select id
    from english_prompts
    order by id asc
    limit 1
  `;
  if (!sessions.length || !prompts.length) {
    throw new Error("No session or prompt available.");
  }

  const res = await fetch("https://nodent.pages.dev/api/english/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessions[0].token}`,
    },
    body: JSON.stringify({
      promptId: prompts[0].id,
      responseType: "essay",
      responseText: "english submit connectivity test",
    }),
  });
  const body = await res.text();
  console.log("status:", res.status);
  console.log("body:", body);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
