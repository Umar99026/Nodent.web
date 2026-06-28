/**
 * Restore oyster question 7805 figure (passage stays cleared).
 * Uses public asset source-page-01.png — original PDF page for Table 1.
 */
import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const API = "http://127.0.0.1:8787";
const HEADERS = { "x-admin-key": "localdev", "Content-Type": "application/json" };
const QID = 7805;
const IMAGE = "/questions/demo/source-page-01.png";

async function main() {
  const sql = neon(
    readFileSync(".dev.vars", "utf8").match(/^DATABASE_URL=(.+)$/m)[1].trim(),
  );

  const attach = await fetch(`${API}/api/admin/questions/attach-images-bulk`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      mappings: [{ questionId: QID, image_urls_json: [IMAGE] }],
    }),
  });
  const attachJson = await attach.json();
  console.log("attach-images-bulk", attach.status, attachJson);

  const rows = await sql`
    SELECT id, passage, image_urls FROM custom_questions WHERE id = ${QID}
  `;
  const row = rows[0];
  console.log("DB after restore:", {
    passage: row?.passage ?? "(null)",
    image_urls: row?.image_urls,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
