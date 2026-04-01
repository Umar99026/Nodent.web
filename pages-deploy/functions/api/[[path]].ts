import { Hono } from "hono";
import { cors } from "hono/cors";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, or, and, asc, sql } from "drizzle-orm";
import {
  pgTable, serial, text, integer, unique, index,
} from "drizzle-orm/pg-core";

// ---- Schema ----
const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().default(""),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  hashAlgorithm: text("hash_algorithm").notNull().default("pbkdf2"),
  createdAt: text("created_at").notNull(),
});

const sessions = pgTable("sessions", {
  token: text("token").primaryKey(),
  userId: integer("user_id").notNull(),
  createdAt: text("created_at").notNull(),
  expiresAt: text("expires_at").notNull(),
});

const quizAttempts = pgTable("quiz_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  subjectId: text("subject_id").notNull(),
  score: integer("score").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  percent: integer("percent").notNull(),
  createdAt: text("created_at").notNull(),
});

const writtenResponses = pgTable("written_responses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  subjectId: text("subject_id").notNull(),
  questionKey: text("question_key").notNull(),
  responseText: text("response_text").notNull(),
  updatedAt: text("updated_at").notNull(),
});

const quizComments = pgTable("quiz_comments", {
  id: serial("id").primaryKey(),
  subjectId: text("subject_id").notNull(),
  questionKey: text("question_key").notNull(),
  userId: integer("user_id").notNull(),
  parentCommentId: integer("parent_comment_id"),
  text: text("text").notNull(),
  createdAt: text("created_at").notNull(),
});

const customQuestions = pgTable("custom_questions", {
  id: serial("id").primaryKey(),
  subjectId: text("subject_id").notNull(),
  type: text("type").notNull(),
  topic: text("topic").notNull().default("General"),
  question: text("question").notNull(),
  imageUrls: text("image_urls"),
  options: text("options"),
  answer: text("answer"),
  acceptedAnswers: text("accepted_answers"),
  guidance: text("guidance"),
  passage: text("passage"),
  marks: integer("marks").notNull().default(1),
  createdAt: text("created_at").notNull(),
});

const chatMessages = pgTable("chat_messages", {
  id: serial("id").primaryKey(),
  subjectId: text("subject_id").notNull(),
  userId: integer("user_id").notNull(),
  username: text("username").notNull(),
  text: text("text").notNull(),
  createdAt: text("created_at").notNull(),
});

const questionAttempts = pgTable("question_attempts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  subjectId: text("subject_id").notNull(),
  questionKey: text("question_key").notNull(),
  topic: text("topic").notNull().default("General"),
  isCorrect: integer("is_correct").notNull(),
  answeredAt: text("answered_at").notNull(),
});

const forumPosts = pgTable("forum_posts", {
  id: serial("id").primaryKey(),
  subjectId: text("subject_id").notNull(),
  userId: integer("user_id").notNull(),
  username: text("username").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  imageUrls: text("image_urls"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

const forumReplies = pgTable("forum_replies", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull(),
  subjectId: text("subject_id").notNull(),
  userId: integer("user_id").notNull(),
  username: text("username").notNull(),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull(),
});

// ---- Helpers ----
/** Hardcoded admin email must match `ADMIN_EMAIL` in frontend `constants.ts`. */
const ADMIN_EMAIL_LC = "nodent.app@gmail.com";

function cleanText(value: unknown, maxLength = 1000): string {
  if (typeof value !== "string") return "";
  return value.replace(/\0/g, "").trim().slice(0, maxLength);
}

function canonicalSubjectId(raw: unknown): string {
  const s = cleanText(raw, 80).toLowerCase().replace(/\s+/g, " ");
  const aliases: Record<string, string> = {
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
    "specialist maths": "specialist-maths",
  };
  return aliases[s] || s;
}

function safeJsonParse(value: string | null | undefined): unknown {
  if (value == null || value === "") return undefined;
  const str = String(value);
  try {
    return JSON.parse(str);
  } catch {
    try {
      const fixed = str
        .replace(/[\u201c\u201d\u201e]/g, '"')
        .replace(/[\u2018\u2019]/g, "'");
      return JSON.parse(fixed);
    } catch {
      try {
        if (/^\s*\[/.test(str) && /'/.test(str)) {
          return JSON.parse(str.replace(/'/g, '"'));
        }
      } catch {
        /* ignore */
      }
      return undefined;
    }
  }
}
function nowIso(): string { return new Date().toISOString(); }

/** Neon/Drizzle often wrap the real Postgres message in `cause`. */
function errorChain(e: unknown): string {
  const parts: string[] = [];
  let cur: unknown = e;
  for (let depth = 0; depth < 6 && cur != null; depth++) {
    if (cur instanceof Error) {
      parts.push(cur.message);
      cur = cur.cause;
    } else if (typeof cur === "object" && cur !== null && "message" in cur) {
      parts.push(String((cur as { message: unknown }).message));
      break;
    } else {
      parts.push(String(cur));
      break;
    }
  }
  return parts.filter(Boolean).join(" — ");
}
function createToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}
function sessionExpiry(): string {
  const d = new Date(); d.setDate(d.getDate() + 30); return d.toISOString();
}
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  return bytes;
}
async function hashPassword(password: string, existingSalt?: string) {
  const encoder = new TextEncoder();
  const saltBytes = existingSalt ? hexToBytes(existingSalt) : crypto.getRandomValues(new Uint8Array(16));
  const salt = bytesToHex(saltBytes);
  const keyMaterial = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const hashBuffer = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: saltBytes, iterations: 100000, hash: "SHA-256" }, keyMaterial, 512);
  return { salt, hash: bytesToHex(new Uint8Array(hashBuffer)) };
}
async function verifyPassword(password: string, salt: string, storedHash: string): Promise<boolean> {
  const { hash } = await hashPassword(password, salt);
  if (hash.length !== storedHash.length) return false;
  let result = 0;
  for (let i = 0; i < hash.length; i++) result |= hash.charCodeAt(i) ^ storedHash.charCodeAt(i);
  return result === 0;
}

// ---- DB ----
function createDb(url: string) {
  return drizzle(neon(url), {
    schema: {
      users,
      sessions,
      quizAttempts,
      writtenResponses,
      quizComments,
      customQuestions,
      chatMessages,
      questionAttempts,
      forumPosts,
      forumReplies,
    },
  });
}

type Env = { DATABASE_URL: string; ADMIN_KEY: string; FRONTEND_URL: string };
type Vars = { user: { id: number; email: string; username: string; token: string }; db: ReturnType<typeof createDb> };

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

// CORS
app.use("/api/*", cors({
  origin: (origin, c) => {
    if (origin?.startsWith("http://localhost:")) return origin;
    if (origin?.includes(".pages.dev")) return origin;
    const fe = String(c.env.FRONTEND_URL || "").trim().replace(/\/$/, "");
    if (fe && origin === fe) return origin;
    return origin || "";
  },
  allowHeaders: ["Content-Type", "Authorization", "X-Admin-Key"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true, maxAge: 86400,
}));

// DB middleware
app.use("/api/*", async (c, next) => {
  c.set("db", createDb(c.env.DATABASE_URL));
  await next();
});

// Auth middleware helper
async function authMiddleware(c: any, next: any) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return c.json({ error: "Authentication required." }, 401);
  const token = authHeader.slice(7);
  const db = c.get("db");
  const result = await db.select({ userId: users.id, email: users.email, username: users.username, expiresAt: sessions.expiresAt })
    .from(sessions).innerJoin(users, eq(sessions.userId, users.id)).where(eq(sessions.token, token)).limit(1);
  if (result.length === 0) return c.json({ error: "Invalid session." }, 401);
  if (new Date(result[0].expiresAt) < new Date()) {
    await db.delete(sessions).where(eq(sessions.token, token));
    return c.json({ error: "Session expired." }, 401);
  }
  c.set("user", { id: result[0].userId, email: result[0].email, username: result[0].username, token });
  await next();
}

/** Admin routes: `x-admin-key` matching `ADMIN_KEY`, or logged-in `ADMIN_EMAIL_LC`. */
async function adminAccessMiddleware(c: any, next: any) {
  const headerKey = (c.req.header("x-admin-key") || c.req.header("X-Admin-Key") || "").trim();
  if (headerKey && headerKey === c.env.ADMIN_KEY) {
    await next();
    return;
  }
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Admin access denied." }, 403);
  }
  const token = authHeader.slice(7);
  const db = c.get("db");
  const result = await db
    .select({
      userId: users.id,
      email: users.email,
      username: users.username,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token))
    .limit(1);
  if (result.length === 0) return c.json({ error: "Invalid session." }, 401);
  if (new Date(result[0].expiresAt) < new Date()) {
    await db.delete(sessions).where(eq(sessions.token, token));
    return c.json({ error: "Session expired." }, 401);
  }
  const email = String(result[0].email || "").toLowerCase();
  if (email !== ADMIN_EMAIL_LC) {
    return c.json({ error: "Admin access denied." }, 403);
  }
  c.set("user", {
    id: result[0].userId,
    email: result[0].email,
    username: result[0].username,
    token,
  });
  await next();
}

// ---- Auth routes ----
app.post("/api/auth/signup", async (c) => {
  const body = await c.req.json();
  const db = c.get("db");
  const username = cleanText(body.username, 40);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "").trim();
  if (username.length < 2) return c.json({ error: "Username must be at least 2 characters." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: "Please enter a valid email." }, 400);
  if (password.length < 4) return c.json({ error: "Password must be at least 4 characters." }, 400);
  const existingEmail = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existingEmail.length > 0) return c.json({ error: "An account with this email already exists." }, 400);
  const existingUsername = await db.select({ id: users.id }).from(users).where(sql`LOWER(${users.username}) = LOWER(${username})`).limit(1);
  if (existingUsername.length > 0) return c.json({ error: "That username is already taken." }, 400);
  const { salt, hash } = await hashPassword(password);
  const result = await db.insert(users).values({ username, email, passwordHash: hash, passwordSalt: salt, hashAlgorithm: "pbkdf2", createdAt: nowIso() }).returning({ id: users.id });
  const token = createToken();
  await db.insert(sessions).values({ token, userId: result[0].id, createdAt: nowIso(), expiresAt: sessionExpiry() });
  return c.json({ token, user: { id: result[0].id, username, email } });
});

app.post("/api/auth/login", async (c) => {
  const body = await c.req.json();
  const db = c.get("db");
  const loginValue = String(body.email || body.username || "").trim().toLowerCase();
  const password = String(body.password || "").trim();
  if (!loginValue || !password) return c.json({ error: "Please enter your credentials." }, 400);
  const result = await db.select().from(users).where(or(sql`LOWER(${users.email}) = ${loginValue}`, sql`LOWER(${users.username}) = ${loginValue}`)).limit(1);
  if (result.length === 0) return c.json({ error: "Invalid login details." }, 400);
  const user = result[0];
  if (user.hashAlgorithm === "scrypt") return c.json({ error: "Password reset required." }, 400);
  const valid = await verifyPassword(password, user.passwordSalt, user.passwordHash);
  if (!valid) return c.json({ error: "Invalid login details." }, 400);
  const token = createToken();
  await db.insert(sessions).values({ token, userId: user.id, createdAt: nowIso(), expiresAt: sessionExpiry() });
  return c.json({ token, user: { id: user.id, username: user.username || user.email, email: user.email } });
});

app.post("/api/auth/logout", authMiddleware, async (c: any) => {
  const user = c.get("user");
  await c.get("db").delete(sessions).where(eq(sessions.token, user.token));
  return c.json({ ok: true });
});

// Legacy aliases
app.post("/api/signup", async (c) => { const db = createDb(c.env.DATABASE_URL); c.set("db", db); return app.fetch(new Request(new URL("/api/auth/signup", c.req.url), c.req.raw), c.env); });
app.post("/api/login", async (c) => { const db = createDb(c.env.DATABASE_URL); c.set("db", db); return app.fetch(new Request(new URL("/api/auth/login", c.req.url), c.req.raw), c.env); });

// ---- Bootstrap ----
app.get("/api/bootstrap", authMiddleware, async (c: any) => {
  const user = c.get("user");
  const db = c.get("db");
  const rows = await db.select().from(customQuestions).orderBy(asc(customQuestions.subjectId), asc(customQuestions.createdAt));
  const grouped: Record<string, any[]> = {};
  for (const row of rows) {
    const sid = canonicalSubjectId(row.subjectId);
    if (!grouped[sid]) grouped[sid] = [];
    const opts = safeJsonParse(row.options) as string[] | undefined;
    const acc = safeJsonParse(row.acceptedAnswers) as string[] | undefined;
    const imgs = safeJsonParse(row.imageUrls) as string[] | undefined;
    const t = String(row.type || "");
    const marksNum = Number(row.marks);
    const marks =
      Number.isFinite(marksNum) && marksNum > 0 ? Math.round(marksNum) : 1;
    grouped[sid].push({
      id: row.id,
      type: t === "short_answer" ? "short" : t === "long_answer" ? "long" : row.type,
      topic: row.topic ?? "General",
      question: row.question,
      imageUrls: imgs,
      options: opts,
      answer: row.answer || undefined,
      acceptedAnswers: acc,
      guidance: row.guidance || undefined,
      passage: row.passage || undefined,
      marks,
    });
  }
  return c.json({ user: { id: user.id, email: user.email, username: user.username }, customQuestions: grouped });
});

// ---- Quiz ----
app.post("/api/quiz/submit", authMiddleware, async (c: any) => {
  const user = c.get("user"); const db = c.get("db"); const body = await c.req.json();
  const subjectId = cleanText(body.subjectId, 80);
  const score = Math.max(0, Number(body.score || 0));
  const totalQuestions = Math.max(1, Number(body.totalQuestions || 0));
  if (!subjectId) return c.json({ error: "Invalid." }, 400);
  const percent = Math.round((score / totalQuestions) * 100);
  await db.insert(quizAttempts).values({ userId: user.id, subjectId, score, totalQuestions, percent, createdAt: nowIso() });
  return c.json({ ok: true, percent });
});

// ---- Leaderboard ----
app.get("/api/leaderboard/:subjectId", async (c) => {
  const db = c.get("db"); const subjectId = c.req.param("subjectId");
  const rows = await db.execute(sql`SELECT u.username, MAX(qa.percent) AS best_percent, MAX(qa.score) AS best_score, MAX(qa.total_questions) AS best_total, COUNT(qa.id) AS attempts FROM quiz_attempts qa JOIN users u ON u.id = qa.user_id WHERE qa.subject_id = ${subjectId} GROUP BY qa.user_id, u.username ORDER BY best_percent DESC, best_score DESC LIMIT 10`);
  return c.json({ leaderboard: rows.rows });
});

// ---- Competition ----
app.post("/api/competition/answer", authMiddleware, async (c: any) => {
  const user = c.get("user"); const db = c.get("db"); const body = await c.req.json();
  const subjectId = cleanText(body.subjectId, 80); const questionKey = cleanText(body.questionKey, 1000);
  const topic = cleanText(body.topic || "General", 100); const isCorrect = body.isCorrect ? 1 : 0;
  if (!subjectId || !questionKey) return c.json({ error: "Required fields missing." }, 400);
  await db.execute(sql`INSERT INTO question_attempts (user_id, subject_id, question_key, topic, is_correct, answered_at) VALUES (${user.id}, ${subjectId}, ${questionKey}, ${topic}, ${isCorrect}, ${nowIso()}) ON CONFLICT(user_id, subject_id, question_key) DO NOTHING`);
  return c.json({ ok: true });
});

app.get("/api/competition/:subjectId/stats", authMiddleware, async (c: any) => {
  const user = c.get("user"); const db = c.get("db"); const subjectId = c.req.param("subjectId");
  const studentResult = await db.execute(sql`SELECT COUNT(DISTINCT user_id) as count FROM question_attempts WHERE subject_id = ${subjectId}`);
  const totalStudents = Number(studentResult.rows[0].count);
  if (totalStudents < 2) return c.json({ totalStudents, percentile: null, rank: null, leaderboard: [], questionStats: [], topicStats: [] });
  const allScores = await db.execute(sql`SELECT qa.user_id, u.username, SUM(qa.is_correct) as correct, COUNT(*) as total FROM question_attempts qa JOIN users u ON u.id = qa.user_id WHERE qa.subject_id = ${subjectId} GROUP BY qa.user_id, u.username`);
  const scores = allScores.rows as any[];
  const myRow = scores.find(r => r.user_id === user.id);
  const myPercent = myRow && myRow.total > 0 ? Math.round((Number(myRow.correct) / Number(myRow.total)) * 100) : 0;
  const sorted = [...scores].sort((a, b) => { const pa = a.total > 0 ? Number(a.correct) / Number(a.total) : 0; const pb = b.total > 0 ? Number(b.correct) / Number(b.total) : 0; return pb - pa; });
  const rank = sorted.findIndex(r => r.user_id === user.id) + 1;
  const below = sorted.filter(r => { const p = r.total > 0 ? Math.round((Number(r.correct) / Number(r.total)) * 100) : 0; return p < myPercent; }).length;
  const percentile = totalStudents > 1 ? Math.round((below / (totalStudents - 1)) * 100) : 100;
  const leaderboardData = sorted.slice(0, 10).map(r => ({ userId: r.user_id, username: r.username, correct: Number(r.correct), total: Number(r.total), percent: r.total > 0 ? Math.round((Number(r.correct) / Number(r.total)) * 100) : 0 }));
  const qRows = await db.execute(sql`SELECT question_key, topic, SUM(is_correct) as correct_count, COUNT(*) as total_answered FROM question_attempts WHERE subject_id = ${subjectId} GROUP BY question_key, topic`);
  const questionStats = (qRows.rows as any[]).map(r => ({ questionKey: r.question_key, topic: r.topic, correctCount: Number(r.correct_count), totalAnswered: Number(r.total_answered) }));
  const topicClassRows = await db.execute(sql`SELECT topic, SUM(is_correct) as correct_count, COUNT(*) as total_answered FROM question_attempts WHERE subject_id = ${subjectId} GROUP BY topic`);
  const topicMyRows = await db.execute(sql`SELECT topic, SUM(is_correct) as my_correct, COUNT(*) as my_total FROM question_attempts WHERE subject_id = ${subjectId} AND user_id = ${user.id} GROUP BY topic`);
  const myTopicMap: Record<string, { myCorrect: number; myTotal: number }> = {};
  for (const r of topicMyRows.rows as any[]) myTopicMap[r.topic] = { myCorrect: Number(r.my_correct), myTotal: Number(r.my_total) };
  const topicStats = (topicClassRows.rows as any[]).map(r => ({ topic: r.topic, correctCount: Number(r.correct_count), totalAnswered: Number(r.total_answered), myCorrect: myTopicMap[r.topic]?.myCorrect ?? null, myTotal: myTopicMap[r.topic]?.myTotal ?? 0 }));
  return c.json({ totalStudents, percentile, rank, leaderboard: leaderboardData, questionStats, topicStats });
});

// ---- Comments ----
app.get("/api/comments/:subjectId/:questionKey", authMiddleware, async (c: any) => {
  const db = c.get("db");
  const rows = await db.execute(sql`SELECT qc.id, qc.parent_comment_id, qc.text, qc.created_at, u.username, u.id AS user_id FROM quiz_comments qc JOIN users u ON u.id = qc.user_id WHERE qc.subject_id = ${c.req.param("subjectId")} AND qc.question_key = ${c.req.param("questionKey")} ORDER BY qc.created_at ASC`);
  return c.json({ comments: (rows.rows as any[]).map(r => ({ id: r.id, parentCommentId: r.parent_comment_id, text: r.text, time: r.created_at, username: r.username, userId: r.user_id })) });
});

app.post("/api/comments/:subjectId/:questionKey", authMiddleware, async (c: any) => {
  const user = c.get("user"); const db = c.get("db"); const body = await c.req.json();
  const text = cleanText(body.text, 1000);
  const parentCommentId = body.parentCommentId == null ? null : Number(body.parentCommentId);
  if (!text) return c.json({ error: "Comment cannot be empty." }, 400);
  const result = await db.insert(quizComments).values({ subjectId: c.req.param("subjectId"), questionKey: c.req.param("questionKey"), userId: user.id, parentCommentId, text, createdAt: nowIso() }).returning({ id: quizComments.id });
  return c.json({ comment: { id: result[0].id, parentCommentId, text, time: nowIso(), username: user.username, userId: user.id } });
});

// ---- Written ----
app.get("/api/written/:subjectId/:questionKey", authMiddleware, async (c: any) => {
  const user = c.get("user"); const db = c.get("db");
  const rows = await db.select({ responseText: writtenResponses.responseText, updatedAt: writtenResponses.updatedAt }).from(writtenResponses)
    .where(and(eq(writtenResponses.userId, user.id), eq(writtenResponses.subjectId, c.req.param("subjectId")), eq(writtenResponses.questionKey, c.req.param("questionKey")))).limit(1);
  return c.json({ response: rows.length > 0 ? { text: rows[0].responseText, updatedAt: rows[0].updatedAt } : null });
});

app.put("/api/written/:subjectId/:questionKey", authMiddleware, async (c: any) => {
  const user = c.get("user"); const db = c.get("db"); const body = await c.req.json();
  const responseText = cleanText(body.responseText, 12000);
  if (!responseText) return c.json({ error: "Response cannot be empty." }, 400);
  await db.execute(sql`INSERT INTO written_responses (user_id, subject_id, question_key, response_text, updated_at) VALUES (${user.id}, ${c.req.param("subjectId")}, ${c.req.param("questionKey")}, ${responseText}, ${nowIso()}) ON CONFLICT(user_id, subject_id, question_key) DO UPDATE SET response_text = EXCLUDED.response_text, updated_at = EXCLUDED.updated_at`);
  return c.json({ ok: true });
});

app.get("/api/written/:subjectId/:questionKey/all", authMiddleware, async (c: any) => {
  const db = c.get("db");
  const rows = await db.execute(sql`SELECT wr.response_text, wr.updated_at, u.id AS user_id FROM written_responses wr JOIN users u ON u.id = wr.user_id WHERE wr.subject_id = ${c.req.param("subjectId")} AND wr.question_key = ${c.req.param("questionKey")} ORDER BY wr.updated_at DESC`);
  return c.json({ responses: (rows.rows as any[]).map(r => ({ text: r.response_text, updatedAt: r.updated_at, userId: r.user_id })) });
});

// ---- Chat ----
app.get("/api/chat/:subjectId", authMiddleware, async (c: any) => {
  const db = c.get("db");
  const rows = await db.execute(sql`SELECT id, user_id, username, text, created_at FROM chat_messages WHERE subject_id = ${c.req.param("subjectId")} ORDER BY created_at ASC, id ASC LIMIT 200`);
  return c.json({ messages: (rows.rows as any[]).map(r => ({ id: r.id, userId: r.user_id, username: r.username, text: r.text, time: r.created_at })) });
});

app.post("/api/chat/:subjectId", authMiddleware, async (c: any) => {
  const user = c.get("user"); const db = c.get("db"); const body = await c.req.json();
  const text = cleanText(body.text, 1000);
  if (!text) return c.json({ error: "Message cannot be empty." }, 400);
  const result = await db.insert(chatMessages).values({ subjectId: c.req.param("subjectId"), userId: user.id, username: user.username, text, createdAt: nowIso() }).returning({ id: chatMessages.id });
  return c.json({ message: { id: result[0].id, userId: user.id, username: user.username, text, time: nowIso() } });
});

// ---- Forum (posts + replies) ----
app.get("/api/forum/:subjectId/posts", authMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    const subjectId = c.req.param("subjectId");
    const result = await db.execute(sql`
      SELECT * FROM (
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
          (SELECT COUNT(*)::integer FROM forum_replies r WHERE r.post_id = p.id) AS reply_count,
          (
            SELECT MAX(sub.ts) FROM (
              SELECT p.updated_at AS ts
              UNION ALL
              SELECT r.created_at AS ts FROM forum_replies r WHERE r.post_id = p.id
            ) AS sub
          ) AS last_activity_at
        FROM forum_posts p
        WHERE p.subject_id = ${subjectId}
      ) q
      ORDER BY last_activity_at DESC NULLS LAST, q.id DESC
      LIMIT 200
    `);
    const rows = result.rows as Record<string, unknown>[];
    return c.json({
      posts: rows.map((r) => ({
        id: String(r.id),
        subjectId: String(r.subject_id),
        userId: String(r.user_id),
        username: String(r.username ?? ""),
        title: String(r.title ?? ""),
        body: String(r.body ?? ""),
        imageUrls: r.image_urls
          ? (safeJsonParse(String(r.image_urls)) as string[] | undefined)
          : undefined,
        createdAt: String(r.created_at ?? ""),
        updatedAt: String(r.updated_at ?? ""),
        replyCount: Number(r.reply_count ?? 0),
        lastActivityAt: String(r.last_activity_at ?? r.updated_at ?? ""),
      })),
    });
  } catch (e: unknown) {
    console.error("[Forum posts GET]", errorChain(e));
    return c.json(
      {
        error:
          "Could not load forum posts. If you use Neon, run `pages-deploy/neon-forum-tables.sql`.",
      },
      500,
    );
  }
});

app.post("/api/forum/:subjectId/posts", authMiddleware, async (c: any) => {
  try {
    const user = c.get("user");
    const db = c.get("db");
    const subjectId = c.req.param("subjectId");
    const body = await c.req.json();
    const title = cleanText(body.title, 140);
    const textBody = cleanText(body.body, 4000);
    if (!title) return c.json({ error: "Title is required." }, 400);
    if (!textBody) return c.json({ error: "Post text is required." }, 400);

    const imageUrlsRaw = Array.isArray(body.imageUrls) ? body.imageUrls : null;
    const imageUrlsArr = imageUrlsRaw
      ? imageUrlsRaw
          .map((u: unknown) => String(u ?? "").trim())
          .filter(Boolean)
          .slice(0, 6)
      : null;
    const imageUrlsJson =
      imageUrlsArr && imageUrlsArr.length ? JSON.stringify(imageUrlsArr) : null;

    const createdAt = nowIso();
    const inserted = await db
      .insert(forumPosts)
      .values({
        subjectId,
        userId: user.id,
        username: user.username,
        title,
        body: textBody,
        imageUrls: imageUrlsJson,
        createdAt,
        updatedAt: createdAt,
      })
      .returning({ id: forumPosts.id });

    return c.json({
      post: {
        id: String(inserted[0].id),
        subjectId,
        userId: String(user.id),
        username: user.username,
        title,
        body: textBody,
        imageUrls: imageUrlsArr ?? undefined,
        createdAt,
        updatedAt: createdAt,
        replyCount: 0,
        lastActivityAt: createdAt,
      },
    });
  } catch (e: unknown) {
    console.error("[Forum posts POST]", errorChain(e));
    return c.json(
      {
        error: `${errorChain(e)} Run pages-deploy/neon-forum-tables.sql on Neon if forum tables are missing.`,
      },
      500,
    );
  }
});

app.get("/api/forum/:subjectId/posts/:postId", authMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    const subjectId = c.req.param("subjectId");
    const postId = Number(c.req.param("postId"));
    if (!postId || Number.isNaN(postId)) {
      return c.json({ error: "Invalid post id." }, 400);
    }

    const postRows = await db
      .select()
      .from(forumPosts)
      .where(
        and(eq(forumPosts.id, postId), eq(forumPosts.subjectId, subjectId)),
      )
      .limit(1);
    if (postRows.length === 0) return c.json({ error: "Post not found." }, 404);

    const p = postRows[0];
    const replies = await db
      .select()
      .from(forumReplies)
      .where(
        and(eq(forumReplies.postId, postId), eq(forumReplies.subjectId, subjectId)),
      )
      .orderBy(asc(forumReplies.createdAt), asc(forumReplies.id))
      .limit(500);

    return c.json({
      post: {
        id: String(p.id),
        subjectId: p.subjectId,
        userId: String(p.userId),
        username: p.username,
        title: p.title,
        body: p.body,
        imageUrls: safeJsonParse(p.imageUrls ?? null) as string[] | undefined,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      },
      replies: replies.map((r) => ({
        id: String(r.id),
        postId: String(r.postId),
        userId: String(r.userId),
        username: r.username,
        body: r.body,
        createdAt: r.createdAt,
      })),
    });
  } catch (e: unknown) {
    console.error("[Forum post GET]", errorChain(e));
    return c.json({ error: "Could not load post." }, 500);
  }
});

app.post(
  "/api/forum/:subjectId/posts/:postId/replies",
  authMiddleware,
  async (c: any) => {
    try {
      const user = c.get("user");
      const db = c.get("db");
      const subjectId = c.req.param("subjectId");
      const postId = Number(c.req.param("postId"));
      if (!postId || Number.isNaN(postId)) {
        return c.json({ error: "Invalid post id." }, 400);
      }

      const body = await c.req.json();
      const textBody = cleanText(body.body, 4000);
      if (!textBody) return c.json({ error: "Reply text is required." }, 400);

      const postCheck = await db
        .select({ id: forumPosts.id })
        .from(forumPosts)
        .where(
          and(eq(forumPosts.id, postId), eq(forumPosts.subjectId, subjectId)),
        )
        .limit(1);
      if (postCheck.length === 0) {
        return c.json({ error: "Post not found." }, 404);
      }

      const createdAt = nowIso();
      const ins = await db
        .insert(forumReplies)
        .values({
          postId,
          subjectId,
          userId: user.id,
          username: user.username,
          body: textBody,
          createdAt,
        })
        .returning({ id: forumReplies.id });

      await db
        .update(forumPosts)
        .set({ updatedAt: createdAt })
        .where(eq(forumPosts.id, postId));

      return c.json({
        reply: {
          id: String(ins[0].id),
          postId: String(postId),
          userId: String(user.id),
          username: user.username,
          body: textBody,
          createdAt,
        },
      });
    } catch (e: unknown) {
      console.error("[Forum replies POST]", errorChain(e));
      return c.json({ error: "Could not add reply." }, 500);
    }
  },
);

// ---- Admin ----
app.get("/api/admin/questions", adminAccessMiddleware, async (c: any) => {
  const db = c.get("db");
  const rows = await db
    .select()
    .from(customQuestions)
    .orderBy(asc(customQuestions.subjectId), asc(customQuestions.createdAt));
  const list = rows.map((row) => {
    const opts = safeJsonParse(row.options) as string[] | undefined;
    const acc = safeJsonParse(row.acceptedAnswers) as string[] | undefined;
    const imgs = safeJsonParse(row.imageUrls) as string[] | undefined;
    return {
      id: String(row.id),
      subjectId: row.subjectId,
      subjectName: row.subjectId,
      type: row.type,
      topic: row.topic ?? "General",
      question: row.question,
      imageUrls: imgs,
      options: opts,
      correctAnswer: row.answer || undefined,
      acceptedAnswers: acc,
      marks: typeof row.marks === "number" ? row.marks : 1,
      guidance: row.guidance || undefined,
      passage: row.passage || undefined,
    };
  });
  return c.json(list);
});

app.post("/api/admin/questions", adminAccessMiddleware, async (c: any) => {
  const db = c.get("db");
  let body: Record<string, unknown>;
  try {
    body = await c.req.json() as Record<string, unknown>;
  } catch {
    return c.json({ error: "Invalid JSON body." }, 400);
  }
  const subjectId = canonicalSubjectId(cleanText(body.subjectId, 80));
  const type = cleanText(body.type, 20);
  const question = cleanText(body.question, 1000);
  const topic = cleanText(body.topic || "General", 100);
  const imageUrlsRaw = Array.isArray(body.imageUrls) ? body.imageUrls : null;
  const imageUrlsArr = imageUrlsRaw
    ? imageUrlsRaw
        .map((u: unknown) => String(u ?? "").trim())
        .filter(Boolean)
        .slice(0, 6)
    : null;
  const imageUrlsJson =
    imageUrlsArr && imageUrlsArr.length ? JSON.stringify(imageUrlsArr) : null;
  const optionsJson = body.options ? JSON.stringify(body.options) : null;
  const answerRaw = body.correctAnswer ?? body.answer;
  const answer = answerRaw ? cleanText(String(answerRaw), 500) : null;
  const acceptedAnswersJson = body.acceptedAnswers
    ? JSON.stringify(body.acceptedAnswers)
    : null;
  const guidance = body.guidance ? cleanText(body.guidance, 500) : null;
  const passage = body.passage ? cleanText(body.passage, 3000) : null;
  const marksDefault = type === "mcq" ? 1 : 2;
  const marksParsed = Math.round(Number(body.marks ?? marksDefault));
  const marks = Number.isFinite(marksParsed)
    ? Math.max(1, marksParsed)
    : marksDefault;

  if (!subjectId || !type || !question) {
    return c.json({ error: "subjectId, type, and question are required." }, 400);
  }

  try {
    const result = await db
      .insert(customQuestions)
      .values({
        subjectId,
        type,
        topic,
        question,
        imageUrls: imageUrlsJson,
        options: optionsJson,
        answer,
        acceptedAnswers: acceptedAnswersJson,
        guidance,
        passage,
        marks,
        createdAt: nowIso(),
      })
      .returning({ id: customQuestions.id });

    return c.json({ ok: true, id: result[0].id });
  } catch (e: unknown) {
    const msg = errorChain(e);
    console.error("[admin/questions POST]", msg);
    let hint = "";
    if (/column|does not exist/i.test(msg)) {
      hint =
        " Run `neon-add-custom-question-columns.sql` from the repo on Neon if `topic` / `image_urls` / `marks` are missing.";
    } else if (/invalid input syntax.*integer|invalid input syntax for type integer/i.test(msg)) {
      hint =
        " Run `neon-custom-questions-subject-id-text.sql` on Neon (or ALTER subject_id to TEXT). The app sends string subject ids.";
    }
    return c.json({ error: `${msg}${hint}` }, 500);
  }
});

app.put("/api/admin/questions/:id", adminAccessMiddleware, async (c: any) => {
  const body = await c.req.json();
  const marks = Math.max(1, Math.round(Number(body.marks ?? 1)));
  await c
    .get("db")
    .update(customQuestions)
    .set({ marks })
    .where(eq(customQuestions.id, Number(c.req.param("id"))));
  return c.json({ ok: true, marks });
});

app.delete("/api/admin/questions/:id", adminAccessMiddleware, async (c: any) => {
  await c
    .get("db")
    .delete(customQuestions)
    .where(eq(customQuestions.id, Number(c.req.param("id"))));
  return c.json({ ok: true });
});

app.get("/api/admin/google-sheet/status", adminAccessMiddleware, async (c: any) => {
  return c.json({ enabled: false });
});

app.post("/api/admin/questions/sync-from-sheet", adminAccessMiddleware, async (c: any) => {
  return c.json(
    { error: "Google Sheets sync is not configured on Cloudflare Workers." },
    503,
  );
});

// ---- Health ----
app.get("/api/health", async (c) => {
  const db = c.get("db");
  const u = await db.execute(sql`SELECT COUNT(*) as c FROM users`);
  const s = await db.execute(sql`SELECT COUNT(*) as c FROM sessions`);
  const ch = await db.execute(sql`SELECT COUNT(*) as c FROM chat_messages`);
  const co = await db.execute(sql`SELECT COUNT(*) as c FROM quiz_comments`);
  return c.json({ ok: true, users: Number(u.rows[0].c), sessions: Number(s.rows[0].c), chats: Number(ch.rows[0].c), comments: Number(co.rows[0].c) });
});

// Export for Pages Functions
export const onRequest: PagesFunction<Env> = async (context) => {
  return app.fetch(context.request, context.env);
};
