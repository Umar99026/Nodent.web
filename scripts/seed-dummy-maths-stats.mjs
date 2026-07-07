/**
 * Seed 10 dummy students + mark attempts for General Maths & Specialist Maths.
 *
 * Usage:
 *   node scripts/seed-dummy-maths-stats.mjs
 *
 * Reads DATABASE_URL from env or .dev.vars.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import crypto from "node:crypto";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUBJECTS = /** @type {const} */ ([
  { id: "general-maths", label: "General Maths" },
  { id: "specialist-maths", label: "Specialist Maths" },
]);

const GENERAL_MATHS_TOPICS = [
  "Data and graphs",
  "Financial arithmetic",
  "Matrices",
  "Networks",
  "Geometry and measurement",
  "Statistics",
  "Probability",
  "Recursion and algorithms",
];

const SPECIALIST_TOPICS = [
  "Proof and number",
  "Vectors",
  "Complex numbers",
  "Functions and graphs",
  "Calculus",
  "Mechanics",
  "Probability and statistics",
  "Differential equations",
];

const SEEDED_STUDENTS = [
  { username: "Mia Chen", email: "seed.stats.1@nodent.demo", skill: 0.9 },
  { username: "James O’Brien", email: "seed.stats.2@nodent.demo", skill: 0.85 },
  { username: "Sofia Patel", email: "seed.stats.3@nodent.demo", skill: 0.8 },
  { username: "Liam Nguyen", email: "seed.stats.4@nodent.demo", skill: 0.75 },
  { username: "Emma Wilson", email: "seed.stats.5@nodent.demo", skill: 0.7 },
  { username: "Noah Taylor", email: "seed.stats.6@nodent.demo", skill: 0.65 },
  { username: "Ava Martinez", email: "seed.stats.7@nodent.demo", skill: 0.6 },
  { username: "Oliver Brown", email: "seed.stats.8@nodent.demo", skill: 0.58 },
  { username: "Zara Ahmed", email: "seed.stats.9@nodent.demo", skill: 0.52 },
  { username: "Jack Thompson", email: "seed.stats.10@nodent.demo", skill: 0.47 },
];

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const raw = readFileSync(resolve(__dirname, "../.dev.vars"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^DATABASE_URL=(.+)$/);
      if (m) return m[1].trim();
    }
  } catch {
    // ignore
  }
  throw new Error("DATABASE_URL not found in env or .dev.vars");
}

function nowIso() {
  return new Date().toISOString();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function bytesToHex(bytes) {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function hexToBytes(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  return bytes;
}

async function hashPassword(password, existingSalt) {
  const encoder = new TextEncoder();
  const saltBytes = existingSalt
    ? hexToBytes(existingSalt)
    : crypto.getRandomValues(new Uint8Array(16));
  const salt = bytesToHex(saltBytes);
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const hashBuffer = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    512,
  );
  return { salt, hash: bytesToHex(new Uint8Array(hashBuffer)) };
}

function topicListForSubject(subjectId) {
  return subjectId === "specialist-maths" ? SPECIALIST_TOPICS : GENERAL_MATHS_TOPICS;
}

function buildAttempts({ studentIndex, skill, subjectId }) {
  const topics = topicListForSubject(subjectId);
  const attempts = [];
  let q = 0;

  // Enough attempts to be eligible everywhere (>=10) and look realistic.
  // 8 topics × 5 questions = 40 per subject per student.
  for (const topic of topics) {
    for (let i = 0; i < 5; i += 1) {
      const marks = [1, 2, 3][(studentIndex + i + q) % 3];
      const noise = Math.random() * 0.14 - 0.07;
      const accuracy = clamp(skill + noise, 0.05, 0.98);
      const marksEarned = Math.round(marks * accuracy);
      attempts.push({
        questionKey: `dummy-stats-${subjectId}-${studentIndex}-${q}`,
        topic,
        marks,
        marksEarned,
        isCorrect: marksEarned >= marks ? 1 : 0,
      });
      q += 1;
    }
  }

  return attempts;
}

async function main() {
  const sql = neon(loadDatabaseUrl());
  const now = nowIso();

  // Ensure unique index exists for upsert.
  await sql`
    CREATE UNIQUE INDEX IF NOT EXISTS question_attempts_user_subject_question_idx
    ON question_attempts (user_id, subject_id, question_key)
  `;

  const seededUserIds = [];

  for (let i = 0; i < SEEDED_STUDENTS.length; i += 1) {
    const student = SEEDED_STUDENTS[i];

    let userRows = await sql`
      SELECT id, password_salt
      FROM users
      WHERE lower(email) = lower(${student.email})
      LIMIT 1
    `;

    if (!userRows.length) {
      const existingByName = await sql`
        SELECT id, email
        FROM users
        WHERE username = ${student.username}
        LIMIT 1
      `;
      if (existingByName.length) {
        // Avoid failing on unique username — keep the existing student and just update their email to match the seed.
        await sql`
          UPDATE users
          SET email = ${student.email}
          WHERE id = ${existingByName[0].id}
        `;
        userRows = [{ id: existingByName[0].id, password_salt: null }];
      }
    }

    if (!userRows.length) {
      const { salt, hash } = await hashPassword("demo-stats-2026");
      userRows = await sql`
        INSERT INTO users (username, email, password_hash, password_salt, hash_algorithm, created_at)
        VALUES (${student.username}, ${student.email}, ${hash}, ${salt}, 'pbkdf2', ${now})
        RETURNING id, password_salt
      `;
    } else {
      await sql`UPDATE users SET username = ${student.username} WHERE id = ${userRows[0].id}`;
    }

    const userId = userRows[0].id;
    seededUserIds.push(userId);

    for (const subject of SUBJECTS) {
      // Clear only the rows we own (safe to re-run).
      await sql`
        DELETE FROM question_attempts
        WHERE user_id = ${userId}
          AND subject_id = ${subject.id}
          AND question_key LIKE 'dummy-stats-%'
      `;

      const attempts = buildAttempts({
        studentIndex: i,
        skill: student.skill,
        subjectId: subject.id,
      });

      for (let j = 0; j < attempts.length; j += 1) {
        const a = attempts[j];
        // Spread timestamps slightly so "week" filters aren't identical.
        const answeredAt = new Date(Date.now() - (j % 21) * 24 * 60 * 60 * 1000).toISOString();
        await sql`
          INSERT INTO question_attempts (
            user_id, subject_id, question_key, topic, marks, marks_earned, is_correct, answered_at
          ) VALUES (
            ${userId},
            ${subject.id},
            ${a.questionKey},
            ${a.topic},
            ${a.marks},
            ${a.marksEarned},
            ${a.isCorrect},
            ${answeredAt}
          )
          ON CONFLICT (user_id, subject_id, question_key) DO UPDATE SET
            topic = EXCLUDED.topic,
            marks = EXCLUDED.marks,
            marks_earned = EXCLUDED.marks_earned,
            is_correct = EXCLUDED.is_correct,
            answered_at = EXCLUDED.answered_at
        `;
      }
    }
  }

  const summary = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM users WHERE id = ANY(${seededUserIds})) AS students,
      (SELECT COUNT(*)::int FROM question_attempts WHERE question_key LIKE 'dummy-stats-%') AS attempts
  `;

  console.log("Seeded maths cohort stats.");
  console.log(`  Students: ${summary[0]?.students ?? seededUserIds.length}`);
  console.log(`  Attempts: ${summary[0]?.attempts ?? 0}`);
  console.log("  Subjects: general-maths, specialist-maths");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
