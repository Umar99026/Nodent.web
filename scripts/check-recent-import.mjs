import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  const devVars = resolve(process.cwd(), ".dev.vars");
  if (!existsSync(devVars)) return "";
  const raw = readFileSync(devVars, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^DATABASE_URL=(.+)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return "";
}

const sql = neon(loadDatabaseUrl());
const rows = await sql`
  SELECT id, subject_id, created_at,
         LENGTH(image_urls) AS img_len,
         LENGTH(question) AS q_len,
         LEFT(question, 120) AS q
  FROM custom_questions
  WHERE created_at >= '2026-06-13T13:45:00'
  ORDER BY id
`;
for (const r of rows) {
  console.log(r.id, r.subject_id, r.created_at?.slice(11, 19), `img=${r.img_len}`, `q=${r.q_len}`, "|", r.q);
}
