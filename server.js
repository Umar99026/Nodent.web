const express = require("express");
const path = require("path");
const sqlite3 = require("sqlite3").verbose();
const crypto = require("crypto");

const app = express();
const PORT = process.env.PORT || 3000;
const db = new sqlite3.Database(path.join(__dirname, "nodent.db"));

// Change this to your own secret passphrase. Set ADMIN_KEY env var in production.
const ADMIN_KEY = process.env.ADMIN_KEY || "nodent-admin-2025";

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function ensureColumn(table, column, definition) {
  const columns = await all(`PRAGMA table_info(${table})`);
  const exists = columns.some((item) => item.name === column);
  if (!exists) {
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

async function initDb() {
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
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      subject_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      total_questions INTEGER NOT NULL,
      percent INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
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
      FOREIGN KEY (user_id) REFERENCES users(id)
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
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (parent_comment_id) REFERENCES quiz_comments(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS custom_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id TEXT NOT NULL,
      type TEXT NOT NULL,
      question TEXT NOT NULL,
      options TEXT,
      answer TEXT,
      accepted_answers TEXT,
      guidance TEXT,
      passage TEXT,
      created_at TEXT NOT NULL
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);
}

async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Missing auth token." });
    }

    const session = await get(
      `
      SELECT sessions.token, users.id, users.email, users.username
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token = ?
      `,
      [token]
    );

    if (!session) {
      return res.status(401).json({ error: "Invalid session." });
    }

    req.user = {
      id: session.id,
      email: session.email,
      username: session.username || session.email,
      token: session.token
    };

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(500).json({ error: "Authentication failed." });
  }
}

/* ── bootstrap (session hydration) ── */

app.get("/api/bootstrap", authMiddleware, async (req, res) => {
  try {
    const rows = await all(`SELECT * FROM custom_questions ORDER BY subject_id, created_at ASC`);
    const customQuestions = {};
    for (const row of rows) {
      if (!customQuestions[row.subject_id]) customQuestions[row.subject_id] = [];
      customQuestions[row.subject_id].push({
        id: row.id,
        type: row.type,
        question: row.question,
        options: row.options ? JSON.parse(row.options) : undefined,
        answer: row.answer || undefined,
        acceptedAnswers: row.accepted_answers ? JSON.parse(row.accepted_answers) : undefined,
        guidance: row.guidance || undefined,
        passage: row.passage || undefined
      });
    }
    res.json({
      user: {
        id: req.user.id,
        email: req.user.email,
        username: req.user.username
      },
      customQuestions
    });
  } catch (error) {
    console.error("Bootstrap error:", error);
    res.status(500).json({ error: "Could not load session." });
  }
});

/* ── signup — registered at both /api/signup and /api/auth/signup ── */

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
    await run(
      `INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)`,
      [token, result.lastID, createdAt]
    );

    res.json({
      token,
      user: { id: result.lastID, username, email }
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ error: "Could not create account." });
  }
}

app.post("/api/signup", handleSignup);
app.post("/api/auth/signup", handleSignup);

/* ── login — registered at both /api/login and /api/auth/login ── */

async function handleLogin(req, res) {
  try {
    const loginValue = String(req.body.email || req.body.username || "").trim().toLowerCase();
    const password = String(req.body.password || "").trim();

    if (!loginValue || !password) {
      return res.status(400).json({ error: "Please enter your email or username and password." });
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
    await run(
      `INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)`,
      [token, user.id, nowIso()]
    );

    res.json({
      token,
      user: { id: user.id, username: user.username || user.email, email: user.email }
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Could not log in." });
  }
}

app.post("/api/login", handleLogin);
app.post("/api/auth/login", handleLogin);

/* ── logout — registered at both /api/logout and /api/auth/logout ── */

async function handleLogout(req, res) {
  try {
    await run(`DELETE FROM sessions WHERE token = ?`, [req.user.token]);
    res.json({ ok: true });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Could not log out." });
  }
}

app.post("/api/logout", authMiddleware, handleLogout);
app.post("/api/auth/logout", authMiddleware, handleLogout);

/* ── quiz submit ── */

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
      `
      INSERT INTO quiz_attempts (user_id, subject_id, score, total_questions, percent, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [req.user.id, subjectId, score, totalQuestions, percent, nowIso()]
    );

    res.json({ ok: true, percent });
  } catch (error) {
    console.error("Quiz submit error:", error);
    res.status(500).json({ error: "Could not save quiz score." });
  }
});

/* ── leaderboard ── */

app.get("/api/leaderboard/:subjectId", async (req, res) => {
  try {
    const leaderboard = await all(
      `
      SELECT
        users.username,
        MAX(quiz_attempts.percent) AS best_percent,
        MAX(quiz_attempts.score) AS best_score,
        MAX(quiz_attempts.total_questions) AS best_total,
        COUNT(quiz_attempts.id) AS attempts
      FROM quiz_attempts
      JOIN users ON users.id = quiz_attempts.user_id
      WHERE quiz_attempts.subject_id = ?
      GROUP BY quiz_attempts.user_id
      ORDER BY best_percent DESC, best_score DESC, attempts ASC, users.username ASC
      LIMIT 10
      `,
      [req.params.subjectId]
    );

    res.json({ leaderboard });
  } catch (error) {
    console.error("Leaderboard error:", error);
    res.status(500).json({ error: "Could not load leaderboard." });
  }
});

/* ── comments ── */

app.get("/api/comments/:subjectId/:questionKey", authMiddleware, async (req, res) => {
  try {
    const rows = await all(
      `
      SELECT
        quiz_comments.id,
        quiz_comments.parent_comment_id,
        quiz_comments.text,
        quiz_comments.created_at,
        users.username,
        users.id AS user_id
      FROM quiz_comments
      JOIN users ON users.id = quiz_comments.user_id
      WHERE quiz_comments.subject_id = ? AND quiz_comments.question_key = ?
      ORDER BY quiz_comments.created_at ASC, quiz_comments.id ASC
      `,
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
    console.error("Load comments error:", error);
    res.status(500).json({ error: "Could not load comments." });
  }
});

app.post("/api/comments/:subjectId/:questionKey", authMiddleware, async (req, res) => {
  try {
    const text = cleanText(req.body.text, 1000);
    const rawParent = req.body.parentCommentId;
    const parentCommentId = rawParent === null || rawParent === undefined || rawParent === ""
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
      `
      INSERT INTO quiz_comments (subject_id, question_key, user_id, parent_comment_id, text, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      [req.params.subjectId, req.params.questionKey, req.user.id, parentCommentId, text, nowIso()]
    );

    const created = await get(
      `
      SELECT quiz_comments.id, quiz_comments.parent_comment_id, quiz_comments.text,
             quiz_comments.created_at, users.username, users.id AS user_id
      FROM quiz_comments
      JOIN users ON users.id = quiz_comments.user_id
      WHERE quiz_comments.id = ?
      `,
      [result.lastID]
    );

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
    console.error("Create comment error:", error);
    res.status(500).json({ error: "Could not add comment." });
  }
});

/* ── written responses ── */

app.get("/api/written/:subjectId/:questionKey", authMiddleware, async (req, res) => {
  try {
    const row = await get(
      `SELECT response_text, updated_at FROM written_responses
       WHERE user_id = ? AND subject_id = ? AND question_key = ?`,
      [req.user.id, req.params.subjectId, req.params.questionKey]
    );

    res.json({
      response: row ? { text: row.response_text, updatedAt: row.updated_at } : null
    });
  } catch (error) {
    console.error("Load written response error:", error);
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
      `
      INSERT INTO written_responses (user_id, subject_id, question_key, response_text, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, subject_id, question_key) DO UPDATE SET
        response_text = excluded.response_text,
        updated_at = excluded.updated_at
      `,
      [req.user.id, req.params.subjectId, req.params.questionKey, responseText, nowIso()]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error("Save written response error:", error);
    res.status(500).json({ error: "Could not save written response." });
  }
});

app.get("/api/written/:subjectId/:questionKey/all", authMiddleware, async (req, res) => {
  try {
    const rows = await all(
      `
      SELECT written_responses.response_text, written_responses.updated_at,
             users.username, users.id AS user_id
      FROM written_responses
      JOIN users ON users.id = written_responses.user_id
      WHERE written_responses.subject_id = ? AND written_responses.question_key = ?
      ORDER BY written_responses.updated_at DESC
      `,
      [req.params.subjectId, req.params.questionKey]
    );

    res.json({
      responses: rows.map((row) => ({
        text: row.response_text,
        updatedAt: row.updated_at,
        username: row.username,
        userId: row.user_id
      }))
    });
  } catch (error) {
    console.error("Load all written responses error:", error);
    res.status(500).json({ error: "Could not load written responses." });
  }
});

/* ── chat ── */

app.get("/api/chat/:subjectId", authMiddleware, async (req, res) => {
  try {
    const rows = await all(
      `SELECT id, user_id, username, text, created_at FROM chat_messages
       WHERE subject_id = ? ORDER BY created_at ASC, id ASC LIMIT 200`,
      [req.params.subjectId]
    );
    res.json({
      messages: rows.map(r => ({
        id: r.id,
        userId: r.user_id,
        username: r.username,
        text: r.text,
        time: r.created_at
      }))
    });
  } catch (error) {
    console.error("Load chat error:", error);
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
    console.error("Send chat error:", error);
    res.status(500).json({ error: "Could not send message." });
  }
});

/* ── admin middleware ── */

function adminMiddleware(req, res, next) {
  const key = req.headers["x-admin-key"] || "";
  if (key !== ADMIN_KEY) {
    return res.status(403).json({ error: "Invalid admin key." });
  }
  next();
}

/* ── custom questions ── */

app.get("/api/admin/questions", adminMiddleware, async (req, res) => {
  try {
    const rows = await all(`SELECT * FROM custom_questions ORDER BY subject_id, created_at ASC`);
    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.subject_id]) grouped[row.subject_id] = [];
      grouped[row.subject_id].push({
        id: row.id,
        type: row.type,
        question: row.question,
        options: row.options ? JSON.parse(row.options) : undefined,
        answer: row.answer || undefined,
        acceptedAnswers: row.accepted_answers ? JSON.parse(row.accepted_answers) : undefined,
        guidance: row.guidance || undefined,
        passage: row.passage || undefined
      });
    }
    res.json({ customQuestions: grouped });
  } catch (error) {
    console.error("Load custom questions error:", error);
    res.status(500).json({ error: "Could not load custom questions." });
  }
});

app.post("/api/admin/questions", adminMiddleware, async (req, res) => {
  try {
    const subjectId = cleanText(req.body.subjectId, 80);
    const type = cleanText(req.body.type, 20);
    const question = cleanText(req.body.question, 1000);
    const options = req.body.options ? JSON.stringify(req.body.options) : null;
    const answer = req.body.answer ? cleanText(req.body.answer, 500) : null;
    const acceptedAnswers = req.body.acceptedAnswers ? JSON.stringify(req.body.acceptedAnswers) : null;
    const guidance = req.body.guidance ? cleanText(req.body.guidance, 500) : null;
    const passage = req.body.passage ? cleanText(req.body.passage, 3000) : null;

    if (!subjectId || !type || !question) {
      return res.status(400).json({ error: "subjectId, type, and question are required." });
    }

    const result = await run(
      `INSERT INTO custom_questions (subject_id, type, question, options, answer, accepted_answers, guidance, passage, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [subjectId, type, question, options, answer, acceptedAnswers, guidance, passage, nowIso()]
    );

    res.json({ ok: true, id: result.lastID });
  } catch (error) {
    console.error("Add custom question error:", error);
    res.status(500).json({ error: "Could not add question." });
  }
});

app.delete("/api/admin/questions/:id", adminMiddleware, async (req, res) => {
  try {
    await run(`DELETE FROM custom_questions WHERE id = ?`, [req.params.id]);
    res.json({ ok: true });
  } catch (error) {
    console.error("Delete custom question error:", error);
    res.status(500).json({ error: "Could not delete question." });
  }
});

/* ── health / catch-all ── */

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Nodent running at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialise database:", error);
  });