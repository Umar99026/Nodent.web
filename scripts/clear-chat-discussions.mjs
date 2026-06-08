/**
 * Remove all chat and discussion data from Neon. Preserves questions, English
 * responses, users, study data, etc.
 *
 * Usage: node scripts/clear-chat-discussions.mjs
 * (reads DATABASE_URL from .dev.vars or env)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const raw = readFileSync(resolve(".dev.vars"), "utf8");
  const m = raw.match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error("DATABASE_URL not found in .dev.vars");
  return m[1].trim();
}

const sql = neon(loadDatabaseUrl());

const TABLES = [
  "forum_replies",
  "forum_posts",
  "chat_messages",
  "quiz_comments",
];

async function count(table) {
  const rows = await sql.query(`SELECT COUNT(*)::int AS count FROM ${table}`);
  return Number(rows?.[0]?.count ?? 0);
}

const englishBefore = await count("english_responses");
const questionsBefore = await count("custom_questions");

console.log("Before:");
for (const t of TABLES) {
  console.log(`  ${t}: ${await count(t)}`);
}
console.log(`  english_responses: ${englishBefore} (unchanged target)`);
console.log(`  custom_questions: ${questionsBefore} (unchanged target)`);

for (const t of TABLES) {
  await sql.query(`DELETE FROM ${t}`);
}

console.log("\nAfter:");
for (const t of TABLES) {
  console.log(`  ${t}: ${await count(t)}`);
}

const englishAfter = await count("english_responses");
const questionsAfter = await count("custom_questions");
console.log(`  english_responses: ${englishAfter}`);
console.log(`  custom_questions: ${questionsAfter}`);

if (englishAfter !== englishBefore || questionsAfter !== questionsBefore) {
  console.error("\nERROR: english_responses or custom_questions count changed!");
  process.exit(1);
}

console.log("\nDone — chat and discussions cleared.");
