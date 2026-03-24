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
  question: text("question").notNull(),
  options: text("options"),
  answer: text("answer"),
  acceptedAnswers: text("accepted_answers"),
  guidance: text("guidance"),
  passage: text("passage"),
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

// ---- Helpers ----
function cleanText(value: unknown, maxLength = 1000): string {
  if (typeof value !== "string") return "";
  return value.replace(/\0/g, "").trim().slice(0, maxLength);
}
function nowIso(): string { return new Date().toISOString(); }
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
  return drizzle(neon(url), { schema: { users, sessions, quizAttempts, writtenResponses, quizComments, customQuestions, chatMessages, questionAttempts } });
}

type Env = { DATABASE_URL: string; ADMIN_KEY: string; FRONTEND_URL: string };
type Vars = { user: { id: number; email: string; username: string; token: string }; db: ReturnType<typeof createDb> };

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

// CORS
app.use("/api/*", cors({
  origin: (origin) => {
    if (origin?.startsWith("http://localhost:")) return origin;
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

function adminMiddleware(c: any, next: any) {
  const key = c.req.header("x-admin-key");
  if (!key || key !== c.env.ADMIN_KEY) return c.json({ error: "Forbidden" }, 403);
  return next();
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
    if (!grouped[row.subjectId]) grouped[row.subjectId] = [];
    grouped[row.subjectId].push({ id: row.id, type: row.type, question: row.question, options: row.options ? JSON.parse(row.options) : undefined, answer: row.answer || undefined, acceptedAnswers: row.acceptedAnswers ? JSON.parse(row.acceptedAnswers) : undefined, guidance: row.guidance || undefined, passage: row.passage || undefined });
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
  await db.execute(sql`INSERT INTO question_attempts (user_id, subject_id, question_key, topic, is_correct, answered_at) VALUES (${user.id}, ${subjectId}, ${questionKey}, ${topic}, ${isCorrect}, ${nowIso()}) ON CONFLICT(user_id, subject_id, question_key) DO UPDATE SET is_correct = EXCLUDED.is_correct, topic = EXCLUDED.topic, answered_at = EXCLUDED.answered_at`);
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

// ---- Admin ----
app.get("/api/admin/questions", adminMiddleware, async (c: any) => {
  const db = c.get("db");
  const rows = await db.select().from(customQuestions).orderBy(asc(customQuestions.subjectId), asc(customQuestions.createdAt));
  const grouped: Record<string, any[]> = {};
  for (const row of rows) {
    if (!grouped[row.subjectId]) grouped[row.subjectId] = [];
    grouped[row.subjectId].push({ id: row.id, type: row.type, question: row.question, options: row.options ? JSON.parse(row.options) : undefined, answer: row.answer || undefined, acceptedAnswers: row.acceptedAnswers ? JSON.parse(row.acceptedAnswers) : undefined, guidance: row.guidance || undefined, passage: row.passage || undefined });
  }
  return c.json({ customQuestions: grouped });
});

app.post("/api/admin/questions", adminMiddleware, async (c: any) => {
  const db = c.get("db"); const body = await c.req.json();
  const subjectId = cleanText(body.subjectId, 80); const type = cleanText(body.type, 20); const question = cleanText(body.question, 1000);
  if (!subjectId || !type || !question) return c.json({ error: "Required fields missing." }, 400);
  const result = await db.insert(customQuestions).values({ subjectId, type, question, options: body.options ? JSON.stringify(body.options) : null, answer: body.answer ? cleanText(body.answer, 500) : null, acceptedAnswers: body.acceptedAnswers ? JSON.stringify(body.acceptedAnswers) : null, guidance: body.guidance ? cleanText(body.guidance, 500) : null, passage: body.passage ? cleanText(body.passage, 3000) : null, createdAt: nowIso() }).returning({ id: customQuestions.id });
  return c.json({ ok: true, id: result[0].id });
});

app.delete("/api/admin/questions/:id", adminMiddleware, async (c: any) => {
  await c.get("db").delete(customQuestions).where(eq(customQuestions.id, Number(c.req.param("id"))));
  return c.json({ ok: true });
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
