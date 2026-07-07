import { readFileSync } from "node:fs";
import { neon } from "@neondatabase/serverless";

const raw = readFileSync(".dev.vars", "utf8");
const m = raw.match(/^DATABASE_URL=(.+)$/m);
if (!m) throw new Error("DATABASE_URL not found in .dev.vars");

const sql = neon(m[1].trim());
const token = process.argv[2];
if (!token) throw new Error("Usage: node scripts/debug-session-query.mjs <token>");

const rows = await sql`
  select u.id,u.email,u.username,u.profile_photo,u.account_role,u.onboarding_completed_at,u.is_vce_student,u.plan,u.premium_until,s.expires_at
  from sessions s
  inner join users u on s.user_id=u.id
  where s.token=${token}
  limit 1
`;

console.log(rows);

