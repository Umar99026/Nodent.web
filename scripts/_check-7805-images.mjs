import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const raw = readFileSync(".dev.vars", "utf8");
const m = raw.match(/^DATABASE_URL=(.+)$/m);
const sql = neon(m[1].trim());

const rows = await sql`
  SELECT id, passage, image_urls, LENGTH(COALESCE(image_urls, '')) AS url_len
  FROM custom_questions WHERE id = 7805
`;
console.log("7805:", {
  passage: rows[0]?.passage ? rows[0].passage.slice(0, 60) + "..." : null,
  url_len: rows[0]?.url_len,
  image_urls_preview: rows[0]?.image_urls?.slice(0, 120),
});
