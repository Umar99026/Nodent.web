const express = require("express");
const path = require("path");
const fs = require("fs");
const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");

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
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (parent_comment_id) REFERENCES quiz_comments(id) ON DELETE CASCADE
    )
  `);

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
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Missing auth token." });
    }

    const session = await get(
      `SELECT sessions.token, sessions.expires_at, users.id, users.email, users.username
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
      if (!customQuestions[row.subject_id]) customQuestions[row.subject_id] = [];
      customQuestions[row.subject_id].push({
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
        imageUrls: row.image_urls ? JSON.parse(row.image_urls) : undefined,
        options: row.options ? JSON.parse(row.options) : undefined,
        answer: row.answer || undefined,
        acceptedAnswers: row.accepted_answers ? JSON.parse(row.accepted_answers) : undefined,
        marks: typeof row.marks === "number" ? row.marks : 1,
        guidance: row.guidance || undefined,
        passage: row.passage || undefined
      });
    }
    res.json({
      user: { id: req.user.id, email: req.user.email, username: req.user.username },
      customQuestions
    });
  } catch (error) {
    console.error("[Bootstrap] Error:", error);
    res.status(500).json({ error: "Could not load session." });
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

    res.json({ token, user: { id: result.lastID, username, email } });
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

    res.json({ token, user: { id: user.id, username: user.username || user.email, email: user.email } });
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
      `SELECT quiz_comments.id, quiz_comments.parent_comment_id, quiz_comments.text,
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
    const rawParent = req.body.parentCommentId;
    const parentCommentId =
      rawParent === null || rawParent === undefined || rawParent === ""
        ? null
        : Number(rawParent);

    if (!text) {
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
      `INSERT INTO quiz_comments (subject_id, question_key, user_id, parent_comment_id, text, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.subjectId, req.params.questionKey, req.user.id, parentCommentId, text, nowIso()]
    );

    const created = await get(
      `SELECT quiz_comments.id, quiz_comments.parent_comment_id, quiz_comments.text,
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
         is_correct = excluded.is_correct,
         topic = excluded.topic,
         marks = excluded.marks,
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

    if (totalStudents < 2) {
      return res.json({ totalStudents, percentile: null, rank: null, leaderboard: [], questionStats: [], topicStats: [] });
    }

    // Per-user score: count correct answers out of all their answered questions (excl. long-form = no isCorrect set for long, but we only record 0/1)
    const allScores = await all(
      `SELECT user_id, username,
              SUM(CASE WHEN is_correct=1 THEN marks ELSE 0 END) as correct,
              SUM(marks) as total
       FROM question_attempts
       JOIN users ON users.id = question_attempts.user_id
       WHERE question_attempts.subject_id = ? ${answeredRangeSql}
       GROUP BY user_id`,
      [subjectId, ...answeredRangeParams]
    );

    // My row
    const myRow = allScores.find(r => r.user_id === req.user.id);
    const myCorrect = myRow?.correct ?? 0;

    // Sort for leaderboard
    const sorted = [...allScores].sort((a, b) => {
      // Rankings based solely on correct answers.
      if (b.correct !== a.correct) return b.correct - a.correct;
      // Tie-breaker: fewer attempts rank slightly higher.
      return a.total - b.total;
    });

    const rank = sorted.findIndex(r => r.user_id === req.user.id) + 1;
    const below = sorted.filter(r => {
      return r.correct < myCorrect;
    }).length;
    const percentile = totalStudents > 1 ? Math.round((below / (totalStudents - 1)) * 100) : 100;

    const leaderboard = sorted.slice(0, 10).map(r => ({
      userId: r.user_id,
      username: r.username,
      correct: r.correct,
      total: r.total,
      percent: r.total > 0 ? Math.round((r.correct / r.total) * 100) : 0
    }));

    // Per-question class stats
    const qRows = await all(
      `SELECT question_key, topic,
              SUM(CASE WHEN is_correct=1 THEN marks ELSE 0 END) as correctCount,
              SUM(marks) as totalAnswered
       FROM question_attempts
       WHERE subject_id = ? ${answeredRangeSql}
       GROUP BY question_key`,
      [subjectId, ...answeredRangeParams]
    );

    const questionStats = qRows.map(r => ({
      questionKey: r.question_key,
      topic: r.topic,
      correctCount: r.correctCount,
      totalAnswered: r.totalAnswered
    }));

    // Per-topic class + my stats
    const topicClassRows = await all(
      `SELECT topic,
              SUM(CASE WHEN is_correct=1 THEN marks ELSE 0 END) as correctCount,
              SUM(marks) as totalAnswered
       FROM question_attempts
       WHERE subject_id = ? ${answeredRangeSql}
       GROUP BY topic`,
      [subjectId, ...answeredRangeParams]
    );

    const topicMyRows = await all(
      `SELECT topic,
              SUM(CASE WHEN is_correct=1 THEN marks ELSE 0 END) as myCorrect,
              SUM(marks) as myTotal
       FROM question_attempts
       WHERE subject_id = ? AND user_id = ? ${answeredRangeSql}
       GROUP BY topic`,
      [subjectId, req.user.id, ...answeredRangeParams]
    );

    const myTopicMap = {};
    topicMyRows.forEach(r => { myTopicMap[r.topic] = { myCorrect: r.myCorrect, myTotal: r.myTotal }; });

    const topicStats = topicClassRows.map(r => ({
      topic: r.topic,
      correctCount: r.correctCount,
      totalAnswered: r.totalAnswered,
      myCorrect: myTopicMap[r.topic]?.myCorrect ?? null,
      myTotal: myTopicMap[r.topic]?.myTotal ?? 0
    }));

    res.json({ totalStudents, percentile, rank, leaderboard, questionStats, topicStats });
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

    res.json({
      totalStudents,
      overallRank,
      points: myRow?.points ?? 0,
      bestSubjectId,
      weakestSubjectId,
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
      rows.map((row) => ({
        id: String(row.id),
        subjectId: String(row.subject_id),
        subjectName: String(row.subject_id),
        type: row.type,
        topic: row.topic || "General",
        question: row.question,
        imageUrls: row.image_urls ? JSON.parse(row.image_urls) : undefined,
        options: row.options ? JSON.parse(row.options) : undefined,
        correctAnswer: row.answer || undefined,
        acceptedAnswers: row.accepted_answers ? JSON.parse(row.accepted_answers) : undefined,
        marks: typeof row.marks === "number" ? row.marks : 1,
        guidance: row.guidance || undefined,
        passage: row.passage || undefined
      }))
    );
  } catch (error) {
    console.error("[Admin questions GET] Error:", error);
    res.status(500).json({ error: "Could not load custom questions." });
  }
});

app.post("/api/admin/questions", authMiddleware, adminMiddleware, async (req, res) => {
  try {
    const subjectId = cleanText(req.body.subjectId, 80);
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

    res.json({ ok: true, id: result.lastID });
  } catch (error) {
    console.error("[Admin questions POST] Error:", error);
    res.status(500).json({ error: "Could not add question." });
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
    res.json({ ok: true });
  } catch (error) {
    console.error("[Admin questions DELETE] Error:", error);
    res.status(500).json({ error: "Could not delete question." });
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