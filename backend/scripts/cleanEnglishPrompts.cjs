const fs = require("fs");
const path = require("path");
const { neon } = require("@neondatabase/serverless");

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const devVarsPath = path.resolve(__dirname, "..", ".dev.vars");
  const devVars = fs.readFileSync(devVarsPath, "utf8");
  const match = devVars.match(/^DATABASE_URL=(.+)$/m);
  if (!match) throw new Error("DATABASE_URL not found in backend/.dev.vars");
  return match[1].trim();
}

function cleanPromptText(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .replace(/\.\s*begin(?:ning)?\s+with\s*:\s*\.?\s*$/i, "")
    .replace(/\bbegin(?:ning)?\s+with\s*:\s*\.?\s*$/i, "")
    .trim();
}

async function main() {
  const sql = neon(readDatabaseUrl());
  const rows = await sql`
    SELECT id, section, prompt_text
    FROM english_prompts
    WHERE section = 'B'
    ORDER BY id ASC
  `;

  let updated = 0;
  for (const row of rows) {
    const original = String(row.prompt_text || "");
    const cleaned = cleanPromptText(original);
    if (!cleaned || cleaned === original) continue;
    await sql`
      UPDATE english_prompts
      SET prompt_text = ${cleaned}
      WHERE id = ${Number(row.id)}
    `;
    updated += 1;
  }

  console.log(`Cleaned section B prompts. updated=${updated}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
