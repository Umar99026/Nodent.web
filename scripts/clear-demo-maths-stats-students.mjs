/**
 * Delete any maths-stats seed students created with the old "Demo Student X" naming.
 *
 * Usage:
 *   node scripts/clear-demo-maths-stats-students.mjs
 *   node scripts/clear-demo-maths-stats-students.mjs --apply
 *
 * Safety:
 * - Only deletes users with username starting "Demo Student " OR email starting with "demo.stats."
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const APPLY = process.argv.includes("--apply");

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL.trim();
  const devVars = resolve(".dev.vars");
  if (!existsSync(devVars)) throw new Error("DATABASE_URL not set and .dev.vars missing");
  const raw = readFileSync(devVars, "utf8");
  const m = raw.match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error("DATABASE_URL not found in .dev.vars");
  return m[1].trim().replace(/^["']|["']$/g, "");
}

const sql = neon(loadDatabaseUrl());

const selector = sql`
  WHERE username ILIKE 'Demo Student %'
     OR lower(email) LIKE 'demo.stats.%'
`;

const targets = await sql`
  SELECT id, username, email
  FROM users
  ${selector}
  ORDER BY id ASC
`;

console.log(`Found ${targets.length} demo maths-stats student(s).`);
if (targets.length) {
  console.log(
    `First few:`,
    targets.slice(0, 5).map((t) => ({ id: t.id, username: t.username, email: t.email })),
  );
}

if (!APPLY) {
  console.log("Dry run only. Re-run with --apply to delete.");
  process.exit(0);
}

const deleted = await sql`
  DELETE FROM users
  ${selector}
  RETURNING id
`;

console.log(`Deleted ${deleted.length} user(s). Cascade removed related attempts.`);

