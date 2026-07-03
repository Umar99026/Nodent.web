/**
 * Seed demo students + practice attempts for the admin teacher class.
 * Usage: node scripts/seed-teacher-demo-class.mjs
 * Reads DATABASE_URL from env or .dev.vars
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ADMIN_EMAIL = "nodent.app@gmail.com";
const CLASS_NAME = "Year 12 Methods — Block 3";

const DEMO_STUDENTS = [
  { username: "Mia Chen", email: "demo.mia.chen@nodent.demo", skill: 0.88 },
  { username: "James O'Brien", email: "demo.james.obrien@nodent.demo", skill: 0.82 },
  { username: "Sofia Patel", email: "demo.sofia.patel@nodent.demo", skill: 0.76 },
  { username: "Liam Nguyen", email: "demo.liam.nguyen@nodent.demo", skill: 0.68 },
  { username: "Emma Wilson", email: "demo.emma.wilson@nodent.demo", skill: 0.63 },
  { username: "Noah Taylor", email: "demo.noah.taylor@nodent.demo", skill: 0.55 },
  { username: "Ava Martinez", email: "demo.ava.martinez@nodent.demo", skill: 0.49 },
  { username: "Oliver Brown", email: "demo.oliver.brown@nodent.demo", skill: 0.58 },
];

const METHODS_TOPICS = [
  "Functions and transformations",
  "Polynomial, power and rational functions",
  "Exponential and logarithmic functions",
  "Circular functions",
  "Algebra and equations",
  "Differential calculus",
  "Applications of differentiation",
  "Integral calculus",
  "Applications of integration",
  "Discrete random variables",
  "Continuous random variables",
  "The normal distribution",
  "Sampling and sample proportions",
  "Confidence intervals for proportions",
];

/** Class-wide weak topics get lower base accuracy. */
const TOPIC_BIAS = {
  "Confidence intervals for proportions": -0.22,
  "Applications of integration": -0.18,
  "Sampling and sample proportions": -0.14,
  "Continuous random variables": -0.1,
  "Functions and transformations": 0.08,
  "Differential calculus": 0.06,
  "Algebra and equations": 0.04,
};

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

function nowIso() {
  return new Date().toISOString();
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function buildAttemptsForStudent(studentIndex, skill) {
  const attempts = [];
  let q = 0;
  for (const topic of METHODS_TOPICS) {
    const questionsForTopic = topic.includes("Confidence") || topic.includes("Sampling") ? 4 : 3;
    for (let i = 0; i < questionsForTopic; i += 1) {
      const marks = [1, 2, 3][(studentIndex + i + q) % 3];
      const bias = TOPIC_BIAS[topic] ?? 0;
      const accuracy = clamp(skill + bias + (Math.random() * 0.12 - 0.06), 0.15, 0.98);
      const marksEarned = Math.round(marks * accuracy);
      const isCorrect = marksEarned >= marks ? 1 : marksEarned > 0 ? 0 : 0;
      attempts.push({
        questionKey: `demo-class-${studentIndex}-${q}`,
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

  const adminRows = await sql`
    SELECT id FROM users WHERE lower(email) = lower(${ADMIN_EMAIL}) LIMIT 1
  `;
  if (!adminRows.length) {
    throw new Error(`Admin user not found: ${ADMIN_EMAIL}`);
  }
  const teacherId = adminRows[0].id;

  await sql`
    CREATE TABLE IF NOT EXISTS teacher_classes (
      id serial PRIMARY KEY,
      teacher_id integer NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
      join_code text NOT NULL UNIQUE,
      class_name text NOT NULL DEFAULT 'My class',
      created_at text NOT NULL
    )
  `;
  await sql`
    CREATE TABLE IF NOT EXISTS class_members (
      class_id integer NOT NULL REFERENCES teacher_classes (id) ON DELETE CASCADE,
      user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      joined_at text NOT NULL,
      PRIMARY KEY (class_id, user_id)
    )
  `;

  let classRows = await sql`
    SELECT id, join_code FROM teacher_classes WHERE teacher_id = ${teacherId} LIMIT 1
  `;
  if (!classRows.length) {
    const joinCode = `DEMO${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    classRows = await sql`
      INSERT INTO teacher_classes (teacher_id, join_code, class_name, created_at)
      VALUES (${teacherId}, ${joinCode}, ${CLASS_NAME}, ${now})
      RETURNING id, join_code
    `;
  } else {
    await sql`
      UPDATE teacher_classes SET class_name = ${CLASS_NAME} WHERE id = ${classRows[0].id}
    `;
  }
  const classId = classRows[0].id;
  const joinCode = classRows[0].join_code;

  const studentIds = [];
  for (let i = 0; i < DEMO_STUDENTS.length; i += 1) {
    const student = DEMO_STUDENTS[i];
    let userRows = await sql`
      SELECT id FROM users WHERE lower(email) = lower(${student.email}) LIMIT 1
    `;
    if (!userRows.length) {
      const { salt, hash } = await hashPassword("demo-class-2026");
      userRows = await sql`
        INSERT INTO users (username, email, password_hash, password_salt, hash_algorithm, created_at)
        VALUES (${student.username}, ${student.email}, ${hash}, ${salt}, 'pbkdf2', ${now})
        RETURNING id
      `;
    } else {
      await sql`UPDATE users SET username = ${student.username} WHERE id = ${userRows[0].id}`;
    }
    const userId = userRows[0].id;
    studentIds.push(userId);

    await sql`
      INSERT INTO class_members (class_id, user_id, joined_at)
      VALUES (${classId}, ${userId}, ${now})
      ON CONFLICT (class_id, user_id) DO NOTHING
    `;

    await sql`
      DELETE FROM question_attempts
      WHERE user_id = ${userId}
        AND subject_id = 'methods'
        AND question_key LIKE 'demo-class-%'
    `;

    const attempts = buildAttemptsForStudent(i, student.skill);
    for (const attempt of attempts) {
      await sql`
        INSERT INTO question_attempts (
          user_id, subject_id, question_key, topic, marks, marks_earned, is_correct, answered_at
        ) VALUES (
          ${userId},
          'methods',
          ${attempt.questionKey},
          ${attempt.topic},
          ${attempt.marks},
          ${attempt.marksEarned},
          ${attempt.isCorrect},
          ${now}
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

  const summary = await sql`
    SELECT
      (SELECT COUNT(*)::int FROM class_members WHERE class_id = ${classId}) AS members,
      (SELECT COUNT(*)::int FROM question_attempts qa
        JOIN class_members cm ON cm.user_id = qa.user_id
        WHERE cm.class_id = ${classId}) AS attempts
  `;

  console.log("Demo teacher class seeded.");
  console.log(`  Class: ${CLASS_NAME}`);
  console.log(`  Join code: ${joinCode}`);
  console.log(`  Students: ${summary[0].members}`);
  console.log(`  Question attempts: ${summary[0].attempts}`);
  console.log("  Open /teacher as admin to view the dashboard.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
