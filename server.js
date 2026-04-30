const express = require("express");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");
const sheetsSync = require("./googleSheetsSync");

const app = express();
const PORT = process.env.PORT || 3000;

// Hardcoded admin credentials (requested).
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "nodent.app@gmail.com";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Umar99026#";

// Legacy admin key (no longer used for authorization by default).
const ADMIN_KEY = process.env.ADMIN_KEY || "nodent-admin-2025";

// ── DB path: always next to server.js, never inside public/ ──────────────────
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "nodent.db");
console.log(`[DB] Using database at: ${DB_PATH}`);

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("[DB] Failed to open database:", err.message);
    process.exit(1);
  }
  console.log("[DB] Connected successfully.");
});

// WAL mode = much better concurrent write performance across multiple devices
db.run("PRAGMA journal_mode=WAL");
db.run("PRAGMA foreign_keys=ON");
db.run("PRAGMA synchronous=NORMAL");
let lastSessionCleanupAt = 0;

// ── Helpers ───────────────────────────────────────────────────────────────────

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) {
        console.error("[DB run error]", sql.slice(0, 80), err.message);
        reject(err);
      } else {
        resolve(this);
      }
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) {
        console.error("[DB get error]", sql.slice(0, 80), err.message);
        reject(err);
      } else {
        resolve(row);
      }
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) {
        console.error("[DB all error]", sql.slice(0, 80), err.message);
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });
}

async function ensureColumn(table, column, definition) {
  const columns = await all(`PRAGMA table_info(${table})`);
  const exists = columns.some((item) => item.name === column);
  if (!exists) {
    console.log(`[DB] Adding column ${column} to ${table}`);
    await run(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function nowIso() {
  return new Date().toISOString();
}

function normalizeEnglishSection(value) {
  const t = cleanText(value, 24).toUpperCase();
  if (t === "A" || t === "B" || t === "C") return t;
  if (/\bA\b/.test(t)) return "A";
  if (/\bB\b/.test(t)) return "B";
  if (/\bC\b/.test(t)) return "C";
  return "A";
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, hash) {
  const hashed = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hashed, "hex"), Buffer.from(hash, "hex"));
}

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function cleanText(value, maxLength = 2000) {
  return String(value || "").replace(/\u0000/g, "").trim().slice(0, maxLength);
}

/** Sheet/admin labels → baseSubjects id (e.g. "Mathematical Methods" → methods). */
function canonicalSubjectId(raw) {
  const s = cleanText(raw, 80).toLowerCase().replace(/\s+/g, " ");
  const aliases = {
    "mathematical methods": "methods",
    "mathematical-methods": "methods",
    "math methods": "methods",
    mm: "methods",
    "general mathematics": "general-maths",
    "general maths": "general-maths",
    "general-mathematics": "general-maths",
    "further mathematics": "further-maths",
    "further maths": "further-maths",
    "specialist mathematics": "specialist-maths",
    "specialist maths": "specialist-maths"
  };
  return aliases[s] || s;
}

/** Sheets often paste “smart quotes”, or Python-style ['a','b'] instead of JSON — never fail bootstrap. */
function safeJsonColumn(raw, label, rowId) {
  if (raw == null || raw === "") return undefined;
  const str = String(raw);
  const tryParse = (s) => {
    try {
      return JSON.parse(s);
    } catch {
      return null;
    }
  };
  let v = tryParse(str);
  if (v !== null) return v;
  try {
    const fixed = str
      .replace(/[\u201c\u201d\u201e]/g, '"')
      .replace(/[\u2018\u2019]/g, "'");
    v = tryParse(fixed);
    if (v !== null) return v;
  } catch {
    /* continue */
  }
  // Python / Google Sheets: ['2','4'] — not valid JSON; convert quotes.
  if (/^\s*\[/.test(str) && /'/.test(str)) {
    try {
      v = JSON.parse(str.replace(/'/g, '"'));
      if (v !== null) return v;
    } catch {
      /* fall through */
    }
  }
  console.warn(
    `[Bootstrap] Invalid JSON in ${label} for custom_questions.id=${rowId}:`,
    str.slice(0, 160),
  );
  return undefined;
}

function parseFlexibleArrayInput(raw) {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const arr = raw.map((x) => String(x || "").trim()).filter(Boolean);
    return arr.length ? arr : null;
  }
  const t = cleanText(raw, 200000);
  if (!t) return null;
  const parsed = safeJsonColumn(t, "flex-array", "n/a");
  if (Array.isArray(parsed)) {
    const arr = parsed.map((x) => String(x || "").trim()).filter(Boolean);
    return arr.length ? arr : null;
  }
  const stripped = t.replace(/^["'`]+|["'`]+$/g, "").trim();
  const bracketStripped =
    stripped.startsWith("[") && stripped.endsWith("]") ? stripped.slice(1, -1).trim() : stripped;
  const candidate = bracketStripped || stripped;

  if (/^data:[^,]+,[\s\S]+$/i.test(candidate)) return [candidate];

  let parts = [];
  if (candidate.includes("\n")) {
    parts = candidate.split("\n");
  } else if (candidate.includes("|")) {
    parts = candidate.split("|");
  } else if (candidate.includes(";")) {
    parts = candidate.split(";");
  } else if (candidate.includes(",")) {
    if (/^data:[^,]+,[\s\S]+$/i.test(candidate)) {
      parts = [candidate];
    } else if (/(https?:\/\/|data:image\/)/i.test(candidate)) {
      parts = candidate.split(/,(?=\s*(?:https?:\/\/|data:image\/))/i);
      if (parts.length <= 1) parts = [candidate];
    } else {
      parts = candidate.split(",");
    }
  } else {
    parts = [candidate];
  }

  const arr = parts
    .map((s) => String(s || "").trim().replace(/^["'`]+|["'`]+$/g, ""))
    .filter(Boolean);
  return arr.length ? arr : null;
}

// ── DB init ───────────────────────────────────────────────────────────────────

async function initDb() {
  console.log("[DB] Initialising tables...");

  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE DEFAULT "",
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  await ensureColumn("users", "username", 'TEXT NOT NULL DEFAULT ""');
  await ensureColumn("users", "profile_photo", "TEXT");
  await run(`UPDATE users SET username = email WHERE username IS NULL OR TRIM(username) = ""`);

  await run(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Add expires_at to existing sessions tables that don't have it
  await ensureColumn("sessions", "expires_at", "TEXT NOT NULL DEFAULT '2099-01-01T00:00:00.000Z'");

  await run(`
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subject_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      percent INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS written_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subject_id TEXT NOT NULL,
      question_key TEXT NOT NULL,
      response_text TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(user_id, subject_id, question_key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS quiz_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id TEXT NOT NULL,
      question_key TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      parent_comment_id INTEGER,
      text TEXT NOT NULL,
      image_urls TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_comment_id) REFERENCES quiz_comments(id) ON DELETE CASCADE
    )
  `);
  await ensureColumn("quiz_comments", "image_urls", "TEXT");

  await run(`
    CREATE TABLE IF NOT EXISTS custom_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id TEXT NOT NULL,
      type TEXT NOT NULL,
      topic TEXT NOT NULL DEFAULT 'General',
      question TEXT NOT NULL,
      image_urls TEXT,
      options TEXT,
      answer TEXT,
      accepted_answers TEXT,
      marks INTEGER NOT NULL DEFAULT 1,
      guidance TEXT,
      passage TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // Ensure topic column exists on older DBs.
  await ensureColumn("custom_questions", "topic", "TEXT NOT NULL DEFAULT 'General'");

  // Optional images (JSON array of URLs).
  await ensureColumn("custom_questions", "image_urls", "TEXT");

  // Ensure marks column exists on older DBs.
  await ensureColumn("custom_questions", "marks", "INTEGER NOT NULL DEFAULT 1");
  // Default non-MCQ custom questions to >1 mark.
  await run(
    `UPDATE custom_questions
     SET marks = 2
     WHERE type IN ('short_answer','long_answer','short','long') AND marks = 1`,
  );

  // English writing mode: books + prompts + shared responses + peer ratings.
  await run(`
    CREATE TABLE IF NOT EXISTS english_books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    )
  `);
  await run(`
    CREATE TABLE IF NOT EXISTS english_prompts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      prompt_text TEXT NOT NULL,
      section TEXT NOT NULL DEFAULT 'A',
      created_at TEXT NOT NULL,
      FOREIGN KEY (book_id) REFERENCES english_books(id) ON DELETE CASCADE
    )
  `);
  await ensureColumn("english_prompts", "section", "TEXT NOT NULL DEFAULT 'A'");
  await run(`
    CREATE TABLE IF NOT EXISTS english_responses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      prompt_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      response_type TEXT NOT NULL DEFAULT 'essay',
      response_text TEXT NOT NULL DEFAULT '',
      image_urls TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(prompt_id, user_id),
      FOREIGN KEY (prompt_id) REFERENCES english_prompts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  // Migration: allow multiple submissions per prompt/user (remove legacy UNIQUE(prompt_id, user_id)).
  const englishResponsesTable = await get(
    `SELECT sql FROM sqlite_master WHERE type='table' AND name='english_responses'`,
  );
  const hasPromptUserUnique =
    typeof englishResponsesTable?.sql === "string" &&
    /UNIQUE\s*\(\s*prompt_id\s*,\s*user_id\s*\)/i.test(englishResponsesTable.sql);
  if (hasPromptUserUnique) {
    await run(`PRAGMA foreign_keys = OFF`);
    await run(`
      CREATE TABLE IF NOT EXISTS english_responses_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prompt_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        response_type TEXT NOT NULL DEFAULT 'essay',
        response_text TEXT NOT NULL DEFAULT '',
        image_urls TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (prompt_id) REFERENCES english_prompts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `);
    await run(`
      INSERT INTO english_responses_new (id, prompt_id, user_id, response_type, response_text, image_urls, created_at, updated_at)
      SELECT id, prompt_id, user_id, response_type, response_text, image_urls, created_at, updated_at
      FROM english_responses
    `);
    await run(`DROP TABLE english_responses`);
    await run(`ALTER TABLE english_responses_new RENAME TO english_responses`);
    await run(`PRAGMA foreign_keys = ON`);
  }
  await run(`
    CREATE TABLE IF NOT EXISTS english_response_ratings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      response_id INTEGER NOT NULL,
      rater_user_id INTEGER NOT NULL,
      score INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(response_id, rater_user_id),
      FOREIGN KEY (response_id) REFERENCES english_responses(id) ON DELETE CASCADE,
      FOREIGN KEY (rater_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_english_prompts_book_section ON english_prompts(book_id, section)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_english_responses_prompt_updated ON english_responses(prompt_id, updated_at)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_english_responses_user_updated ON english_responses(user_id, updated_at)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at)`);

  await run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS forum_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      image_urls TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS forum_replies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      subject_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Optional images on posts (JSON array of URLs).
  await ensureColumn("forum_posts", "image_urls", "TEXT");

  await run(`CREATE INDEX IF NOT EXISTS idx_forum_posts_subject_updated ON forum_posts(subject_id, updated_at)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_forum_replies_post_created ON forum_replies(post_id, created_at)`);

  // ── Dojo (PvP battles) ───────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS dojo_challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenger_id INTEGER NOT NULL,
      opponent_id INTEGER NOT NULL,
      subject_id TEXT NOT NULL,
      topic TEXT NOT NULL DEFAULT 'General',
      question_set TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      opponent_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      accepted_at TEXT,
      FOREIGN KEY (challenger_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (opponent_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS dojo_battles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      challenge_id INTEGER NOT NULL,
      subject_id TEXT NOT NULL,
      topic TEXT NOT NULL DEFAULT 'General',
      player1_id INTEGER NOT NULL,
      player2_id INTEGER NOT NULL,
      player1_score INTEGER NOT NULL DEFAULT 0,
      player2_score INTEGER NOT NULL DEFAULT 0,
      current_index INTEGER NOT NULL DEFAULT 0,
      question_started_at TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      winner_id INTEGER,
      question_set TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (challenge_id) REFERENCES dojo_challenges(id) ON DELETE CASCADE,
      FOREIGN KEY (player1_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (player2_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  await run(`CREATE INDEX IF NOT EXISTS idx_dojo_challenges_opponent_status ON dojo_challenges(opponent_id, status, opponent_read)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_dojo_battles_status ON dojo_battles(status, updated_at)`);

  // ── Friends ────────────────────────────────────────────────────────────────
  await run(`
    CREATE TABLE IF NOT EXISTS friend_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      responded_at TEXT,
      UNIQUE(from_user_id, to_user_id),
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_friend_requests_to_status ON friend_requests(to_user_id, status, created_at)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_friend_requests_from_status ON friend_requests(from_user_id, status, created_at)`);

  await run(`
    CREATE TABLE IF NOT EXISTS friendships (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user1_id INTEGER NOT NULL,
      user2_id INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(user1_id, user2_id),
      FOREIGN KEY (user1_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (user2_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_friendships_user1 ON friendships(user1_id)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_friendships_user2 ON friendships(user2_id)`);

  await run(`
    CREATE TABLE IF NOT EXISTS friend_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      subject_id TEXT NOT NULL,
      question_key TEXT NOT NULL,
      question_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      answer_json TEXT,
      answered_at TEXT,
      is_correct INTEGER,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await run(`CREATE INDEX IF NOT EXISTS idx_friend_assignments_pair_created ON friend_assignments(from_user_id, to_user_id, created_at)`);
  await run(`CREATE INDEX IF NOT EXISTS idx_friend_assignments_to_created ON friend_assignments(to_user_id, created_at)`);

  await run(`
    CREATE TABLE IF NOT EXISTS user_study_daily (
      user_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      total_seconds INTEGER NOT NULL DEFAULT 0,
      by_subject_json TEXT NOT NULL DEFAULT '{}',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (user_id, date),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  await run(
    `CREATE INDEX IF NOT EXISTS idx_user_study_daily_user_date ON user_study_daily(user_id, date)`,
  );

  await ensureColumn("users", "study_goal_minutes", "INTEGER NOT NULL DEFAULT 120");

  await run(`
    CREATE TABLE IF NOT EXISTS question_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subject_id TEXT NOT NULL,
      question_key TEXT NOT NULL,
      topic TEXT NOT NULL DEFAULT 'General',
      marks INTEGER NOT NULL DEFAULT 1,
      is_correct INTEGER NOT NULL,
      answered_at TEXT NOT NULL,
      UNIQUE(user_id, subject_id, question_key),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Ensure marks column exists on older DBs.
  await ensureColumn("question_attempts", "marks", "INTEGER NOT NULL DEFAULT 1");

  // Clean up expired sessions on startup
  await run(`DELETE FROM sessions WHERE expires_at < ?`, [nowIso()]);

  const userCount = await get(`SELECT COUNT(*) as count FROM users`);
  const sessionCount = await get(`SELECT COUNT(*) as count FROM sessions`);
  const chatCount = await get(`SELECT COUNT(*) as count FROM chat_messages`);
  const commentCount = await get(`SELECT COUNT(*) as count FROM quiz_comments`);
  const attemptCount = await get(`SELECT COUNT(*) as count FROM question_attempts`);

  console.log(`[DB] Ready. Users: ${userCount.count} | Sessions: ${sessionCount.count} | Chats: ${chatCount.count} | Comments: ${commentCount.count} | Attempts: ${attemptCount.count}`);
}

// ── Middleware ─────────────────────────────────────────────────────────────────

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

// Log every API request so you can see what's happening
app.use("/api", (req, _res, next) => {
  console.log(`[API] ${req.method} ${req.path}`);
  next();
});

async function authMiddleware(req, res, next) {
  try {
    const nowMs = Date.now();
    if (nowMs - lastSessionCleanupAt > 10 * 60 * 1000) {
      try {
        await run(`DELETE FROM sessions WHERE expires_at < ?`, [nowIso()]);
      } catch {
        // ignore cleanup failures
      } finally {
        lastSessionCleanupAt = nowMs;
      }
    }
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Missing auth token." });
    }

    const session = await get(
      `SELECT sessions.token, sessions.expires_at, users.id, users.email, users.username, users.profile_photo
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.token = ?`,
      [token]
    );

    if (!session) {
      console.log(`[Auth] Token not found in DB`);
      return res.status(401).json({ error: "Invalid session. Please log in again." });
    }

    if (session.expires_at && session.expires_at < nowIso()) {
      await run(`DELETE FROM sessions WHERE token = ?`, [token]);
      console.log(`[Auth] Token expired`);
      return res.status(401).json({ error: "Session expired. Please log in again." });
    }

    req.user = {
      id: session.id,
      email: session.email,
      username: session.username || session.email,
      profilePhoto: session.profile_photo || null,
      token: session.token
    };

    next();
  } catch (error) {
    console.error("[Auth] Middleware error:", error);
    res.status(500).json({ error: "Authentication failed." });
  }
}

function adminMiddleware(req, res, next) {
  const email = req.user?.email ? String(req.user.email).toLowerCase() : "";
  const adminEmail = String(ADMIN_EMAIL).toLowerCase();
  const headerKey = req.headers["x-admin-key"]
    ? String(req.headers["x-admin-key"])
    : "";

  const isAdminByEmail = !!email && email === adminEmail;
  const isAdminByKey = headerKey.trim() && headerKey.trim() === String(ADMIN_KEY);

  if (!isAdminByEmail && !isAdminByKey) {
    return res.status(403).json({ error: "Admin access denied." });
  }
  next();
}

// 30 days from now
function sessionExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + 30);
  return d.toISOString();
}

// ── Debug / health ─────────────────────────────────────────────────────────────

app.get("/api/health", async (_req, res) => {
  try {
    const userCount = await get(`SELECT COUNT(*) as count FROM users`);
    const sessionCount = await get(`SELECT COUNT(*) as count FROM sessions`);
    const chatCount = await get(`SELECT COUNT(*) as count FROM chat_messages`);
    const commentCount = await get(`SELECT COUNT(*) as count FROM quiz_comments`);
    res.json({
      ok: true,
      db: DB_PATH,
      users: userCount.count,
      sessions: sessionCount.count,
      chats: chatCount.count,
      comments: commentCount.count
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── Bootstrap ─────────────────────────────────────────────────────────────────

app.get("/api/bootstrap", authMiddleware, async (req, res) => {
  try {
    const rows = await all(`SELECT * FROM custom_questions ORDER BY subject_id, created_at ASC`);
    const customQuestions = {};
    for (const row of rows) {
      const sid = canonicalSubjectId(row.subject_id);
      if (!customQuestions[sid]) customQuestions[sid] = [];
      const marksNum = Number(row.marks);
      const marks =
        Number.isFinite(marksNum) && marksNum > 0 ? Math.round(marksNum) : 1;
      customQuestions[sid].push({
        id: row.id,
        // Normalize admin question types to the frontend's expected keys
        // (Admin UI stores: short_answer / long_answer).
        type:
          row.type === "short_answer"
            ? "short"
            : row.type === "long_answer"
              ? "long"
              : row.type,
        topic: row.topic || "General",
        question: row.question,
        imageUrls: safeJsonColumn(row.image_urls, "image_urls", row.id),
        options: safeJsonColumn(row.options, "options", row.id),
        answer: row.answer || undefined,
        acceptedAnswers: safeJsonColumn(
          row.accepted_answers,
          "accepted_answers",
          row.id,
        ),
        marks,
        guidance: row.guidance || undefined,
        passage: row.passage || undefined,
      });
    }
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        username: req.user.username,
        profilePhoto: req.user.profilePhoto || null,
      },
      customQuestions
    });
  } catch (error) {
    console.error("[Bootstrap] Error:", error);
    res.status(500).json({ error: "Could not load session." });
  }
});

function mergeStudyBySubject(existingObj, incomingObj) {
  const out = { ...existingObj };
  for (const [k, v] of Object.entries(incomingObj || {})) {
    const n = Math.max(0, Math.floor(Number(v) || 0));
    out[k] = Math.max(Math.floor(Number(out[k]) || 0), n);
  }
  return out;
}

function mergeStudyDayPayload(existingRow, incoming) {
  let exSub = {};
  try {
    exSub = JSON.parse(existingRow?.by_subject_json || "{}");
    if (!exSub || typeof exSub !== "object") exSub = {};
  } catch {
    exSub = {};
  }
  const inSub =
    typeof incoming.dailySecondsBySubject === "object" && incoming.dailySecondsBySubject !== null
      ? incoming.dailySecondsBySubject
      : {};
  const mergedSub = mergeStudyBySubject(exSub, inSub);
  const sumSub = Object.values(mergedSub).reduce(
    (a, n) => a + Math.max(0, Math.floor(Number(n) || 0)),
    0,
  );
  const inTotal = Math.max(0, Math.floor(Number(incoming.dailySeconds) || 0));
  const exTotal = Math.max(0, Math.floor(Number(existingRow?.total_seconds) || 0));
  const total = Math.max(exTotal, inTotal, sumSub);
  return { total, by_subject_json: JSON.stringify(mergedSub) };
}

async function upsertStudyDayForUser(userId, date, partial) {
  if (partial.goalMinutes !== undefined && partial.goalMinutes !== null) {
    const goalMinutes = Number(partial.goalMinutes);
    if (Number.isFinite(goalMinutes) && goalMinutes >= 1 && goalMinutes <= 480) {
      await run(`UPDATE users SET study_goal_minutes = ? WHERE id = ?`, [
        Math.round(goalMinutes),
        userId,
      ]);
    }
  }
  const existing = await get(
    `SELECT total_seconds, by_subject_json FROM user_study_daily WHERE user_id = ? AND date = ?`,
    [userId, date],
  );
  const merged = mergeStudyDayPayload(existing, {
    dailySeconds: partial.dailySeconds,
    dailySecondsBySubject: partial.dailySecondsBySubject,
  });
  const ts = nowIso();
  await run(
    `INSERT INTO user_study_daily (user_id, date, total_seconds, by_subject_json, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id, date) DO UPDATE SET
       total_seconds = excluded.total_seconds,
       by_subject_json = excluded.by_subject_json,
       updated_at = excluded.updated_at`,
    [userId, date, merged.total, merged.by_subject_json, ts],
  );
  return merged;
}

function addDaysIso(isoDate, deltaDays) {
  const parts = String(isoDate || "").split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (!y || !m || !d) return isoDate;
  const t = Date.UTC(y, m - 1, d) + deltaDays * 86400000;
  const x = new Date(t);
  return `${x.getUTCFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

function computeStudyStreakFromRows(rowsByDate, asOfDate, goalSeconds) {
  const map = {};
  for (const r of rowsByDate) {
    map[r.date] = Math.max(0, Number(r.total_seconds) || 0);
  }
  let d = asOfDate;
  let count = 0;
  for (let i = 0; i < 400; i++) {
    const sec = map[d] ?? 0;
    if (sec >= goalSeconds) count++;
    else break;
    d = addDaysIso(d, -1);
  }
  return count;
}

// ── Study daily sync (cross-device) ───────────────────────────────────────────

app.get("/api/study/daily", authMiddleware, async (req, res) => {
  try {
    const date = cleanText(req.query.date, 12);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Invalid date (use YYYY-MM-DD)." });
    }
    const row = await get(
      `SELECT date, total_seconds, by_subject_json, updated_at FROM user_study_daily WHERE user_id = ? AND date = ?`,
      [req.user.id, date],
    );
    if (!row) {
      return res.json({
        date,
        dailySeconds: 0,
        dailySecondsBySubject: {},
        updatedAt: null,
      });
    }
    let bySubject = {};
    try {
      bySubject = JSON.parse(row.by_subject_json || "{}");
      if (!bySubject || typeof bySubject !== "object") bySubject = {};
    } catch {
      bySubject = {};
    }
    res.json({
      date: row.date,
      dailySeconds: Math.max(0, Number(row.total_seconds) || 0),
      dailySecondsBySubject: bySubject,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error("[Study daily GET] Error:", error);
    res.status(500).json({ error: "Could not load study data." });
  }
});

app.put("/api/study/daily", authMiddleware, async (req, res) => {
  try {
    const date = cleanText(req.body?.date, 12);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ error: "Invalid date (use YYYY-MM-DD)." });
    }

    const merged = await upsertStudyDayForUser(req.user.id, date, {
      goalMinutes: req.body?.goalMinutes,
      dailySeconds: req.body?.dailySeconds,
      dailySecondsBySubject: req.body?.dailySecondsBySubject,
    });
    const ts = nowIso();

    let bySubject = {};
    try {
      bySubject = JSON.parse(merged.by_subject_json || "{}");
    } catch {
      bySubject = {};
    }
    res.json({
      date,
      dailySeconds: merged.total,
      dailySecondsBySubject: bySubject,
      updatedAt: ts,
    });
  } catch (error) {
    console.error("[Study daily PUT] Error:", error);
    res.status(500).json({ error: "Could not save study data." });
  }
});

app.get("/api/study/history", authMiddleware, async (req, res) => {
  try {
    const from = cleanText(req.query.from, 12);
    const to = cleanText(req.query.to, 12);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      return res.status(400).json({ error: "from and to must be YYYY-MM-DD." });
    }
    if (from > to) {
      return res.status(400).json({ error: "from must be on or before to." });
    }
    const rows = await all(
      `SELECT date, total_seconds, by_subject_json FROM user_study_daily
       WHERE user_id = ? AND date >= ? AND date <= ? ORDER BY date ASC`,
      [req.user.id, from, to],
    );
    const days = rows.map((row) => {
      let bySubject = {};
      try {
        bySubject = JSON.parse(row.by_subject_json || "{}");
        if (!bySubject || typeof bySubject !== "object") bySubject = {};
      } catch {
        bySubject = {};
      }
      return {
        date: row.date,
        dailySeconds: Math.max(0, Number(row.total_seconds) || 0),
        dailySecondsBySubject: bySubject,
      };
    });
    res.json({ days });
  } catch (error) {
    console.error("[Study history GET] Error:", error);
    res.status(500).json({ error: "Could not load study history." });
  }
});

app.post("/api/study/sync", authMiddleware, async (req, res) => {
  try {
    const days = req.body?.days;
    if (!Array.isArray(days)) {
      return res.status(400).json({ error: "Expected { days: [...] }." });
    }
    const slice = days.slice(0, 500);
    let mergedDays = 0;
    for (const d of slice) {
      const date = cleanText(d?.date, 12);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      await upsertStudyDayForUser(req.user.id, date, {
        goalMinutes: d.goalMinutes,
        dailySeconds: d.dailySeconds,
        dailySecondsBySubject: d.dailySecondsBySubject,
      });
      mergedDays++;
    }
    res.json({ ok: true, mergedDays });
  } catch (error) {
    console.error("[Study sync POST] Error:", error);
    res.status(500).json({ error: "Could not sync study history." });
  }
});

// ── Signup ─────────────────────────────────────────────────────────────────────

async function handleSignup(req, res) {
  try {
    const username = cleanText(req.body.username, 40);
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "").trim();

    if (username.length < 2) {
      return res.status(400).json({ error: "Username must be at least 2 characters." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: "Password must be at least 4 characters." });
    }

    const existing = await get(`SELECT id FROM users WHERE email = ?`, [email]);
    if (existing) {
      return res.status(400).json({ error: "An account with this email already exists." });
    }

    const existingUsername = await get(`SELECT id FROM users WHERE LOWER(username) = LOWER(?)`, [username]);
    if (existingUsername) {
      return res.status(400).json({ error: "That username is already taken." });
    }

    const { salt, hash } = hashPassword(password);
    const createdAt = nowIso();

    const result = await run(
      `INSERT INTO users (username, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)`,
      [username, email, hash, salt, createdAt]
    );

    const token = createToken();
    const expiresAt = sessionExpiry();
    await run(
      `INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
      [token, result.lastID, createdAt, expiresAt]
    );

    console.log(`[Signup] New user: ${username} <${email}> id=${result.lastID}`);

    res.json({ token, user: { id: result.lastID, username, email, profilePhoto: null } });
  } catch (error) {
    console.error("[Signup] Error:", error);
    res.status(500).json({ error: "Could not create account." });
  }
}

app.post("/api/signup", handleSignup);
app.post("/api/auth/signup", handleSignup);

// ── Login ──────────────────────────────────────────────────────────────────────

async function handleLogin(req, res) {
  try {
    const loginValue = String(req.body.email || req.body.username || "").trim().toLowerCase();
    const password = String(req.body.password || "").trim();

    if (!loginValue || !password) {
      return res.status(400).json({ error: "Please enter your email or username and password." });
    }

    // Hardcoded admin login
    if (loginValue === String(ADMIN_EMAIL).toLowerCase() && password === String(ADMIN_PASSWORD)) {
      let user = await get(
        `SELECT * FROM users WHERE LOWER(email) = ?`,
        [loginValue],
      );

      if (!user) {
        const username = "Admin";
        const { salt, hash } = hashPassword(password);
        const createdAt = nowIso();

        const result = await run(
          `INSERT INTO users (username, email, password_hash, password_salt, created_at) VALUES (?, ?, ?, ?, ?)`,
          [username, loginValue, hash, salt, createdAt],
        );

        user = await get(`SELECT * FROM users WHERE id = ?`, [result.lastID]);
      }

      const token = createToken();
      const expiresAt = sessionExpiry();
      await run(
        `INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
        [token, user.id, nowIso(), expiresAt]
      );

      res.json({
        token,
        user: {
          id: user.id,
          username: user.username || user.email,
          email: user.email,
          profilePhoto: user.profile_photo || null,
        },
      });
      return;
    }

    const user = await get(
      `SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?`,
      [loginValue, loginValue]
    );

    if (!user) {
      return res.status(400).json({ error: "Invalid login details." });
    }

    if (!user.password_salt || !user.password_hash) {
      return res.status(400).json({ error: "This account is missing password data. Please sign up again." });
    }

    const validPassword = verifyPassword(password, user.password_salt, user.password_hash);
    if (!validPassword) {
      return res.status(400).json({ error: "Invalid login details." });
    }

    const token = createToken();
    const expiresAt = sessionExpiry();
    await run(
      `INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`,
      [token, user.id, nowIso(), expiresAt]
    );

    console.log(`[Login] User: ${user.username} <${user.email}> id=${user.id}`);

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username || user.email,
        email: user.email,
        profilePhoto: user.profile_photo || null,
      },
    });
  } catch (error) {
    console.error("[Login] Error:", error);
    res.status(500).json({ error: "Could not log in." });
  }
}

app.post("/api/login", handleLogin);
app.post("/api/auth/login", handleLogin);

// ── Logout ─────────────────────────────────────────────────────────────────────

async function handleLogout(req, res) {
  try {
    await run(`DELETE FROM sessions WHERE token = ?`, [req.user.token]);
    console.log(`[Logout] User: ${req.user.email}`);
    res.json({ ok: true });
  } catch (error) {
    console.error("[Logout] Error:", error);
    res.status(500).json({ error: "Could not log out." });
  }
}

app.post("/api/logout", authMiddleware, handleLogout);
app.post("/api/auth/logout", authMiddleware, handleLogout);

app.patch("/api/auth/account", authMiddleware, async (req, res) => {
  try {
    const usernameRaw = req.body?.username;
    const currentPassword = String(req.body?.currentPassword || "").trim();
    const newPassword = String(req.body?.newPassword || "").trim();
    const profilePhotoProvided = Object.prototype.hasOwnProperty.call(req.body ?? {}, "profilePhoto");
    const profilePhotoRaw = req.body?.profilePhoto;

    const user = await get(`SELECT * FROM users WHERE id = ?`, [req.user.id]);
    if (!user) return res.status(404).json({ error: "User not found." });

    const updates = [];
    const params = [];

    if (typeof usernameRaw === "string") {
      const username = cleanText(usernameRaw, 40);
      if (username.length < 2) {
        return res.status(400).json({ error: "Username must be at least 2 characters." });
      }
      const exists = await get(
        `SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?`,
        [username, req.user.id],
      );
      if (exists) {
        return res.status(400).json({ error: "That username is already taken." });
      }
      updates.push("username = ?");
      params.push(username);
    }

    if (newPassword || currentPassword) {
      if (!newPassword || !currentPassword) {
        return res.status(400).json({ error: "Provide both current and new password." });
      }
      if (newPassword.length < 4) {
        return res.status(400).json({ error: "New password must be at least 4 characters." });
      }
      const validPassword = verifyPassword(
        currentPassword,
        user.password_salt,
        user.password_hash,
      );
      if (!validPassword) {
        return res.status(400).json({ error: "Current password is incorrect." });
      }
      const { salt, hash } = hashPassword(newPassword);
      updates.push("password_salt = ?", "password_hash = ?");
      params.push(salt, hash);
    }

    if (profilePhotoProvided) {
      const profilePhoto =
        typeof profilePhotoRaw === "string" && profilePhotoRaw.trim()
          ? String(profilePhotoRaw).trim()
          : null;
      if (profilePhoto && profilePhoto.length > 2_500_000) {
        return res.status(400).json({ error: "Profile photo is too large." });
      }
      updates.push("profile_photo = ?");
      params.push(profilePhoto);
    }

    if (!updates.length) {
      return res.json({
        user: {
          id: user.id,
          username: user.username || user.email,
          email: user.email,
          profilePhoto: user.profile_photo || null,
        },
      });
    }

    params.push(req.user.id);
    await run(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, params);
    const updated = await get(
      `SELECT id, username, email, profile_photo FROM users WHERE id = ?`,
      [req.user.id],
    );
    return res.json({
      user: {
        id: Number(updated.id),
        username: String(updated.username || updated.email),
        email: String(updated.email),
        profilePhoto: updated.profile_photo || null,
      },
    });
  } catch (error) {
    console.error("[Account PATCH] Error:", error);
    return res.status(500).json({ error: "Could not update account." });
  }
});

// ── Quiz submit ────────────────────────────────────────────────────────────────

app.post("/api/quiz/submit", authMiddleware, async (req, res) => {
  try {
    const subjectId = cleanText(req.body.subjectId, 80);
    const score = Math.max(0, Number(req.body.score || 0));
    const totalQuestions = Math.max(1, Number(req.body.totalQuestions || 0));

    if (!subjectId || totalQuestions <= 0) {
      return res.status(400).json({ error: "Invalid quiz submission." });
    }

    const percent = Math.round((score / totalQuestions) * 100);
    await run(
      `INSERT INTO quiz_attempts (user_id, subject_id, score, total_questions, percent, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, subjectId, score, totalQuestions, percent, nowIso()]
    );

    res.json({ ok: true, percent });
  } catch (error) {
    console.error("[Quiz submit] Error:", error);
    res.status(500).json({ error: "Could not save quiz score." });
  }
});

// ── Leaderboard ────────────────────────────────────────────────────────────────

app.get("/api/leaderboard/:subjectId", async (req, res) => {
  try {
    const leaderboard = await all(
      `SELECT users.username,
              MAX(quiz_attempts.percent) AS best_percent,
              MAX(quiz_attempts.score) AS best_score,
              MAX(quiz_attempts.total_questions) AS best_total,
              COUNT(quiz_attempts.id) AS attempts
       FROM quiz_attempts
       JOIN users ON users.id = quiz_attempts.user_id
       WHERE quiz_attempts.subject_id = ?
       GROUP BY quiz_attempts.user_id
       ORDER BY best_percent DESC, best_score DESC, attempts ASC, users.username ASC
       LIMIT 10`,
      [req.params.subjectId]
    );
    res.json({ leaderboard });
  } catch (error) {
    console.error("[Leaderboard] Error:", error);
    res.status(500).json({ error: "Could not load leaderboard." });
  }
});

// ── Comments ───────────────────────────────────────────────────────────────────

app.get("/api/comments/:subjectId/:questionKey", authMiddleware, async (req, res) => {
  try {
    const rows = await all(
      `SELECT quiz_comments.id, quiz_comments.parent_comment_id, quiz_comments.text, quiz_comments.image_urls,
              quiz_comments.created_at, users.username, users.id AS user_id
       FROM quiz_comments
       JOIN users ON users.id = quiz_comments.user_id
       WHERE quiz_comments.subject_id = ? AND quiz_comments.question_key = ?
       ORDER BY quiz_comments.created_at ASC, quiz_comments.id ASC`,
      [req.params.subjectId, req.params.questionKey]
    );

    res.json({
      comments: rows.map((row) => ({
        id: row.id,
        parentCommentId: row.parent_comment_id,
        text: row.text,
        imageUrls: row.image_urls ? JSON.parse(row.image_urls) : [],
        time: row.created_at,
        username: row.username,
        userId: row.user_id
      }))
    });
  } catch (error) {
    console.error("[Comments GET] Error:", error);
    res.status(500).json({ error: "Could not load comments." });
  }
});

app.post("/api/comments/:subjectId/:questionKey", authMiddleware, async (req, res) => {
  try {
    const text = cleanText(req.body.text, 1000);
    const imageUrls = Array.isArray(req.body?.imageUrls)
      ? req.body.imageUrls.map(String).map((s) => s.trim()).filter(Boolean)
      : [];
    const rawParent = req.body.parentCommentId;
    const parentCommentId =
      rawParent === null || rawParent === undefined || rawParent === ""
        ? null
        : Number(rawParent);

    if (!text && imageUrls.length === 0) {
      return res.status(400).json({ error: "Comment cannot be empty." });
    }

    if (parentCommentId !== null) {
      const parent = await get(
        `SELECT id FROM quiz_comments WHERE id = ? AND subject_id = ? AND question_key = ?`,
        [parentCommentId, req.params.subjectId, req.params.questionKey]
      );
      if (!parent) {
        return res.status(400).json({ error: "Reply target not found." });
      }
    }

    const result = await run(
      `INSERT INTO quiz_comments (subject_id, question_key, user_id, parent_comment_id, text, image_urls, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        req.params.subjectId,
        req.params.questionKey,
        req.user.id,
        parentCommentId,
        text || "",
        imageUrls.length ? JSON.stringify(imageUrls) : null,
        nowIso(),
      ]
    );

    const created = await get(
      `SELECT quiz_comments.id, quiz_comments.parent_comment_id, quiz_comments.text, quiz_comments.image_urls,
              quiz_comments.created_at, users.username, users.id AS user_id
       FROM quiz_comments
       JOIN users ON users.id = quiz_comments.user_id
       WHERE quiz_comments.id = ?`,
      [result.lastID]
    );

    console.log(`[Comment] ${req.user.username} on ${req.params.subjectId}`);

    res.json({
      comment: {
        id: created.id,
        parentCommentId: created.parent_comment_id,
        text: created.text,
        imageUrls: created.image_urls ? JSON.parse(created.image_urls) : [],
        time: created.created_at,
        username: created.username,
        userId: created.user_id
      }
    });
  } catch (error) {
    console.error("[Comments POST] Error:", error);
    res.status(500).json({ error: "Could not add comment." });
  }
});

// ── Written responses ──────────────────────────────────────────────────────────

app.get("/api/written/:subjectId/:questionKey", authMiddleware, async (req, res) => {
  try {
    const row = await get(
      `SELECT response_text, updated_at FROM written_responses
       WHERE user_id = ? AND subject_id = ? AND question_key = ?`,
      [req.user.id, req.params.subjectId, req.params.questionKey]
    );
    res.json({ response: row ? { text: row.response_text, updatedAt: row.updated_at } : null });
  } catch (error) {
    console.error("[Written GET] Error:", error);
    res.status(500).json({ error: "Could not load written response." });
  }
});

app.put("/api/written/:subjectId/:questionKey", authMiddleware, async (req, res) => {
  try {
    const responseText = cleanText(req.body.responseText, 12000);
    if (!responseText) {
      return res.status(400).json({ error: "Response cannot be empty." });
    }

    await run(
      `INSERT INTO written_responses (user_id, subject_id, question_key, response_text, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(user_id, subject_id, question_key) DO UPDATE SET
         response_text = excluded.response_text,
         updated_at = excluded.updated_at`,
      [req.user.id, req.params.subjectId, req.params.questionKey, responseText, nowIso()]
    );

    console.log(`[Written] Saved for ${req.user.username} on ${req.params.subjectId}`);
    res.json({ ok: true });
  } catch (error) {
    console.error("[Written PUT] Error:", error);
    res.status(500).json({ error: "Could not save written response." });
  }
});

app.get("/api/written/:subjectId/:questionKey/all", authMiddleware, async (req, res) => {
  try {
    const rows = await all(
      `SELECT written_responses.response_text, written_responses.updated_at,
              users.id AS user_id
       FROM written_responses
       JOIN users ON users.id = written_responses.user_id
       WHERE written_responses.subject_id = ? AND written_responses.question_key = ?
       ORDER BY written_responses.updated_at DESC`,
      [req.params.subjectId, req.params.questionKey]
    );

    res.json({
      responses: rows.map((row) => ({
        text: row.response_text,
        updatedAt: row.updated_at,
        userId: row.user_id
      }))
    });
  } catch (error) {
    console.error("[Written ALL] Error:", error);
    res.status(500).json({ error: "Could not load written responses." });
  }
});

// ── English writing mode (books + prompts + shared responses) ─────────────────

app.post("/api/admin/english/prompts/bulk", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    if (!rows.length) {
      return res.status(400).json({ error: "rows must be a non-empty array." });
    }

    let importedBooks = 0;
    let importedPrompts = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] || {};
      const section = normalizeEnglishSection(r.section ?? r.area ?? r.part);
      let book = cleanText(r.book ?? r.bookTitle ?? r.title, 180);
      book = book.replace(/\s*##\s*$/g, "").trim();
      const prompt = cleanText(r.prompt ?? r.question ?? r.promptText, 20000);
      const effectiveSection = section === "B" ? "B" : "A";
      if (effectiveSection === "A") {
        if (!book || !prompt) {
          errors.push({ index: i, message: "section A requires book and prompt." });
          continue;
        }
        const bookWordCount = book.split(/\s+/).filter(Boolean).length;
        const hasSentencePunctuation = /[.!?]/.test(book);
        if (bookWordCount > 12 || hasSentencePunctuation) {
          errors.push({
            index: i,
            message:
              "section A book looks malformed. Use full title only (no sentence text) and keep prompts in prompt column.",
          });
          continue;
        }
      } else {
        if (!prompt) {
          errors.push({ index: i, message: "section B requires prompt." });
          continue;
        }
        // Section B never maps to set-text books.
        book = "Section B Creative";
      }

      await run(
        `INSERT INTO english_books (title, created_at)
         VALUES (?, ?)
         ON CONFLICT(title) DO NOTHING`,
        [book, nowIso()],
      );

      const b = await get(`SELECT id FROM english_books WHERE title = ?`, [book]);
      const bookId = Number(b?.id);
      if (!Number.isFinite(bookId) || bookId <= 0) {
        errors.push({ index: i, message: "Could not resolve book id." });
        continue;
      }

      const existing = await get(
        `SELECT id FROM english_prompts WHERE book_id = ? AND lower(trim(prompt_text)) = lower(trim(?))`,
        [bookId, prompt],
      );
      if (existing?.id) continue;

      await run(
        `INSERT INTO english_prompts (book_id, prompt_text, section, created_at) VALUES (?, ?, ?, ?)`,
        [bookId, prompt, effectiveSection, nowIso()],
      );
      importedPrompts++;
    }

    const countBooks = await get(`SELECT COUNT(*) AS c FROM english_books`);
    importedBooks = Number(countBooks?.c ?? 0);
    res.json({ ok: errors.length === 0, importedBooks, importedPrompts, errors });
  } catch (error) {
    console.error("[Admin English bulk prompts] Error:", error);
    res.status(500).json({ error: "Could not import English prompts." });
  }
});

app.get("/api/admin/english/prompts", authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const rows = await all(
      `SELECT p.id, p.section, p.prompt_text, b.title AS book_title
       FROM english_prompts p
       JOIN english_books b ON b.id = p.book_id
       ORDER BY p.section ASC, b.title COLLATE NOCASE ASC, p.id ASC`,
    );
    res.json({
      prompts: rows.map((r) => ({
        id: Number(r.id),
        section: normalizeEnglishSection(r.section),
        book: String(r.book_title || ""),
        prompt: String(r.prompt_text || ""),
      })),
    });
  } catch (error) {
    console.error("[Admin English prompts GET] Error:", error);
    res.status(500).json({ error: "Could not load English prompts." });
  }
});

app.get("/api/english/books", async (req, res) => {
  try {
    const section = normalizeEnglishSection(req.query.section);
    const rows = await all(
      `SELECT b.id, b.title,
              SUM(CASE WHEN SUBSTR(TRIM(REPLACE(UPPER(COALESCE(p.section, '')), 'SECTION ', '')), 1, 1) = 'A' THEN 1 ELSE 0 END) AS prompt_count_a,
              SUM(CASE WHEN SUBSTR(TRIM(REPLACE(UPPER(COALESCE(p.section, '')), 'SECTION ', '')), 1, 1) = 'B' THEN 1 ELSE 0 END) AS prompt_count_b,
              SUM(CASE WHEN SUBSTR(TRIM(REPLACE(UPPER(COALESCE(p.section, '')), 'SECTION ', '')), 1, 1) = 'C' THEN 1 ELSE 0 END) AS prompt_count_c
       FROM english_books b
       LEFT JOIN english_prompts p ON p.book_id = b.id
       GROUP BY b.id, b.title
       ORDER BY b.title COLLATE NOCASE ASC`,
    );
    const mapped = rows.map((r) => {
      const countA = Number(r.prompt_count_a || 0);
      const countB = Number(r.prompt_count_b || 0);
      const countC = Number(r.prompt_count_c || 0);
      const totalPromptCount = countA + countB + countC;
      return {
        id: Number(r.id),
        title: String(r.title),
        promptCount: section === "A" ? countA : section === "B" ? countB : countC,
        totalPromptCount,
      };
    });
    const sectionScoped = mapped.filter((r) => r.promptCount > 0);
    const booksToShow =
      sectionScoped.length > 0
        ? sectionScoped
        : mapped
            .filter((r) => r.totalPromptCount > 0)
            .map((r) => ({ ...r, promptCount: r.totalPromptCount }));
    res.json({
      books: booksToShow.map((r) => ({
        id: r.id,
        title: r.title,
        promptCount: r.promptCount,
      })),
    });
  } catch (error) {
    console.error("[English books GET] Error:", error);
    res.status(500).json({ error: "Could not load books." });
  }
});

app.get("/api/english/prompts", async (req, res) => {
  try {
    const section = normalizeEnglishSection(req.query.section);
    const bookId = Number(req.query.bookId);
    let rows = [];
    if (section === "A") {
      if (Number.isFinite(bookId) && bookId > 0) {
        rows = await all(
          `SELECT p.id, p.prompt_text, p.section, b.id AS book_id, b.title AS book_title
           FROM english_prompts p
           JOIN english_books b ON b.id = p.book_id
           WHERE p.book_id = ? AND SUBSTR(TRIM(REPLACE(UPPER(COALESCE(p.section, '')), 'SECTION ', '')), 1, 1) = 'A'
           ORDER BY p.id ASC`,
          [bookId],
        );
        if (!rows.length) {
          rows = await all(
            `SELECT p.id, p.prompt_text, p.section, b.id AS book_id, b.title AS book_title
             FROM english_prompts p
             JOIN english_books b ON b.id = p.book_id
             WHERE p.book_id = ?
             ORDER BY p.id ASC`,
            [bookId],
          );
        }
      } else {
        rows = await all(
          `SELECT p.id, p.prompt_text, p.section, b.id AS book_id, b.title AS book_title
           FROM english_prompts p
           JOIN english_books b ON b.id = p.book_id
           WHERE SUBSTR(TRIM(REPLACE(UPPER(COALESCE(p.section, '')), 'SECTION ', '')), 1, 1) = 'A'
           ORDER BY p.id ASC`,
        );
      }
    } else {
      rows = await all(
        `SELECT p.id, p.prompt_text, p.section, b.id AS book_id, b.title AS book_title
         FROM english_prompts p
         JOIN english_books b ON b.id = p.book_id
         WHERE SUBSTR(TRIM(REPLACE(UPPER(COALESCE(p.section, '')), 'SECTION ', '')), 1, 1) = UPPER(?)
         ORDER BY p.id ASC`,
        [section],
      );
    }
    res.json({
      prompts: rows.map((r) => ({
        id: Number(r.id),
        bookId: Number(r.book_id),
        bookTitle: String(r.book_title),
        prompt: String(r.prompt_text),
        section: String(r.section || section),
      })),
    });
  } catch (error) {
    console.error("[English prompts GET] Error:", error);
    res.status(500).json({ error: "Could not load prompts." });
  }
});

app.post("/api/english/responses", authMiddleware, async (req, res) => {
  try {
    const promptId = Number(req.body?.promptId);
    const responseTypeRaw = cleanText(req.body?.responseType, 40).toLowerCase();
    const responseType = responseTypeRaw === "paragraph" ? "paragraph" : "essay";
    const responseText = cleanText(req.body?.responseText, 20000);
    const imageUrlsInput = Array.isArray(req.body?.imageUrls) ? req.body.imageUrls : [];
    const imageUrls = imageUrlsInput
      .map((u) => String(u || "").trim())
      .filter(Boolean)
      .slice(0, 8);
    const imageUrlsJson = imageUrls.length ? JSON.stringify(imageUrls) : null;

    if (!Number.isFinite(promptId) || promptId <= 0) {
      return res.status(400).json({ error: "promptId is required." });
    }
    if (!responseText && !imageUrls.length) {
      return res.status(400).json({ error: "Provide response text or at least one image." });
    }

    const p = await get(`SELECT id FROM english_prompts WHERE id = ?`, [promptId]);
    if (!p?.id) return res.status(404).json({ error: "Prompt not found." });

    await run(
      `INSERT INTO english_responses (prompt_id, user_id, response_type, response_text, image_urls, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [promptId, req.user.id, responseType, responseText || "", imageUrlsJson, nowIso(), nowIso()],
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("[English response POST] Error:", error);
    res.status(500).json({ error: "Could not save response." });
  }
});

app.get("/api/english/responses", authMiddleware, async (req, res) => {
  try {
    const section = normalizeEnglishSection(req.query.section);
    const bookId = Number(req.query.bookId);
    const rows =
      section === "A"
        ? Number.isFinite(bookId) && bookId > 0
          ? await all(
              `SELECT r.id, r.prompt_id, r.user_id, r.response_type, r.response_text, r.image_urls, r.updated_at,
                      p.prompt_text, p.section, u.username,
                      AVG(rr.score) AS avg_score,
                      COUNT(rr.id) AS rating_count
               FROM english_responses r
               JOIN english_prompts p ON p.id = r.prompt_id
               JOIN english_books b ON b.id = p.book_id
               JOIN users u ON u.id = r.user_id
               LEFT JOIN english_response_ratings rr ON rr.response_id = r.id
               WHERE b.id = ? AND SUBSTR(TRIM(REPLACE(UPPER(COALESCE(p.section, '')), 'SECTION ', '')), 1, 1) = 'A'
               GROUP BY r.id
               ORDER BY r.updated_at DESC`,
              [bookId],
            )
          : await all(
              `SELECT r.id, r.prompt_id, r.user_id, r.response_type, r.response_text, r.image_urls, r.updated_at,
                      p.prompt_text, p.section, u.username,
                      AVG(rr.score) AS avg_score,
                      COUNT(rr.id) AS rating_count
               FROM english_responses r
               JOIN english_prompts p ON p.id = r.prompt_id
               JOIN users u ON u.id = r.user_id
               LEFT JOIN english_response_ratings rr ON rr.response_id = r.id
               WHERE SUBSTR(TRIM(REPLACE(UPPER(COALESCE(p.section, '')), 'SECTION ', '')), 1, 1) = 'A'
               GROUP BY r.id
               ORDER BY r.updated_at DESC`,
            )
        : await all(
            `SELECT r.id, r.prompt_id, r.user_id, r.response_type, r.response_text, r.image_urls, r.updated_at,
                    p.prompt_text, p.section, u.username,
                    AVG(rr.score) AS avg_score,
                    COUNT(rr.id) AS rating_count
             FROM english_responses r
             JOIN english_prompts p ON p.id = r.prompt_id
             JOIN users u ON u.id = r.user_id
             LEFT JOIN english_response_ratings rr ON rr.response_id = r.id
             WHERE SUBSTR(TRIM(REPLACE(UPPER(COALESCE(p.section, '')), 'SECTION ', '')), 1, 1) = UPPER(?)
             GROUP BY r.id
             ORDER BY r.updated_at DESC`,
            [section],
          );

    const myRatings = await all(
      `SELECT response_id, score
       FROM english_response_ratings
       WHERE rater_user_id = ?`,
      [req.user.id],
    );
    const myMap = new Map(myRatings.map((r) => [Number(r.response_id), Number(r.score)]));

    res.json({
      responses: rows.map((r) => ({
        id: Number(r.id),
        promptId: Number(r.prompt_id),
        prompt: String(r.prompt_text),
        section: String(r.section || section),
        userId: Number(r.user_id),
        username: String(r.username),
        responseType: String(r.response_type || "essay"),
        responseText: String(r.response_text || ""),
        imageUrls: safeJsonColumn(r.image_urls, "english.image_urls", r.id) || [],
        updatedAt: r.updated_at,
        averageScore:
          Number(r.rating_count || 0) > 0 && r.avg_score != null
            ? Math.round(Number(r.avg_score) * 10) / 10
            : null,
        ratingCount: Number(r.rating_count || 0),
        myScore: myMap.get(Number(r.id)) ?? null,
      })),
    });
  } catch (error) {
    console.error("[English responses GET] Error:", error);
    res.status(500).json({ error: "Could not load responses." });
  }
});

app.post("/api/english/responses/:id/rate", authMiddleware, async (req, res) => {
  try {
    const responseId = Number(req.params.id);
    const score = Number(req.body?.score);
    if (!Number.isFinite(responseId) || responseId <= 0) {
      return res.status(400).json({ error: "response id is required." });
    }
    if (!Number.isFinite(score) || score < 1 || score > 10 || score !== Math.floor(score)) {
      return res.status(400).json({ error: "score must be an integer from 1 to 10." });
    }
    const target = await get(`SELECT user_id FROM english_responses WHERE id = ?`, [responseId]);
    if (!target?.user_id) return res.status(404).json({ error: "Response not found." });
    if (Number(target.user_id) === req.user.id) {
      return res.status(400).json({ error: "You cannot rate your own response." });
    }
    await run(
      `INSERT INTO english_response_ratings (response_id, rater_user_id, score, created_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(response_id, rater_user_id) DO UPDATE SET
         score = excluded.score`,
      [responseId, req.user.id, score, nowIso()],
    );
    res.json({ ok: true });
  } catch (error) {
    console.error("[English rate POST] Error:", error);
    res.status(500).json({ error: "Could not save rating." });
  }
});

// ── Chat ───────────────────────────────────────────────────────────────────────

app.get("/api/chat/:subjectId", authMiddleware, async (req, res) => {
  try {
    const rows = await all(
      `SELECT id, user_id, username, text, created_at FROM chat_messages
       WHERE subject_id = ? ORDER BY created_at ASC, id ASC LIMIT 200`,
      [req.params.subjectId]
    );
    res.json({
      messages: rows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        username: r.username,
        text: r.text,
        time: r.created_at
      }))
    });
  } catch (error) {
    console.error("[Chat GET] Error:", error);
    res.status(500).json({ error: "Could not load chat." });
  }
});

app.post("/api/chat/:subjectId", authMiddleware, async (req, res) => {
  try {
    const text = cleanText(req.body.text, 1000);
    if (!text) return res.status(400).json({ error: "Message cannot be empty." });

    const result = await run(
      `INSERT INTO chat_messages (subject_id, user_id, username, text, created_at) VALUES (?, ?, ?, ?, ?)`,
      [req.params.subjectId, req.user.id, req.user.username, text, nowIso()]
    );

    console.log(`[Chat] ${req.user.username} → ${req.params.subjectId}`);

    res.json({
      message: {
        id: result.lastID,
        userId: req.user.id,
        username: req.user.username,
        text,
        time: nowIso()
      }
    });
  } catch (error) {
    console.error("[Chat POST] Error:", error);
    res.status(500).json({ error: "Could not send message." });
  }
});

// ── Forum (posts + replies) ────────────────────────────────────────────────────

app.get("/api/forum/:subjectId/posts", authMiddleware, async (req, res) => {
  try {
    const subjectId = req.params.subjectId;
    const rows = await all(
      `
      SELECT
        p.id,
        p.subject_id,
        p.user_id,
        p.username,
        p.title,
        p.body,
        p.image_urls,
        p.created_at,
        p.updated_at,
        (SELECT COUNT(*) FROM forum_replies r WHERE r.post_id = p.id) AS reply_count,
        (
          SELECT MAX(created_at) FROM (
            SELECT p.updated_at AS created_at
            UNION ALL
            SELECT r.created_at AS created_at FROM forum_replies r WHERE r.post_id = p.id
          )
        ) AS last_activity_at
      FROM forum_posts p
      WHERE p.subject_id = ?
      ORDER BY last_activity_at DESC, p.id DESC
      LIMIT 200
      `,
      [subjectId]
    );

    res.json({
      posts: rows.map((r) => ({
        id: String(r.id),
        subjectId: r.subject_id,
        userId: String(r.user_id),
        username: r.username,
        title: r.title,
        body: r.body,
        imageUrls: r.image_urls ? JSON.parse(r.image_urls) : undefined,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        replyCount: Number(r.reply_count ?? 0),
        lastActivityAt: r.last_activity_at || r.updated_at
      }))
    });
  } catch (error) {
    console.error("[Forum posts GET] Error:", error);
    res.status(500).json({ error: "Could not load forum posts." });
  }
});

app.post("/api/forum/:subjectId/posts", authMiddleware, async (req, res) => {
  try {
    const subjectId = req.params.subjectId;
    const title = cleanText(req.body.title, 140);
    const body = cleanText(req.body.body, 4000);
    if (!title) return res.status(400).json({ error: "Title is required." });
    if (!body) return res.status(400).json({ error: "Post text is required." });

    const imageUrlsRaw = Array.isArray(req.body.imageUrls) ? req.body.imageUrls : null;
    const imageUrls = imageUrlsRaw
      ? imageUrlsRaw
          .map((u) => String(u || "").trim())
          .filter(Boolean)
          .slice(0, 6)
      : null;
    const imageUrlsJson = imageUrls && imageUrls.length ? JSON.stringify(imageUrls) : null;

    const createdAt = nowIso();
    const result = await run(
      `INSERT INTO forum_posts (subject_id, user_id, username, title, body, image_urls, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [subjectId, req.user.id, req.user.username, title, body, imageUrlsJson, createdAt, createdAt]
    );

    res.json({
      post: {
        id: String(result.lastID),
        subjectId,
        userId: String(req.user.id),
        username: req.user.username,
        title,
        body,
        imageUrls: imageUrls ?? undefined,
        createdAt,
        updatedAt: createdAt,
        replyCount: 0,
        lastActivityAt: createdAt
      }
    });
  } catch (error) {
    console.error("[Forum posts POST] Error:", error);
    res.status(500).json({ error: "Could not create post." });
  }
});

app.get("/api/forum/:subjectId/posts/:postId", authMiddleware, async (req, res) => {
  try {
    const subjectId = req.params.subjectId;
    const postId = Number(req.params.postId);
    if (!postId || Number.isNaN(postId)) return res.status(400).json({ error: "Invalid post id." });

    const post = await get(
      `SELECT id, subject_id, user_id, username, title, body, image_urls, created_at, updated_at
       FROM forum_posts
       WHERE id = ? AND subject_id = ?`,
      [postId, subjectId]
    );
    if (!post) return res.status(404).json({ error: "Post not found." });

    const replies = await all(
      `SELECT id, post_id, user_id, username, body, created_at
       FROM forum_replies
       WHERE post_id = ? AND subject_id = ?
       ORDER BY created_at ASC, id ASC
       LIMIT 500`,
      [postId, subjectId]
    );

    res.json({
      post: {
        id: String(post.id),
        subjectId: post.subject_id,
        userId: String(post.user_id),
        username: post.username,
        title: post.title,
        body: post.body,
        imageUrls: post.image_urls ? JSON.parse(post.image_urls) : undefined,
        createdAt: post.created_at,
        updatedAt: post.updated_at
      },
      replies: replies.map((r) => ({
        id: String(r.id),
        postId: String(r.post_id),
        userId: String(r.user_id),
        username: r.username,
        body: r.body,
        createdAt: r.created_at
      }))
    });
  } catch (error) {
    console.error("[Forum post GET] Error:", error);
    res.status(500).json({ error: "Could not load post." });
  }
});

app.post("/api/forum/:subjectId/posts/:postId/replies", authMiddleware, async (req, res) => {
  try {
    const subjectId = req.params.subjectId;
    const postId = Number(req.params.postId);
    if (!postId || Number.isNaN(postId)) return res.status(400).json({ error: "Invalid post id." });

    const body = cleanText(req.body.body, 4000);
    if (!body) return res.status(400).json({ error: "Reply text is required." });

    const post = await get(
      `SELECT id FROM forum_posts WHERE id = ? AND subject_id = ?`,
      [postId, subjectId]
    );
    if (!post) return res.status(404).json({ error: "Post not found." });

    const createdAt = nowIso();
    const result = await run(
      `INSERT INTO forum_replies (post_id, subject_id, user_id, username, body, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [postId, subjectId, req.user.id, req.user.username, body, createdAt]
    );

    await run(`UPDATE forum_posts SET updated_at = ? WHERE id = ?`, [createdAt, postId]);

    res.json({
      reply: {
        id: String(result.lastID),
        postId: String(postId),
        userId: String(req.user.id),
        username: req.user.username,
        body,
        createdAt
      }
    });
  } catch (error) {
    console.error("[Forum replies POST] Error:", error);
    res.status(500).json({ error: "Could not add reply." });
  }
});

// ── Dojo (PvP battles) ───────────────────────────────────────────────────────

function normalizeAnswerForDojo(text) {
  if (typeof text !== "string") return "";
  return text.trim().toLowerCase().replace(/[.,;:!?]+$/, "");
}

function isQuestionCorrect(question, answerText, selectedOption) {
  if (!question) return false;
  const qType = String(question.type ?? "");
  if (qType === "mcq") {
    const correct = String(question.answer ?? "");
    const sub = selectedOption != null ? String(selectedOption) : String(answerText ?? "");
    return normalizeAnswerForDojo(sub) === normalizeAnswerForDojo(correct);
  }

  if (qType === "short" || qType === "short_answer") {
    const accepted = Array.isArray(question.acceptedAnswers)
      ? question.acceptedAnswers
      : Array.isArray(question.accepted_answers)
        ? question.accepted_answers
        : [];
    const sub = normalizeAnswerForDojo(String(answerText ?? ""));
    if (!sub) return false;
    return accepted.some((a) => normalizeAnswerForDojo(String(a)) === sub);
  }

  return false;
}

function serializeQuestionSet(questionSet) {
  return JSON.stringify(questionSet ?? []);
}

function pickCurrentQuestion(battle, now) {
  const questionSet = JSON.parse(battle.question_set ?? "[]");
  const currentIndex = Number(battle.current_index ?? 0);
  const question = questionSet[currentIndex] ?? null;
  const startedAt = new Date(battle.question_started_at);
  const elapsedSeconds = isNaN(startedAt.getTime())
    ? 0
    : Math.floor((now.getTime() - startedAt.getTime()) / 1000);
  const timePerQuestion = 30;
  const timeRemainingSeconds = Math.max(0, timePerQuestion - elapsedSeconds);
  return { questionSet, currentIndex, question, timeRemainingSeconds, timePerQuestion };
}

function advanceBattleIfExpired(db, battleRow) {
  return (async () => {
    const now = new Date();
    let battle = battleRow;
    const { questionSet, timeRemainingSeconds, currentIndex } = pickCurrentQuestion(battle, now);

    if (battle.status !== "active") return battle;
    if (timeRemainingSeconds > 0) return battle;

    // Auto-advance until the current question has remaining time
    // or we reach the end.
    while (battle.status === "active") {
      const idx = Number(battle.current_index ?? 0);
      if (idx >= 10) {
        battle.status = "completed";
        break;
      }
      battle = await db.get(
        `SELECT * FROM dojo_battles WHERE id = ?`,
        [battle.id],
      );
      const info = pickCurrentQuestion(battle, now);
      if (info.timeRemainingSeconds > 0) break;
      const nextIndex = idx + 1;
      if (nextIndex >= 10) {
        const p1 = Number(battle.player1_score ?? 0);
        const p2 = Number(battle.player2_score ?? 0);
        const winnerId = p1 === p2 ? null : p1 > p2 ? battle.player1_id : battle.player2_id;
        await run(
          `UPDATE dojo_battles SET current_index = ?, status = 'completed', winner_id = ?, updated_at = ? WHERE id = ?`,
          [nextIndex, winnerId, nowIso(), battle.id],
        );
        battle = await get(`SELECT * FROM dojo_battles WHERE id = ?`, [battle.id]);
        break;
      }

      await run(
        `UPDATE dojo_battles SET current_index = ?, question_started_at = ?, updated_at = ? WHERE id = ?`,
        [nextIndex, nowIso(), nowIso(), battle.id],
      );
      battle = await get(`SELECT * FROM dojo_battles WHERE id = ?`, [battle.id]);
    }

    return battle;
  })();
}

app.get("/api/dojo/unread-count", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const row = await get(
      `SELECT COUNT(*) as c FROM dojo_challenges WHERE opponent_id = ? AND status = 'pending' AND opponent_read = 0`,
      [userId],
    );
    res.json({ count: Number(row?.c ?? 0) });
  } catch (error) {
    console.error("[Dojo unread-count] Error:", error);
    res.status(500).json({ error: "Could not load dojo notifications." });
  }
});

app.get("/api/dojo/challenges", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const rows = await all(
      `SELECT c.id, c.challenger_id, u.username as challenger_username, c.subject_id, c.topic, c.created_at, c.opponent_read
       FROM dojo_challenges c
       JOIN users u ON u.id = c.challenger_id
       WHERE c.opponent_id = ? AND c.status = 'pending'
       ORDER BY c.created_at DESC
       LIMIT 50`,
      [userId],
    );
    res.json({
      challenges: rows.map((r) => ({
        id: String(r.id),
        challengerId: String(r.challenger_id),
        challengerUsername: r.challenger_username,
        subjectId: r.subject_id,
        topic: r.topic,
        createdAt: r.created_at,
        opponentRead: Number(r.opponent_read ?? 0) === 1,
      })),
    });
  } catch (error) {
    console.error("[Dojo challenges GET] Error:", error);
    res.status(500).json({ error: "Could not load dojo challenges." });
  }
});

// ── Friends ───────────────────────────────────────────────────────────────────

function friendshipPair(a, b) {
  const x = Number(a);
  const y = Number(b);
  return x < y ? [x, y] : [y, x];
}

function normalizeAnswerForFriends(text) {
  if (typeof text !== "string") return "";
  return text.trim().toLowerCase().replace(/[.,;:!?]+$/, "");
}

function scoreAssignedQuestion(question, answerPayload) {
  const qType = String(question?.type ?? "").trim().toLowerCase();
  if (qType === "mcq") {
    const correct = String(question?.answer ?? "");
    const chosen =
      answerPayload && typeof answerPayload === "object" && "selectedOption" in answerPayload
        ? String(answerPayload.selectedOption ?? "")
        : String(answerPayload?.answerText ?? answerPayload?.answer ?? "");
    if (!chosen) return null;
    return normalizeAnswerForFriends(chosen) === normalizeAnswerForFriends(correct);
  }
  if (qType === "short" || qType === "short_answer") {
    const accepted = Array.isArray(question?.acceptedAnswers)
      ? question.acceptedAnswers
      : Array.isArray(question?.accepted_answers)
        ? question.accepted_answers
        : [];
    const sub = normalizeAnswerForFriends(
      String(
        (answerPayload && typeof answerPayload === "object" && "answerText" in answerPayload
          ? answerPayload.answerText
          : answerPayload?.answer) ?? "",
      ),
    );
    if (!sub) return null;
    return accepted.some((a) => normalizeAnswerForFriends(String(a)) === sub);
  }
  // long answers are not auto-scored
  return null;
}

app.get("/api/friends", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const rows = await all(
      `SELECT f.user1_id, f.user2_id, f.created_at,
              u.id as friend_id, u.username as friend_username, u.email as friend_email
       FROM friendships f
       JOIN users u ON u.id = CASE WHEN f.user1_id = ? THEN f.user2_id ELSE f.user1_id END
       WHERE f.user1_id = ? OR f.user2_id = ?
       ORDER BY f.created_at DESC`,
      [userId, userId, userId],
    );
    res.json({
      friends: (rows ?? []).map((r) => ({
        userId: Number(r.friend_id),
        username: String(r.friend_username || ""),
        email: String(r.friend_email || ""),
        since: r.created_at,
      })),
    });
  } catch (error) {
    console.error("[Friends list] Error:", error);
    res.status(500).json({ error: "Could not load friends." });
  }
});

app.get("/api/friends/requests", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const incoming = await all(
      `SELECT fr.id, fr.from_user_id, fr.to_user_id, fr.status, fr.created_at,
              u.username as from_username, u.email as from_email
       FROM friend_requests fr
       JOIN users u ON u.id = fr.from_user_id
       WHERE fr.to_user_id = ? AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [userId],
    );
    const outgoing = await all(
      `SELECT fr.id, fr.from_user_id, fr.to_user_id, fr.status, fr.created_at,
              u.username as to_username, u.email as to_email
       FROM friend_requests fr
       JOIN users u ON u.id = fr.to_user_id
       WHERE fr.from_user_id = ? AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [userId],
    );
    res.json({
      incoming: (incoming ?? []).map((r) => ({
        requestId: Number(r.id),
        userId: Number(r.from_user_id),
        username: String(r.from_username || ""),
        email: String(r.from_email || ""),
        createdAt: r.created_at,
      })),
      outgoing: (outgoing ?? []).map((r) => ({
        requestId: Number(r.id),
        userId: Number(r.to_user_id),
        username: String(r.to_username || ""),
        email: String(r.to_email || ""),
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    console.error("[Friends requests] Error:", error);
    res.status(500).json({ error: "Could not load friend requests." });
  }
});

app.get("/api/friends/unread-count", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const row = await get(
      `SELECT COUNT(*) as c FROM friend_requests WHERE to_user_id = ? AND status = 'pending'`,
      [userId],
    );
    res.json({ count: Number(row?.c ?? 0) });
  } catch (error) {
    console.error("[Friends unread-count] Error:", error);
    res.status(500).json({ error: "Could not load friend notifications." });
  }
});

app.post("/api/friends/requests/read", authMiddleware, async (_req, res) => {
  // For now, count is based on pending requests (no separate read flag).
  res.json({ ok: true });
});

app.get("/api/friends/search", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const q = cleanText(req.query.search || req.query.q || "", 120);
    if (!q) return res.json({ users: [] });
    const like = `%${q.toLowerCase()}%`;
    const rows = await all(
      `SELECT id, username, email
       FROM users
       WHERE id != ?
         AND (LOWER(username) LIKE ? OR LOWER(email) LIKE ?)
       ORDER BY username ASC
       LIMIT 20`,
      [userId, like, like],
    );
    res.json({
      users: (rows ?? []).map((r) => ({
        userId: Number(r.id),
        username: String(r.username || ""),
        email: String(r.email || ""),
      })),
    });
  } catch (error) {
    console.error("[Friends search] Error:", error);
    res.status(500).json({ error: "Could not search users." });
  }
});

app.post("/api/friends/requests", authMiddleware, async (req, res) => {
  try {
    const fromUserId = Number(req.user.id);
    const toUserId = Number(req.body.toUserId ?? 0);
    if (!toUserId || toUserId === fromUserId) {
      return res.status(400).json({ error: "Invalid user." });
    }
    // Already friends?
    const [u1, u2] = friendshipPair(fromUserId, toUserId);
    const existsFriend = await get(
      `SELECT id FROM friendships WHERE user1_id = ? AND user2_id = ?`,
      [u1, u2],
    );
    if (existsFriend) return res.json({ ok: true, status: "already_friends" });

    // If reverse pending request exists, accept immediately.
    const reverse = await get(
      `SELECT id FROM friend_requests WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'`,
      [toUserId, fromUserId],
    );
    if (reverse) {
      await run(
        `UPDATE friend_requests SET status = 'accepted', responded_at = ? WHERE id = ?`,
        [nowIso(), reverse.id],
      );
      await run(
        `INSERT OR IGNORE INTO friendships (user1_id, user2_id, created_at) VALUES (?, ?, ?)`,
        [u1, u2, nowIso()],
      );
      return res.json({ ok: true, status: "accepted" });
    }

    const existing = await get(
      `SELECT id, status FROM friend_requests WHERE from_user_id = ? AND to_user_id = ?`,
      [fromUserId, toUserId],
    );
    if (existing && existing.status === "pending") {
      return res.json({ ok: true, status: "requested" });
    }

    if (existing) {
      await run(
        `UPDATE friend_requests SET status = 'pending', created_at = ?, responded_at = NULL WHERE id = ?`,
        [nowIso(), existing.id],
      );
      return res.json({ ok: true, status: "requested" });
    }

    const r = await run(
      `INSERT INTO friend_requests (from_user_id, to_user_id, status, created_at) VALUES (?, ?, 'pending', ?)`,
      [fromUserId, toUserId, nowIso()],
    );
    res.json({ ok: true, status: "requested", requestId: r.lastID });
  } catch (error) {
    console.error("[Friends request] Error:", error);
    res.status(500).json({ error: "Could not send friend request." });
  }
});

app.post("/api/friends/requests/:requestId/accept", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const requestId = Number(req.params.requestId);
    const fr = await get(`SELECT * FROM friend_requests WHERE id = ?`, [requestId]);
    if (!fr) return res.status(404).json({ error: "Not found." });
    if (Number(fr.to_user_id) !== userId) return res.status(403).json({ error: "Forbidden." });
    if (String(fr.status) !== "pending") return res.json({ ok: true, status: fr.status });
    await run(`UPDATE friend_requests SET status = 'accepted', responded_at = ? WHERE id = ?`, [nowIso(), requestId]);
    const [u1, u2] = friendshipPair(fr.from_user_id, fr.to_user_id);
    await run(
      `INSERT OR IGNORE INTO friendships (user1_id, user2_id, created_at) VALUES (?, ?, ?)`,
      [u1, u2, nowIso()],
    );
    res.json({ ok: true });
  } catch (error) {
    console.error("[Friends accept] Error:", error);
    res.status(500).json({ error: "Could not accept request." });
  }
});

app.post("/api/friends/requests/:requestId/reject", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const requestId = Number(req.params.requestId);
    const fr = await get(`SELECT * FROM friend_requests WHERE id = ?`, [requestId]);
    if (!fr) return res.status(404).json({ error: "Not found." });
    if (Number(fr.to_user_id) !== userId) return res.status(403).json({ error: "Forbidden." });
    if (String(fr.status) !== "pending") return res.json({ ok: true, status: fr.status });
    await run(`UPDATE friend_requests SET status = 'rejected', responded_at = ? WHERE id = ?`, [nowIso(), requestId]);
    res.json({ ok: true });
  } catch (error) {
    console.error("[Friends reject] Error:", error);
    res.status(500).json({ error: "Could not reject request." });
  }
});

app.get("/api/friends/:friendId/thread", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const friendId = Number(req.params.friendId);
    if (!friendId || friendId === userId) return res.status(400).json({ error: "Invalid." });
    // Must be friends
    const [u1, u2] = friendshipPair(userId, friendId);
    const ok = await get(`SELECT id FROM friendships WHERE user1_id = ? AND user2_id = ?`, [u1, u2]);
    if (!ok) return res.status(403).json({ error: "Not friends." });

    const rows = await all(
      `SELECT fa.*, uf.username as from_username, ut.username as to_username
       FROM friend_assignments fa
       JOIN users uf ON uf.id = fa.from_user_id
       JOIN users ut ON ut.id = fa.to_user_id
       WHERE (fa.from_user_id = ? AND fa.to_user_id = ?)
          OR (fa.from_user_id = ? AND fa.to_user_id = ?)
       ORDER BY fa.created_at ASC, fa.id ASC
       LIMIT 500`,
      [userId, friendId, friendId, userId],
    );
    res.json({
      messages: (rows ?? []).map((r) => ({
        id: Number(r.id),
        fromUserId: Number(r.from_user_id),
        toUserId: Number(r.to_user_id),
        fromUsername: String(r.from_username || ""),
        toUsername: String(r.to_username || ""),
        subjectId: String(r.subject_id || ""),
        questionKey: String(r.question_key || ""),
        question: (() => {
          try { return JSON.parse(r.question_json || "{}"); } catch { return {}; }
        })(),
        createdAt: r.created_at,
        answer: (() => {
          try { return r.answer_json ? JSON.parse(r.answer_json) : null; } catch { return null; }
        })(),
        answeredAt: r.answered_at || null,
        isCorrect: r.is_correct === null || r.is_correct === undefined ? null : Boolean(r.is_correct),
      })),
    });
  } catch (error) {
    console.error("[Friends thread] Error:", error);
    res.status(500).json({ error: "Could not load thread." });
  }
});

app.get("/api/friends/:friendId/scorecard", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const friendId = Number(req.params.friendId);
    if (!friendId || friendId === userId) return res.status(400).json({ error: "Invalid." });
    const [u1, u2] = friendshipPair(userId, friendId);
    const ok = await get(`SELECT id FROM friendships WHERE user1_id = ? AND user2_id = ?`, [u1, u2]);
    if (!ok) return res.status(403).json({ error: "Not friends." });

    const row = await get(
      `SELECT users.id as user_id,
              users.username,
              SUM(CASE WHEN qa.is_correct=1 THEN qa.marks ELSE 0 END) as points,
              SUM(CASE WHEN qa.is_correct=1 THEN 1 ELSE 0 END) as correctAnswers,
              COUNT(*) as attempts
       FROM users
       LEFT JOIN question_attempts qa ON qa.user_id = users.id
       WHERE users.id = ?
       GROUP BY users.id`,
      [friendId],
    );
    res.json({
      userId: friendId,
      username: String(row?.username ?? ""),
      points: Number(row?.points ?? 0),
      correctAnswers: Number(row?.correctAnswers ?? 0),
      attempts: Number(row?.attempts ?? 0),
    });
  } catch (error) {
    console.error("[Friend scorecard] Error:", error);
    res.status(500).json({ error: "Could not load friend's scorecard." });
  }
});

app.post("/api/friends/:friendId/assign", authMiddleware, async (req, res) => {
  try {
    const fromUserId = Number(req.user.id);
    const toUserId = Number(req.params.friendId);
    if (!toUserId || toUserId === fromUserId) return res.status(400).json({ error: "Invalid." });
    const [u1, u2] = friendshipPair(fromUserId, toUserId);
    const ok = await get(`SELECT id FROM friendships WHERE user1_id = ? AND user2_id = ?`, [u1, u2]);
    if (!ok) return res.status(403).json({ error: "Not friends." });

    const subjectId = canonicalSubjectId(cleanText(req.body.subjectId, 80));
    const questionKey = cleanText(req.body.questionKey, 1000);
    const question = req.body.question;
    if (!subjectId || !questionKey || !question) {
      return res.status(400).json({ error: "Missing subjectId/questionKey/question." });
    }
    const questionJson = JSON.stringify(question);
    const r = await run(
      `INSERT INTO friend_assignments (from_user_id, to_user_id, subject_id, question_key, question_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [fromUserId, toUserId, subjectId, questionKey, questionJson, nowIso()],
    );
    res.json({ ok: true, id: r.lastID });
  } catch (error) {
    console.error("[Friends assign] Error:", error);
    res.status(500).json({ error: "Could not assign question." });
  }
});

app.post("/api/friends/assignments/:assignmentId/answer", authMiddleware, async (req, res) => {
  try {
    const userId = Number(req.user.id);
    const assignmentId = Number(req.params.assignmentId);
    const row = await get(`SELECT * FROM friend_assignments WHERE id = ?`, [assignmentId]);
    if (!row) return res.status(404).json({ error: "Not found." });
    if (Number(row.to_user_id) !== userId) {
      return res.status(403).json({ error: "Forbidden." });
    }
    if (row.answered_at) return res.json({ ok: true });
    let question = {};
    try { question = JSON.parse(row.question_json || "{}"); } catch { question = {}; }
    const answerPayload = req.body?.answer ?? req.body;
    const isCorrect = scoreAssignedQuestion(question, answerPayload);
    await run(
      `UPDATE friend_assignments SET answer_json = ?, answered_at = ?, is_correct = ? WHERE id = ?`,
      [
        JSON.stringify(answerPayload ?? null),
        nowIso(),
        isCorrect === null ? null : isCorrect ? 1 : 0,
        assignmentId,
      ],
    );
    res.json({ ok: true, isCorrect });
  } catch (error) {
    console.error("[Friends answer] Error:", error);
    res.status(500).json({ error: "Could not submit answer." });
  }
});

app.post("/api/dojo/challenges/read", authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    await run(
      `UPDATE dojo_challenges SET opponent_read = 1 WHERE opponent_id = ? AND status = 'pending'`,
      [userId],
    );
    res.json({ ok: true });
  } catch (error) {
    console.error("[Dojo challenges read] Error:", error);
    res.status(500).json({ error: "Could not mark as read." });
  }
});

app.get("/api/dojo/users", authMiddleware, async (req, res) => {
  try {
    const search = String(req.query.search ?? "").trim();
    if (!search) return res.json({ users: [] });
    const rows = await all(
      `SELECT id, username FROM users
       WHERE username LIKE ? AND id != ?
       ORDER BY username ASC
       LIMIT 10`,
      [`%${search}%`, req.user.id],
    );
    res.json({
      users: rows.map((r) => ({ id: String(r.id), username: r.username })),
    });
  } catch (error) {
    console.error("[Dojo users GET] Error:", error);
    res.status(500).json({ error: "Could not load users." });
  }
});

app.post("/api/dojo/challenges", authMiddleware, async (req, res) => {
  try {
    const opponentUsername = cleanText(req.body.opponentUsername, 40);
    const subjectId = cleanText(req.body.subjectId, 80);
    const topic = cleanText(req.body.topic || "General", 100);
    const questionSetRaw = req.body.questionSet;

    const questionSet = Array.isArray(questionSetRaw) ? questionSetRaw : null;
    if (!opponentUsername || !subjectId || !questionSet) {
      return res.status(400).json({ error: "Required fields missing." });
    }
    if (questionSet.length !== 10) {
      return res.status(400).json({ error: "questionSet must contain exactly 10 questions." });
    }

    const opponent = await get(
      `SELECT id FROM users WHERE LOWER(username) = LOWER(?)`,
      [opponentUsername],
    );
    if (!opponent) return res.status(404).json({ error: "Opponent not found." });
    if (opponent.id === req.user.id) {
      return res.status(400).json({ error: "You cannot challenge yourself." });
    }

    // Only allow MCQ + Short Answer questions.
    const invalid = questionSet.some((q) => {
      const t = String(q?.type ?? "");
      return !(t === "mcq" || t === "short" || t === "short_answer");
    });
    if (invalid) return res.status(400).json({ error: "Battle questions must be MCQ or Short Answer only." });

    const createdAt = nowIso();
    const result = await run(
      `INSERT INTO dojo_challenges (challenger_id, opponent_id, subject_id, topic, question_set, status, opponent_read, created_at)
       VALUES (?, ?, ?, ?, ?, 'pending', 0, ?)`,
      [req.user.id, opponent.id, subjectId, topic, serializeQuestionSet(questionSet), createdAt],
    );

    res.json({ ok: true, challengeId: String(result.lastID) });
  } catch (error) {
    console.error("[Dojo challenge POST] Error:", error);
    res.status(500).json({ error: "Could not create challenge." });
  }
});

app.post("/api/dojo/challenges/:challengeId/accept", authMiddleware, async (req, res) => {
  try {
    const challengeId = Number(req.params.challengeId);
    if (!challengeId || Number.isNaN(challengeId)) {
      return res.status(400).json({ error: "Invalid challenge id." });
    }

    const challenge = await get(
      `SELECT * FROM dojo_challenges WHERE id = ? AND opponent_id = ? AND status = 'pending'`,
      [challengeId, req.user.id],
    );
    if (!challenge) return res.status(404).json({ error: "Challenge not found." });

    const createdAt = nowIso();
    const result = await run(
      `INSERT INTO dojo_battles (challenge_id, subject_id, topic, player1_id, player2_id, player1_score, player2_score, current_index, question_started_at, status, winner_id, question_set, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, 'active', null, ?, ?, ?)`,
      [
        challenge.id,
        challenge.subject_id,
        challenge.topic,
        challenge.challenger_id,
        challenge.opponent_id,
        createdAt,
        challenge.question_set,
        createdAt,
        createdAt,
      ],
    );

    await run(
      `UPDATE dojo_challenges SET status = 'active', accepted_at = ?, opponent_read = 1 WHERE id = ?`,
      [createdAt, challenge.id],
    );

    res.json({ ok: true, battleId: String(result.lastID) });
  } catch (error) {
    console.error("[Dojo accept] Error:", error);
    res.status(500).json({ error: "Could not accept challenge." });
  }
});

app.get("/api/dojo/battles/:battleId", authMiddleware, async (req, res) => {
  try {
    const battleId = Number(req.params.battleId);
    if (!battleId || Number.isNaN(battleId)) return res.status(400).json({ error: "Invalid battle id." });

    let battle = await get(
      `SELECT * FROM dojo_battles WHERE id = ?`,
      [battleId],
    );
    if (!battle) return res.status(404).json({ error: "Battle not found." });
    if (battle.player1_id !== req.user.id && battle.player2_id !== req.user.id) {
      return res.status(403).json({ error: "Not your battle." });
    }

    battle = await advanceBattleIfExpired({ get, execute: all }, battle);

    const questionSet = JSON.parse(battle.question_set ?? "[]");
    const currentIndex = Number(battle.current_index ?? 0);
    const status = battle.status;
    const now = new Date();
    const startedAt = new Date(battle.question_started_at);
    const elapsedSeconds = isNaN(startedAt.getTime())
      ? 0
      : Math.floor((now.getTime() - startedAt.getTime()) / 1000);
    const timePerQuestion = 30;
    const timeRemainingSeconds = Math.max(0, timePerQuestion - elapsedSeconds);

    const p1 = await get(`SELECT username FROM users WHERE id = ?`, [battle.player1_id]);
    const p2 = await get(`SELECT username FROM users WHERE id = ?`, [battle.player2_id]);

    res.json({
      battle: {
        id: String(battle.id),
        status,
        subjectId: battle.subject_id,
        topic: battle.topic,
        player1: { id: String(battle.player1_id), username: p1?.username ?? "" },
        player2: { id: String(battle.player2_id), username: p2?.username ?? "" },
        player1Score: Number(battle.player1_score ?? 0),
        player2Score: Number(battle.player2_score ?? 0),
        currentIndex,
        timeRemainingSeconds: status === "active" ? timeRemainingSeconds : 0,
        currentQuestion:
          status === "active" && currentIndex < 10 ? questionSet[currentIndex] ?? null : null,
        winnerId: battle.winner_id ? String(battle.winner_id) : null,
      },
    });
  } catch (error) {
    console.error("[Dojo battle GET] Error:", error);
    res.status(500).json({ error: "Could not load battle." });
  }
});

app.post("/api/dojo/battles/:battleId/answer", authMiddleware, async (req, res) => {
  try {
    const battleId = Number(req.params.battleId);
    if (!battleId || Number.isNaN(battleId)) return res.status(400).json({ error: "Invalid battle id." });

    const { questionIndex, answer, selectedOption } = req.body ?? {};
    const qIdx = Number(questionIndex);
    if (Number.isNaN(qIdx)) return res.status(400).json({ error: "Invalid questionIndex." });

    let battle = await get(`SELECT * FROM dojo_battles WHERE id = ?`, [battleId]);
    if (!battle) return res.status(404).json({ error: "Battle not found." });
    if (battle.player1_id !== req.user.id && battle.player2_id !== req.user.id) {
      return res.status(403).json({ error: "Not your battle." });
    }
    if (battle.status !== "active") return res.status(409).json({ error: "Battle not active." });

    battle = await advanceBattleIfExpired({ get, execute: all }, battle);
    battle = await get(`SELECT * FROM dojo_battles WHERE id = ?`, [battleId]);

    if (battle.status !== "active") return res.json({ ok: true });

    const questionSet = JSON.parse(battle.question_set ?? "[]");
    const currentIndex = Number(battle.current_index ?? 0);
    if (qIdx !== currentIndex) return res.status(409).json({ error: "Stale answer." });
    const question = questionSet[currentIndex] ?? null;
    if (!question) return res.status(400).json({ error: "Question missing." });

    const now = new Date();
    const startedAt = new Date(battle.question_started_at);
    const elapsedSeconds = isNaN(startedAt.getTime())
      ? 0
      : Math.floor((now.getTime() - startedAt.getTime()) / 1000);
    const timeRemainingSeconds = Math.max(0, 30 - elapsedSeconds);
    if (timeRemainingSeconds <= 0) return res.json({ ok: true });

    const correct = isQuestionCorrect(question, answer, selectedOption);
    if (!correct) {
      return res.json({ ok: true });
    }

    // Award point to the first correct submission.
    const winnerId = req.user.id;
    if (winnerId === battle.player1_id) {
      await run(
        `UPDATE dojo_battles SET player1_score = player1_score + 1, current_index = current_index + 1, question_started_at = ?, updated_at = ? WHERE id = ?`,
        [nowIso(), nowIso(), battle.id],
      );
    } else {
      await run(
        `UPDATE dojo_battles SET player2_score = player2_score + 1, current_index = current_index + 1, question_started_at = ?, updated_at = ? WHERE id = ?`,
        [nowIso(), nowIso(), battle.id],
      );
    }

    // If we reached the end, mark completed with winner.
    battle = await get(`SELECT * FROM dojo_battles WHERE id = ?`, [battle.id]);
    const idxAfter = Number(battle.current_index ?? 0);
    if (idxAfter >= 10) {
      const p1 = Number(battle.player1_score ?? 0);
      const p2 = Number(battle.player2_score ?? 0);
      const finalWinnerId = p1 === p2 ? null : p1 > p2 ? battle.player1_id : battle.player2_id;
      await run(
        `UPDATE dojo_battles SET status = 'completed', winner_id = ?, updated_at = ? WHERE id = ?`,
        [finalWinnerId, nowIso(), battle.id],
      );
    }

    res.json({ ok: true });
  } catch (error) {
    console.error("[Dojo answer POST] Error:", error);
    res.status(500).json({ error: "Could not submit answer." });
  }
});

// ── Competition ────────────────────────────────────────────────────────────────

// Record a single question answer (upsert — one row per user per question)
app.post("/api/competition/answer", authMiddleware, async (req, res) => {
  try {
    const subjectId = cleanText(req.body.subjectId, 80);
    const questionKey = cleanText(req.body.questionKey, 1000);
    const topic = cleanText(req.body.topic || "General", 100);
    const marks = Math.max(1, Math.round(Number(req.body.marks ?? 1)));
    // Frontend historically used `correct`; support both.
    const isCorrectRaw = req.body.isCorrect ?? req.body.correct;
    const isCorrect = isCorrectRaw ? 1 : 0;

    if (!subjectId || !questionKey) {
      return res.status(400).json({ error: "subjectId and questionKey required." });
    }

    await run(
      `INSERT INTO question_attempts (user_id, subject_id, question_key, topic, marks, is_correct, answered_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, subject_id, question_key) DO UPDATE SET
         topic = excluded.topic,
         marks = excluded.marks,
         is_correct = excluded.is_correct,
         answered_at = excluded.answered_at`,
      [req.user.id, subjectId, questionKey, topic, marks, isCorrect, nowIso()]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("[Competition answer] Error:", error);
    res.status(500).json({ error: "Could not record answer." });
  }
});

// Get full competition stats for a subject for the requesting user
app.get("/api/competition/:subjectId/stats", authMiddleware, async (req, res) => {
  try {
    const subjectId = req.params.subjectId;
    const MIN_RANKED_ATTEMPTS = 10;

    // Weekly vs all-time leaderboard.
    // Default: all-time.
    const range = String(req.query.range ?? "all");
    let answeredRangeSql = "";
    let answeredRangeParams = [];
    if (range === "week") {
      const now = new Date();
      // Monday-based week start.
      const day = now.getDay(); // 0 (Sun) ... 6 (Sat)
      const diffToMonday = (day + 6) % 7;

      const start = new Date(now);
      start.setDate(now.getDate() - diffToMonday);
      start.setHours(0, 0, 0, 0);

      const end = new Date(start);
      end.setDate(start.getDate() + 7);

      answeredRangeSql = " AND answered_at >= ? AND answered_at < ? ";
      answeredRangeParams = [start.toISOString(), end.toISOString()];
    }
    if (range === "daily") {
      const now = new Date();
      const start = new Date(now);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 1);

      answeredRangeSql = " AND answered_at >= ? AND answered_at < ? ";
      answeredRangeParams = [start.toISOString(), end.toISOString()];
    }

    // Total distinct students who have answered at least one question in this subject
    const studentRow = await get(
      `SELECT COUNT(DISTINCT user_id) as count FROM question_attempts WHERE subject_id = ? ${answeredRangeSql}`,
      [subjectId, ...answeredRangeParams]
    );
    const totalStudents = studentRow.count;

    // Per-user: marks earned / marks attempted + attempt count (one row per question).
    const allScores = await all(
      `SELECT user_id, username,
              SUM(CASE WHEN is_correct=1 THEN marks ELSE 0 END) as marks_correct,
              SUM(marks) as marks_attempted,
              COUNT(*) as attempt_count
       FROM question_attempts
       JOIN users ON users.id = question_attempts.user_id
       WHERE question_attempts.subject_id = ? ${answeredRangeSql}
       GROUP BY user_id`,
      [subjectId, ...answeredRangeParams]
    );

    const pctRounded = (r) =>
      r.marks_attempted > 0
        ? Math.round((r.marks_correct / r.marks_attempted) * 100)
        : 0;

    const eligible = allScores.filter((r) => Number(r.attempt_count) >= MIN_RANKED_ATTEMPTS);

    const sortedEligible = [...eligible].sort((a, b) => {
      const pa = pctRounded(a);
      const pb = pctRounded(b);
      if (pb !== pa) return pb - pa;
      if (Number(b.marks_attempted) !== Number(a.marks_attempted)) {
        return Number(b.marks_attempted) - Number(a.marks_attempted);
      }
      return String(a.username).localeCompare(String(b.username));
    });

    const myRow = allScores.find((r) => r.user_id === req.user.id);
    const myAttempts = myRow ? Number(myRow.attempt_count) : 0;
    const myPct = myRow && myRow.marks_attempted > 0
      ? pctRounded(myRow)
      : 0;

    let rank = null;
    let percentile = null;
    if (myAttempts >= MIN_RANKED_ATTEMPTS && sortedEligible.length >= 2) {
      rank = sortedEligible.findIndex((r) => r.user_id === req.user.id) + 1;
      if (rank === 0) rank = null;
      else {
        const below = sortedEligible.filter((r) => pctRounded(r) < myPct).length;
        percentile =
          sortedEligible.length > 1
            ? Math.round((below / (sortedEligible.length - 1)) * 100)
            : 100;
      }
    }

    const leaderboard = sortedEligible.slice(0, 10).map((r) => ({
      userId: r.user_id,
      username: r.username,
      correct: r.marks_correct,
      total: r.marks_attempted,
      attemptCount: Number(r.attempt_count),
      percent: pctRounded(r),
    }));

    // Per-question: % of students fully correct (binary is_correct), not partial marks.
    const qRows = await all(
      `SELECT question_key, MAX(topic) as topic,
              SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) as fully_correct,
              COUNT(*) as total_answered
       FROM question_attempts
       WHERE subject_id = ? ${answeredRangeSql}
       GROUP BY question_key`,
      [subjectId, ...answeredRangeParams]
    );

    const questionStats = qRows.map((r) => {
      const ta = Number(r.total_answered);
      const fc = Number(r.fully_correct);
      return {
        questionKey: r.question_key,
        topic: r.topic,
        correctCount: fc,
        totalAnswered: ta,
        fullyCorrectPercent: ta > 0 ? Math.round((fc / ta) * 100) : 0,
      };
    });

    const topicClassRows = await all(
      `SELECT topic,
              SUM(CASE WHEN is_correct=1 THEN marks ELSE 0 END) as class_marks_correct,
              SUM(marks) as class_marks_attempted
       FROM question_attempts
       WHERE subject_id = ? ${answeredRangeSql}
       GROUP BY topic`,
      [subjectId, ...answeredRangeParams]
    );

    const topicMyRows = await all(
      `SELECT topic,
              SUM(CASE WHEN is_correct=1 THEN marks ELSE 0 END) as my_marks_correct,
              SUM(marks) as my_marks_attempted
       FROM question_attempts
       WHERE subject_id = ? AND user_id = ? ${answeredRangeSql}
       GROUP BY topic`,
      [subjectId, req.user.id, ...answeredRangeParams]
    );

    const myTopicMap = {};
    topicMyRows.forEach((r) => {
      myTopicMap[r.topic] = {
        myCorrect: r.my_marks_correct,
        myTotal: r.my_marks_attempted,
      };
    });

    const topicUserRows = await all(
      `SELECT user_id, topic,
              SUM(CASE WHEN is_correct=1 THEN marks ELSE 0 END) as marks_correct,
              SUM(marks) as marks_attempted
       FROM question_attempts
       WHERE subject_id = ? ${answeredRangeSql}
       GROUP BY user_id, topic`,
      [subjectId, ...answeredRangeParams]
    );

    const byTopicUsers = new Map();
    for (const row of topicUserRows) {
      const t = row.topic;
      if (!byTopicUsers.has(t)) byTopicUsers.set(t, []);
      const ma = Number(row.marks_attempted);
      const mc = Number(row.marks_correct);
      byTopicUsers.get(t).push({
        userId: row.user_id,
        pctRounded: ma > 0 ? Math.round((mc / ma) * 100) : 0,
      });
    }

    function topicPercentile(topic) {
      const list = byTopicUsers.get(topic);
      if (!list || list.length < 2) return null;
      const mine = list.find((x) => x.userId === req.user.id);
      if (!mine) return null;
      const below = list.filter((x) => x.pctRounded < mine.pctRounded).length;
      return Math.round((below / (list.length - 1)) * 100);
    }

    const topicStats = topicClassRows.map((r) => ({
      topic: r.topic,
      correctCount: r.class_marks_correct,
      totalAnswered: r.class_marks_attempted,
      myCorrect: myTopicMap[r.topic]?.myCorrect ?? null,
      myTotal: myTopicMap[r.topic]?.myTotal ?? 0,
      topicPercentile: topicPercentile(r.topic),
    }));

    res.json({
      totalStudents,
      percentile,
      rank,
      leaderboard,
      questionStats,
      topicStats,
      minRankedAttempts: MIN_RANKED_ATTEMPTS,
    });
  } catch (error) {
    console.error("[Competition stats] Error:", error);
    res.status(500).json({ error: "Could not load competition stats." });
  }
});

// Get a sleek scorecard for the requesting student
app.get("/api/scorecard", authMiddleware, async (req, res) => {
  try {
    const range = String(req.query.range ?? "all");
    let answeredRangeSql = "";
    let answeredRangeParams = [];

    if (range === "week") {
      const now = new Date();
      const day = now.getDay();
      const diffToMonday = (day + 6) % 7;
      const start = new Date(now);
      start.setDate(now.getDate() - diffToMonday);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 7);

      answeredRangeSql = " AND answered_at >= ? AND answered_at < ? ";
      answeredRangeParams = [start.toISOString(), end.toISOString()];
    }

    // Overall ranking across all subjects: rank by points (marks for correct answers only).
    const userRows = await all(
      `SELECT users.id as user_id,
              users.username,
              SUM(CASE WHEN is_correct=1 THEN marks ELSE 0 END) as points,
              SUM(CASE WHEN is_correct=1 THEN 1 ELSE 0 END) as correctAnswers,
              COUNT(*) as attempts
       FROM question_attempts
       JOIN users ON users.id = question_attempts.user_id
       WHERE 1=1 ${answeredRangeSql}
       GROUP BY users.id
       ORDER BY points DESC, correctAnswers DESC`,
      [...answeredRangeParams],
    );

    const totalStudents = userRows.length;
    const myIndex = userRows.findIndex((r) => r.user_id === req.user.id);
    const overallRank = myIndex >= 0 ? myIndex + 1 : null;
    const myRow = myIndex >= 0 ? userRows[myIndex] : null;

    // Best / weakest subject for this student.
    const subjectRows = await all(
      `SELECT subject_id,
              SUM(CASE WHEN is_correct=1 THEN marks ELSE 0 END) as points
       FROM question_attempts
       WHERE user_id = ? ${answeredRangeSql}
       GROUP BY subject_id`,
      [req.user.id, ...answeredRangeParams],
    );

    let bestSubjectId = null;
    let weakestSubjectId = null;

    if (subjectRows.length > 0) {
      const sortedByPoints = [...subjectRows].sort((a, b) => b.points - a.points);
      bestSubjectId = sortedByPoints[0].subject_id;

      const minPoints = Math.min(...subjectRows.map((r) => r.points));
      const weakestCandidates = subjectRows.filter((r) => r.points === minPoints);
      weakestSubjectId = weakestCandidates[0]?.subject_id ?? null;
    }

    const winsRow = await get(
      `SELECT COUNT(*) as c FROM dojo_battles WHERE status = 'completed' AND winner_id = ?`,
      [req.user.id],
    );
    const dojoWins = Math.max(0, Number(winsRow?.c) || 0);

    const asOfRaw = cleanText(req.query.asOfDate, 12);
    const streakAnchor = /^\d{4}-\d{2}-\d{2}$/.test(asOfRaw)
      ? asOfRaw
      : new Date().toISOString().slice(0, 10);

    const goalRow = await get(`SELECT study_goal_minutes FROM users WHERE id = ?`, [req.user.id]);
    const goalMin = Math.max(1, Math.min(480, Number(goalRow?.study_goal_minutes) || 120));
    const goalSec = goalMin * 60;

    const streakRows = await all(
      `SELECT date, total_seconds FROM user_study_daily WHERE user_id = ? ORDER BY date DESC LIMIT 500`,
      [req.user.id],
    );
    const studyStreak = computeStudyStreakFromRows(streakRows, streakAnchor, goalSec);

    res.json({
      totalStudents,
      overallRank,
      points: myRow?.points ?? 0,
      bestSubjectId,
      weakestSubjectId,
      dojoWins,
      studyStreak,
    });
  } catch (error) {
    console.error("[Scorecard] Error:", error);
    res.status(500).json({ error: "Could not load scorecard." });
  }
});

// ── Admin: custom questions ────────────────────────────────────────────────────

app.get("/api/admin/questions", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const rows = await all(`SELECT * FROM custom_questions ORDER BY subject_id, created_at ASC`);
    res.json(
      rows.map((row) => {
        const marksNum = Number(row.marks);
        const marks =
          Number.isFinite(marksNum) && marksNum > 0 ? Math.round(marksNum) : 1;
        let options = safeJsonColumn(row.options, "options", row.id);
        if (options != null && !Array.isArray(options)) options = undefined;
        let acceptedAnswers = safeJsonColumn(
          row.accepted_answers,
          "accepted_answers",
          row.id,
        );
        if (acceptedAnswers != null && !Array.isArray(acceptedAnswers)) {
          acceptedAnswers = undefined;
        }
        let imageUrls = safeJsonColumn(row.image_urls, "image_urls", row.id);
        if (imageUrls != null && !Array.isArray(imageUrls)) imageUrls = undefined;
        return {
          id: String(row.id),
          subjectId: String(row.subject_id),
          subjectName: String(row.subject_id),
          type: row.type,
          topic: row.topic || "General",
          question: row.question,
          imageUrls,
          options,
          correctAnswer: row.answer || undefined,
          acceptedAnswers,
          marks,
          guidance: row.guidance || undefined,
          passage: row.passage || undefined,
        };
      }),
    );
  } catch (error) {
    console.error("[Admin questions GET] Error:", error);
    res.status(500).json({ error: "Could not load custom questions." });
  }
});

app.post("/api/admin/questions", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const subjectId = canonicalSubjectId(cleanText(req.body.subjectId, 80));
    const type = cleanText(req.body.type, 20);
    const question = cleanText(req.body.question, 1000);
    const topic = cleanText(req.body.topic || "General", 100);
    const imageUrlsRaw = Array.isArray(req.body.imageUrls) ? req.body.imageUrls : null;
    const imageUrls = imageUrlsRaw
      ? imageUrlsRaw
          .map((u) => String(u || "").trim())
          .filter(Boolean)
          .slice(0, 6)
      : null;
    const imageUrlsJson = imageUrls && imageUrls.length ? JSON.stringify(imageUrls) : null;
    const options = req.body.options ? JSON.stringify(req.body.options) : null;
    const answerRaw = req.body.correctAnswer ?? req.body.answer;
    const answer = answerRaw ? cleanText(String(answerRaw), 500) : null;
    const acceptedAnswers = req.body.acceptedAnswers ? JSON.stringify(req.body.acceptedAnswers) : null;
    const guidance = req.body.guidance ? cleanText(req.body.guidance, 500) : null;
    const passage = req.body.passage ? cleanText(req.body.passage, 3000) : null;
    const marks = Math.max(
      1,
      Math.round(
        Number(
          req.body.marks ??
            (type === "mcq" ? 1 : 2),
        ),
      )
    );

    if (!subjectId || !type || !question) {
      return res.status(400).json({ error: "subjectId, type, and question are required." });
    }

    const result = await run(
      `INSERT INTO custom_questions (subject_id, type, topic, question, image_urls, options, answer, accepted_answers, guidance, passage, marks, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        subjectId,
        type,
        topic,
        question,
        imageUrlsJson,
        options,
        answer,
        acceptedAnswers,
        guidance,
        passage,
        marks,
        nowIso(),
      ]
    );

    const newId = result.lastID;
    void sheetsSync
      .appendQuestionEvent({
        databaseId: String(newId),
        subjectId,
        type,
        topic,
        question,
        optionsJson: options || "",
        answer: answer || "",
        acceptedAnswersJson: acceptedAnswers || "",
        marks: String(marks),
        guidance: guidance || "",
        passage: passage || "",
        imageUrlsJson: imageUrlsJson || "",
        action: "CREATE",
        syncedAt: nowIso(),
      })
      .catch((err) => console.warn("[Sheets] append after create:", err.message || err));

    res.json({ ok: true, id: newId });
  } catch (error) {
    console.error("[Admin questions POST] Error:", error);
    res.status(500).json({ error: "Could not add question." });
  }
});

app.post("/api/admin/questions/attach-images-bulk", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const mappings = Array.isArray(req.body?.mappings) ? req.body.mappings : [];
    if (!mappings.length) {
      return res.status(400).json({ error: "mappings must be a non-empty array." });
    }
    const dryRun = Boolean(req.body?.dryRun);
    let updated = 0;
    const errors = [];

    const normalizeQuestion = (raw) =>
      cleanText(raw, 8000)
        .toLowerCase()
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/[–—]/g, "-")
        .replace(/[\u200B-\u200D\uFEFF]/g, "")
        .replace(/\s+/g, " ")
        .trim();

    for (let i = 0; i < mappings.length; i++) {
      const r = mappings[i] || {};
      const questionId = Number(r.questionId ?? r.question_id ?? r.id ?? r.database_id);
      const subjectId = canonicalSubjectId(cleanText(r.subjectId ?? r.subject_id, 80));
      const question = cleanText(r.question ?? r.prompt ?? r.stem, 4000);
      const imageArr =
        parseFlexibleArrayInput(r.image_urls_json) ??
        parseFlexibleArrayInput(r.image_urls) ??
        parseFlexibleArrayInput(r.imageUrls);

      if (!imageArr || !imageArr.length) {
        errors.push({ index: i, message: "image_urls_json must contain at least one image." });
        continue;
      }

      let targetId = null;
      if (Number.isFinite(questionId) && questionId > 0) {
        targetId = questionId;
      } else {
        if (!subjectId || !question) {
          errors.push({
            index: i,
            message: "subjectId and question are required (or provide questionId).",
          });
          continue;
        }
        const rows = await all(
          `SELECT id, question FROM custom_questions WHERE subject_id = ? ORDER BY created_at DESC LIMIT 5000`,
          [subjectId],
        );
        const target = normalizeQuestion(question);
        let matches = rows.filter((x) => normalizeQuestion(x.question) === target).map((x) => Number(x.id));
        if (!matches.length && target.length >= 24) {
          matches = rows
            .filter((x) => {
              const n = normalizeQuestion(x.question);
              return n.includes(target) || target.includes(n);
            })
            .map((x) => Number(x.id));
        }
        if (!matches.length) {
          errors.push({ index: i, message: "No matching question found for subject + question text." });
          continue;
        }
        if (matches.length > 1) {
          errors.push({ index: i, message: "Multiple matching questions found. Use question_id." });
          continue;
        }
        targetId = matches[0];
      }

      if (!dryRun) {
        await run(`UPDATE custom_questions SET image_urls = ? WHERE id = ?`, [
          JSON.stringify(imageArr),
          targetId,
        ]);
      }
      updated++;
    }

    res.json({ ok: errors.length === 0, updated, errors });
  } catch (error) {
    console.error("[Admin attach images bulk] Error:", error);
    res.status(500).json({ error: "Could not attach images in bulk." });
  }
});

// ── Admin: update marks for existing custom questions ────────────────
app.put("/api/admin/questions/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const marks = Math.max(1, Math.round(Number(req.body.marks ?? 1)));
    await run(`UPDATE custom_questions SET marks = ? WHERE id = ?`, [marks, req.params.id]);
    res.json({ ok: true, marks });
  } catch (error) {
    console.error("[Admin questions PUT] Error:", error);
    res.status(500).json({ error: "Could not update question marks." });
  }
});

app.delete("/api/admin/questions/:id", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    await run(`DELETE FROM custom_questions WHERE id = ?`, [req.params.id]);
    void sheetsSync
      .appendQuestionEvent({
        databaseId: String(req.params.id),
        subjectId: "",
        type: "",
        topic: "",
        question: "",
        optionsJson: "",
        answer: "",
        acceptedAnswersJson: "",
        marks: "",
        guidance: "",
        passage: "",
        imageUrlsJson: "",
        action: "DELETE",
        syncedAt: nowIso(),
      })
      .catch((err) => console.warn("[Sheets] append after delete:", err.message || err));
    res.json({ ok: true });
  } catch (error) {
    console.error("[Admin questions DELETE] Error:", error);
    res.status(500).json({ error: "Could not delete question." });
  }
});

app.get("/api/admin/google-sheet/status", authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    const enabled = sheetsSync.isSheetsConfigured();
    res.json({
      enabled,
      tabs: enabled ? sheetsSync.getTabNames() : [],
      subjectFromTab: enabled ? sheetsSync.subjectIdFromTabMode() : false,
    });
  } catch (error) {
    console.error("[Admin sheet status] Error:", error);
    res.json({ enabled: false, tabs: [], subjectFromTab: false });
  }
});

/** Compare env tab list to actual spreadsheet tab names (fix typos / missing tabs). */
app.get("/api/admin/google-sheet/diagnose", authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    if (!sheetsSync.isSheetsConfigured()) {
      return res
        .status(503)
        .json({ error: "Google Sheets is not configured on this server." });
    }
    const configuredTabs = sheetsSync.getTabNames();
    const spreadsheetTabTitles = await sheetsSync.listSpreadsheetSheetTitles();
    const missingFromSpreadsheet = configuredTabs.filter(
      (t) => !spreadsheetTabTitles.includes(t),
    );
    res.json({
      configuredTabs,
      spreadsheetTabTitles,
      missingFromSpreadsheet,
      hint:
        missingFromSpreadsheet.length > 0
          ? "Create a tab for each missing name exactly as listed (same spelling/case), or change GOOGLE_SHEETS_TAB_NAME to match existing tab names."
          : null,
    });
  } catch (error) {
    console.error("[Admin google-sheet diagnose] Error:", error);
    res.status(500).json({ error: String(error.message || error) });
  }
});

app.post("/api/admin/questions/sync-from-sheet", authMiddleware, adminMiddleware, async (_req, res) => {
  try {
    if (!sheetsSync.isSheetsConfigured()) {
      return res
        .status(503)
        .json({ error: "Google Sheets is not configured on this server." });
    }
    const { rows: rawRows, tabErrors } = await sheetsSync.readDataRows();
    let imported = 0;
    let updated = 0;
    let deleted = 0;
    const errors = [];

    for (let i = 0; i < rawRows.length; i++) {
      const item = rawRows[i];
      const row = item.row != null ? item.row : item;
      const tabName = item.tabName;
      const p = sheetsSync.parseRow(Array.isArray(row) ? row : []);
      if (sheetsSync.subjectIdFromTabMode() && tabName) {
        p.subject_id = tabName;
      }
      const action = (p.action || "").toUpperCase();
      const databaseId = p.database_id ? parseInt(p.database_id, 10) : NaN;

      try {
        if (action === "DELETE" && Number.isFinite(databaseId)) {
          await run(`DELETE FROM custom_questions WHERE id = ?`, [databaseId]);
          deleted++;
          continue;
        }

        if (!p.subject_id || !p.type || !p.question) {
          continue;
        }

        const subjectIdSheet = canonicalSubjectId(cleanText(p.subject_id, 80));
        const topic = p.topic || "General";
        const marks = Math.max(1, Math.round(Number(p.marks) || 1));
        const optionsJson = p.options_json || null;
        const acceptedRaw = p.accepted_answers_json || null;
        const imageUrlsJson = p.image_urls_json || null;
        const answer = p.answer || null;
        const guidance = p.guidance || null;
        const passage = p.passage || null;

        if (Number.isFinite(databaseId)) {
          const exists = await get(`SELECT id FROM custom_questions WHERE id = ?`, [databaseId]);
          if (exists) {
            await run(
              `UPDATE custom_questions SET subject_id = ?, type = ?, topic = ?, question = ?, image_urls = ?, options = ?, answer = ?, accepted_answers = ?, guidance = ?, passage = ?, marks = ?
               WHERE id = ?`,
              [
                subjectIdSheet,
                p.type,
                topic,
                p.question,
                imageUrlsJson,
                optionsJson,
                answer,
                acceptedRaw,
                guidance,
                passage,
                marks,
                databaseId,
              ],
            );
            updated++;
          } else {
            await run(
              `INSERT INTO custom_questions (subject_id, type, topic, question, image_urls, options, answer, accepted_answers, guidance, passage, marks, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                subjectIdSheet,
                p.type,
                topic,
                p.question,
                imageUrlsJson,
                optionsJson,
                answer,
                acceptedRaw,
                guidance,
                passage,
                marks,
                nowIso(),
              ],
            );
            imported++;
          }
        } else {
          await run(
            `INSERT INTO custom_questions (subject_id, type, topic, question, image_urls, options, answer, accepted_answers, guidance, passage, marks, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              subjectIdSheet,
              p.type,
              topic,
              p.question,
              imageUrlsJson,
              optionsJson,
              answer,
              acceptedRaw,
              guidance,
              passage,
              marks,
              nowIso(),
            ],
          );
          imported++;
        }
      } catch (e) {
        errors.push({ row: i + 2, message: String(e.message || e) });
      }
    }

    res.json({
      ok: true,
      imported,
      updated,
      deleted,
      errors,
      tabErrors,
      rowsRead: rawRows.length,
    });
  } catch (error) {
    console.error("[Admin sync-from-sheet] Error:", error);
    res.status(500).json({ error: "Could not sync from Google Sheet." });
  }
});

// ── Catch-all ──────────────────────────────────────────────────────────────────

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ── Start ──────────────────────────────────────────────────────────────────────

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`\n✅ Nodent running at http://localhost:${PORT}`);
      console.log(`   Database: ${DB_PATH}`);
      console.log(`   Visit http://localhost:${PORT}/api/health to confirm DB is live\n`);
    });
  })
  .catch((error) => {
    console.error("❌ Failed to initialise database:", error);
    process.exit(1);
  });