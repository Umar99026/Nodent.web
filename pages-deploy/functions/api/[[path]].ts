import { Hono } from "hono";
import { cors } from "hono/cors";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, or, and, asc, sql } from "drizzle-orm";
import {
  pgTable, serial, text, integer, unique, index,
} from "drizzle-orm/pg-core";
import {
  isSheetsConfigured,
  sheetsGetTabNames,
  sheetsSubjectIdFromTabMode,
  sheetsReadDataRows,
  sheetsListSpreadsheetTabTitles,
  sheetsParseRow,
} from "../lib/googleSheets";

// ---- Schema ----
const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().default(""),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  hashAlgorithm: text("hash_algorithm").notNull().default("pbkdf2"),
  profilePhoto: text("profile_photo"),
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

const englishBooks = pgTable("english_books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: text("created_at").notNull(),
});

const englishPrompts = pgTable("english_prompts", {
  id: serial("id").primaryKey(),
  bookId: integer("book_id").notNull(),
  promptText: text("prompt_text").notNull(),
  section: text("section").notNull().default("A"),
  createdAt: text("created_at").notNull(),
}, (t) => ({
  bookSectionIdx: index("english_prompts_book_section_idx").on(t.bookId, t.section),
}));

const englishResponses = pgTable(
  "english_responses",
  {
    id: serial("id").primaryKey(),
    promptId: integer("prompt_id").notNull(),
    userId: integer("user_id").notNull(),
    responseType: text("response_type").notNull().default("essay"),
    responseText: text("response_text").notNull().default(""),
    imageUrls: text("image_urls"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (t) => ({
    uniq: unique("english_responses_prompt_user_unique").on(t.promptId, t.userId),
    promptUpdatedIdx: index("english_responses_prompt_updated_idx").on(t.promptId, t.updatedAt),
    userUpdatedIdx: index("english_responses_user_updated_idx").on(t.userId, t.updatedAt),
  }),
);

const englishResponseRatings = pgTable(
  "english_response_ratings",
  {
    id: serial("id").primaryKey(),
    responseId: integer("response_id").notNull(),
    raterUserId: integer("rater_user_id").notNull(),
    score: integer("score").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    uniq: unique("english_response_ratings_unique").on(t.responseId, t.raterUserId),
  }),
);

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
  marks: integer("marks").notNull().default(1),
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

// ---- Friends ----
const friendRequests = pgTable(
  "friend_requests",
  {
    id: serial("id").primaryKey(),
    fromUserId: integer("from_user_id").notNull(),
    toUserId: integer("to_user_id").notNull(),
    status: text("status").notNull().default("pending"), // pending|accepted|rejected
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    fromToIdx: index("friend_requests_from_to_idx").on(t.fromUserId, t.toUserId),
    toStatusIdx: index("friend_requests_to_status_idx").on(t.toUserId, t.status),
  }),
);

const friendships = pgTable(
  "friendships",
  {
    id: serial("id").primaryKey(),
    userLow: integer("user_low").notNull(),
    userHigh: integer("user_high").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => ({
    pairUnique: unique("friendships_user_low_user_high_unique").on(
      t.userLow,
      t.userHigh,
    ),
    lowIdx: index("friendships_user_low_idx").on(t.userLow),
    highIdx: index("friendships_user_high_idx").on(t.userHigh),
  }),
);

const friendAssignments = pgTable(
  "friend_assignments",
  {
    id: serial("id").primaryKey(),
    fromUserId: integer("from_user_id").notNull(),
    toUserId: integer("to_user_id").notNull(),
    subjectId: text("subject_id").notNull(),
    questionKey: text("question_key").notNull(),
    questionJson: text("question_json").notNull(),
    marks: integer("marks").notNull().default(1),
    answerJson: text("answer_json"),
    isCorrect: integer("is_correct"),
    createdAt: text("created_at").notNull(),
    answeredAt: text("answered_at"),
  },
  (t) => ({
    pairIdx: index("friend_assignments_pair_idx").on(t.fromUserId, t.toUserId),
    toAnsweredIdx: index("friend_assignments_to_answered_idx").on(
      t.toUserId,
      t.answeredAt,
    ),
  }),
);

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

function normalizeEnglishSection(raw: unknown): "A" | "B" | "C" {
  const s = String(raw ?? "").trim().toUpperCase();
  return s === "B" ? "B" : s === "C" ? "C" : "A";
}

function friendshipPair(a: number, b: number): { low: number; high: number } {
  const aa = Number(a);
  const bb = Number(b);
  return aa < bb ? { low: aa, high: bb } : { low: bb, high: aa };
}

function normalizeAnswerForFriends(text: unknown): string {
  return String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function scoreAssignedQuestion(question: any, answerPayload: any): boolean {
  const q = question || {};
  const t = String(q.type || "").toLowerCase();
  if (t === "mcq") {
    const a = normalizeAnswerForFriends(answerPayload?.answer);
    const expected = normalizeAnswerForFriends(q.answer);
    return Boolean(a && expected && a === expected);
  }
  if (t === "short") {
    const a = normalizeAnswerForFriends(answerPayload?.answer);
    const accepted = Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [];
    return accepted.some((x: any) => normalizeAnswerForFriends(x) === a);
  }
  // long: not auto-marked
  return false;
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
function safeJsonColumn(value: unknown): string[] | null {
  if (value == null) return null;
  const parsed = safeJsonParse(String(value));
  if (Array.isArray(parsed)) {
    return parsed.map((v) => String(v ?? "").trim()).filter(Boolean);
  }
  return null;
}
function parseFlexibleStringArray(value: unknown): string[] | null {
  const normalizeAnswerEntry = (v: unknown): string => {
    if (typeof v === "string") {
      const t = v.trim();
      if (!t || /^\[object object\]$/i.test(t)) return "";
      if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
        try {
          return normalizeAnswerEntry(JSON.parse(t));
        } catch {
          return t;
        }
      }
      return t;
    }
    if (typeof v === "number" || typeof v === "boolean") return String(v);
    if (v && typeof v === "object") {
      const row = v as Record<string, unknown>;
      const candidate = row.answer ?? row.value ?? row.text ?? row.label;
      if (typeof candidate === "string") return candidate.trim();
      if (typeof candidate === "number" || typeof candidate === "boolean") return String(candidate);
      return "";
    }
    return String(v ?? "").trim();
  };
  const sanitize = (arr: unknown[]): string[] =>
    arr
      .map((v) => normalizeAnswerEntry(v))
      .filter((s) => Boolean(s) && s !== "[object Object]");

  if (value == null) return null;
  if (Array.isArray(value)) {
    const arr = sanitize(value);
    return arr.length ? arr : null;
  }
  const t = String(value ?? "").trim();
  if (!t) return null;
  const parsed = safeJsonParse(t);
  if (Array.isArray(parsed)) {
    const arr = sanitize(parsed);
    if (arr.length) return arr;
  }
  const stripped = t.replace(/^["'`]+|["'`]+$/g, "").trim();
  const inner =
    stripped.startsWith("[") && stripped.endsWith("]")
      ? stripped.slice(1, -1).trim()
      : stripped;
  const candidate = inner || stripped;
  const parts = candidate.includes("\n")
    ? candidate.split("\n")
    : candidate.includes("|")
      ? candidate.split("|")
      : candidate.includes(";")
        ? candidate.split(";")
        : candidate.includes(",")
          ? candidate.split(",")
          : [candidate];
  const out = sanitize(parts.map((p) => p.trim().replace(/^["'`]+|["'`]+$/g, "")));
  return out.length ? out : null;
}
function roundTo(value: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}
function formatNumeric(value: number, dp = 2): string {
  if (!Number.isFinite(value)) return "";
  return Number.isInteger(value) ? String(value) : roundTo(value, dp).toFixed(dp);
}
function computeExpectedAnswersFromQuestionText(questionRaw: unknown): string[] {
  const question = String(questionRaw ?? "").replace(/\s+/g, " ").trim();
  if (!question) return [];

  const leastSquares = question.match(
    /price\s*=\s*([+-]?\d+(?:\.\d+)?)\s*\+\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*\)\s*\*?\s*distance[\s\S]*?(\d+(?:\.\d+)?)\s*km[\s\S]*?sold\s*for\s*\$?\s*([+-]?\d+(?:\.\d+)?)/i,
  );
  if (leastSquares) {
    const a = Number(leastSquares[1]);
    const b = Number(leastSquares[2]);
    const d = Number(leastSquares[3]);
    const sold = Number(leastSquares[4]);
    const predicted = a + b * d;
    const residual = sold - predicted;
    return [formatNumeric(predicted, 2), formatNumeric(residual, 2), residual >= 0 ? "under-predicted" : "over-predicted"];
  }

  const weeklyLoan = question.match(
    /L\s*0\s*=\s*([+-]?\d+(?:\.\d+)?)\s*,?\s*L\s*\(\s*n\s*\+\s*1\s*\)\s*=\s*([+-]?\d+(?:\.\d+)?)\s*\*?\s*L\s*\(\s*n\s*\)\s*-\s*([+-]?\d+(?:\.\d+)?)/i,
  );
  if (weeklyLoan && /effective annual rate/i.test(question) && /L\s*52/i.test(question)) {
    const L0 = Number(weeklyLoan[1]);
    const r = Number(weeklyLoan[2]);
    const p = Number(weeklyLoan[3]);
    let L = L0;
    for (let i = 0; i < 52; i++) L = r * L - p;
    return [formatNumeric((r ** 52 - 1) * 100, 2), formatNumeric(L, 2)];
  }

  const paths = question.match(
    /path lengths:\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)\s*,\s*([+-]?\d+(?:\.\d+)?)/i,
  );
  if (paths && /critical path length/i.test(question) && /crashed by 2 days/i.test(question)) {
    const values = [Number(paths[1]), Number(paths[2]), Number(paths[3])];
    const critical = Math.max(...values);
    const idx = values.indexOf(critical);
    const afterCrash = [...values];
    afterCrash[idx] -= 2;
    return [formatNumeric(critical, 0), formatNumeric(Math.max(...afterCrash), 0)];
  }

  const reducing = question.match(
    /starting balance\s*\$?\s*([+-]?\d+(?:\.\d+)?)[\s\S]*?annual rate\s*([+-]?\d+(?:\.\d+)?)%\s*compounding monthly[\s\S]*?monthly repayment\s*\$?\s*([+-]?\d+(?:\.\d+)?)/i,
  );
  if (reducing && /month-?1 interest/i.test(question) && /new balance/i.test(question)) {
    const balance = Number(reducing[1]);
    const annualPct = Number(reducing[2]);
    const repayment = Number(reducing[3]);
    const interest = balance * (annualPct / 100 / 12);
    return [formatNumeric(interest, 2), formatNumeric(balance + interest - repayment, 2)];
  }

  const particle = question.match(
    /initial velocity\s*([+-]?\d+(?:\.\d+)?)\s*m\/s[\s\S]*?acceleration\s*([+-]?\d+(?:\.\d+)?)\s*m\/s[\s\S]*?after\s*([+-]?\d+(?:\.\d+)?)\s*s/i,
  );
  if (particle && /displacement/i.test(question) && /reversed direction/i.test(question)) {
    const u = Number(particle[1]);
    const a = Number(particle[2]);
    const t = Number(particle[3]);
    const v = u + a * t;
    const s = u * t + 0.5 * a * t * t;
    const reversed = u !== 0 && Math.sign(u) !== Math.sign(v) ? "Yes" : "No";
    return [formatNumeric(v, 2), formatNumeric(s, 2), reversed];
  }

  const quadratic = question.match(
    /g\s*\(\s*x\s*\)\s*=\s*([+-]?\d+(?:\.\d+)?)\s*\(\s*x\s*-\s*([+-]?\d+(?:\.\d+)?)\s*\)\s*\^?\s*2\s*\+\s*([+-]?\d+(?:\.\d+)?)[\s\S]*?g\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*\)[\s\S]*?minimum value/i,
  );
  if (quadratic) {
    const a = Number(quadratic[1]);
    const h = Number(quadratic[2]);
    const k = Number(quadratic[3]);
    const x = Number(quadratic[4]);
    return [formatNumeric(a * (x - h) ** 2 + k, 2), formatNumeric(k, 2)];
  }

  const quadraticStd = question.match(
    /f\s*\(\s*x\s*\)\s*=\s*([+-]?\d+(?:\.\d+)?)\s*x\s*\^?\s*2\s*([+-])\s*(\d+(?:\.\d+)?)\s*x\s*([+-])\s*(\d+(?:\.\d+)?)/i,
  );
  if (quadraticStd && /axis of symmetry/i.test(question) && /minimum value/i.test(question)) {
    const a = Number(quadraticStd[1]);
    const b = Number(quadraticStd[3]) * (quadraticStd[2] === "-" ? -1 : 1);
    const c = Number(quadraticStd[5]) * (quadraticStd[4] === "-" ? -1 : 1);
    if (a !== 0) {
      const xVertex = -b / (2 * a);
      const yVertex = a * xVertex * xVertex + b * xVertex + c;
      return [formatNumeric(xVertex, 2), formatNumeric(yVertex, 2), formatNumeric(xVertex, 2)];
    }
  }

  const complexReciprocal = question.match(
    /express\s*1\s*\/\s*\(\s*([+-]?\d+(?:\.\d+)?)\s*([+-])\s*(\d+(?:\.\d+)?)\s*i\s*\)\s*in\s*the\s*form\s*p\s*\+\s*q\s*i/i,
  );
  if (complexReciprocal) {
    const a = Number(complexReciprocal[1]);
    const sign = complexReciprocal[2] === "-" ? -1 : 1;
    const b = Number(complexReciprocal[3]) * sign;
    const den = a * a + b * b;
    if (den !== 0) {
      const p = a / den;
      const q = -b / den;
      const qSign = q >= 0 ? "+" : "-";
      const qAbs = Math.abs(q);
      const decimal = `${formatNumeric(p, 4)}${qSign}${formatNumeric(qAbs, 4)}i`;
      const ai = Number.isInteger(a);
      const bi = Number.isInteger(Math.abs(b));
      const di = Number.isInteger(den);
      if (ai && bi && di) {
        const exact = `${a}/${den}${b >= 0 ? "-" : "+"}${Math.abs(b)}/${den}i`;
        return [exact, decimal];
      }
      return [decimal];
    }
  }
  return [];
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

type Env = {
  DATABASE_URL: string;
  ADMIN_KEY: string;
  FRONTEND_URL: string;
  /** Google Sheets (optional) — use plain text var + encrypted secret for JSON */
  GOOGLE_SHEETS_SPREADSHEET_ID?: string;
  GOOGLE_SHEETS_TAB_NAME?: string;
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;
  GOOGLE_SHEETS_SUBJECT_FROM_TAB?: string;
};
type Vars = { user: { id: number; email: string; username: string; token: string; profilePhoto?: string | null }; db: ReturnType<typeof createDb> };

const app = new Hono<{ Bindings: Env; Variables: Vars }>();
let englishResponsesConstraintDropped = false;
let usersTablePatched = false;
let performanceIndexesPatched = false;
let lastSessionCleanupAt = 0;

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
  const db = createDb(c.env.DATABASE_URL);
  if (!usersTablePatched) {
    try {
      await db.execute(sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS profile_photo text
      `);
      await db.execute(sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS hash_algorithm text DEFAULT 'pbkdf2'
      `);
    } catch {
      // ignore
    } finally {
      usersTablePatched = true;
    }
  }
  if (!englishResponsesConstraintDropped) {
    try {
      await db.execute(sql`
        ALTER TABLE english_responses
        DROP CONSTRAINT IF EXISTS english_responses_prompt_user_unique
      `);
    } catch {
      // ignore
    } finally {
      englishResponsesConstraintDropped = true;
    }
  }
  if (!performanceIndexesPatched) {
    try {
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS english_prompts_book_section_idx
        ON english_prompts (book_id, section)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS english_responses_prompt_updated_idx
        ON english_responses (prompt_id, updated_at)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS english_responses_user_updated_idx
        ON english_responses (user_id, updated_at)
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS sessions_expires_at_idx
        ON sessions (expires_at)
      `);
    } catch {
      // ignore
    } finally {
      performanceIndexesPatched = true;
    }
  }
  const nowMs = Date.now();
  if (nowMs - lastSessionCleanupAt > 10 * 60 * 1000) {
    try {
      await db.execute(sql`
        DELETE FROM sessions
        WHERE expires_at < ${new Date().toISOString()}
      `);
    } catch {
      // ignore
    } finally {
      lastSessionCleanupAt = nowMs;
    }
  }
  c.set("db", db);
  await next();
});

// Auth middleware helper
async function authMiddleware(c: any, next: any) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return c.json({ error: "Authentication required." }, 401);
  const token = authHeader.slice(7);
  const db = c.get("db");
  const result = await db.select({ userId: users.id, email: users.email, username: users.username, profilePhoto: users.profilePhoto, expiresAt: sessions.expiresAt })
    .from(sessions).innerJoin(users, eq(sessions.userId, users.id)).where(eq(sessions.token, token)).limit(1);
  if (result.length === 0) return c.json({ error: "Invalid session." }, 401);
  if (new Date(result[0].expiresAt) < new Date()) {
    await db.delete(sessions).where(eq(sessions.token, token));
    return c.json({ error: "Session expired." }, 401);
  }
  c.set("user", {
    id: result[0].userId,
    email: result[0].email,
    username: result[0].username,
    profilePhoto: result[0].profilePhoto ?? null,
    token,
  });
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
  return c.json({ token, user: { id: result[0].id, username, email, profilePhoto: null } });
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
  return c.json({
    token,
    user: {
      id: user.id,
      username: user.username || user.email,
      email: user.email,
      profilePhoto: user.profilePhoto ?? null,
    },
  });
});

app.post("/api/auth/logout", authMiddleware, async (c: any) => {
  const user = c.get("user");
  await c.get("db").delete(sessions).where(eq(sessions.token, user.token));
  return c.json({ ok: true });
});

app.patch("/api/auth/account", authMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    const user = c.get("user");
    const body = await c.req.json();
    const usernameRaw = body?.username;
    const currentPassword = String(body?.currentPassword || "").trim();
    const newPassword = String(body?.newPassword || "").trim();
    const profilePhotoProvided = Object.prototype.hasOwnProperty.call(body ?? {}, "profilePhoto");
    const profilePhotoRaw = body?.profilePhoto;

    const rows = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!rows.length) return c.json({ error: "User not found." }, 404);
    const current = rows[0];

    const updateData: Record<string, unknown> = {};

    if (typeof usernameRaw === "string") {
      const username = cleanText(usernameRaw, 40);
      if (username.length < 2) return c.json({ error: "Username must be at least 2 characters." }, 400);
      const exists = await db
        .select({ id: users.id })
        .from(users)
        .where(and(sql`LOWER(${users.username}) = LOWER(${username})`, sql`${users.id} <> ${user.id}`))
        .limit(1);
      if (exists.length) return c.json({ error: "That username is already taken." }, 400);
      updateData.username = username;
    }

    if (newPassword || currentPassword) {
      if (!newPassword || !currentPassword) {
        return c.json({ error: "Provide both current and new password." }, 400);
      }
      if (newPassword.length < 4) {
        return c.json({ error: "New password must be at least 4 characters." }, 400);
      }
      const valid = await verifyPassword(
        currentPassword,
        current.passwordSalt,
        current.passwordHash,
      );
      if (!valid) return c.json({ error: "Current password is incorrect." }, 400);
      const { salt, hash } = await hashPassword(newPassword);
      updateData.passwordSalt = salt;
      updateData.passwordHash = hash;
      updateData.hashAlgorithm = "pbkdf2";
    }

    if (profilePhotoProvided) {
      const profilePhoto =
        typeof profilePhotoRaw === "string" && profilePhotoRaw.trim()
          ? String(profilePhotoRaw).trim()
          : null;
      if (profilePhoto && profilePhoto.length > 2_500_000) {
        return c.json({ error: "Profile photo is too large." }, 400);
      }
      updateData.profilePhoto = profilePhoto;
    }

    if (Object.keys(updateData).length > 0) {
      await db.update(users).set(updateData).where(eq(users.id, user.id));
    }
    const refreshed = await db
      .select({
        id: users.id,
        username: users.username,
        email: users.email,
        profilePhoto: users.profilePhoto,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    return c.json({
      user: {
        id: refreshed[0].id,
        username: refreshed[0].username || refreshed[0].email,
        email: refreshed[0].email,
        profilePhoto: refreshed[0].profilePhoto ?? null,
      },
    });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
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
    const acc = parseFlexibleStringArray(
      (safeJsonParse(row.acceptedAnswers) as unknown) ?? row.acceptedAnswers,
    ) ?? undefined;
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
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      profilePhoto: user.profilePhoto ?? null,
    },
    customQuestions: grouped,
  });
});

// ---- Friends ----
app.get("/api/friends", authMiddleware, async (c: any) => {
  const me = c.get("user");
  const db = c.get("db");
  const rows = await db.execute(sql`
    SELECT
      CASE WHEN f.user_low = ${me.id} THEN f.user_high ELSE f.user_low END AS user_id,
      u.username,
      u.email
    FROM friendships f
    JOIN users u
      ON u.id = CASE WHEN f.user_low = ${me.id} THEN f.user_high ELSE f.user_low END
    WHERE f.user_low = ${me.id} OR f.user_high = ${me.id}
    ORDER BY LOWER(u.username) ASC
  `);
  return c.json({
    friends: (rows.rows as any[]).map((r) => ({
      userId: Number(r.user_id),
      username: String(r.username || ""),
      email: String(r.email || ""),
    })),
  });
});

app.get("/api/friends/requests", authMiddleware, async (c: any) => {
  const me = c.get("user");
  const db = c.get("db");
  const incoming = await db.execute(sql`
    SELECT fr.id AS request_id, fr.from_user_id, u.username
    FROM friend_requests fr
    JOIN users u ON u.id = fr.from_user_id
    WHERE fr.to_user_id = ${me.id} AND fr.status = 'pending'
    ORDER BY fr.created_at DESC, fr.id DESC
  `);
  const outgoing = await db.execute(sql`
    SELECT fr.id AS request_id, fr.to_user_id, u.username
    FROM friend_requests fr
    JOIN users u ON u.id = fr.to_user_id
    WHERE fr.from_user_id = ${me.id} AND fr.status = 'pending'
    ORDER BY fr.created_at DESC, fr.id DESC
  `);
  return c.json({
    incoming: (incoming.rows as any[]).map((r) => ({
      requestId: Number(r.request_id),
      userId: Number(r.from_user_id),
      username: String(r.username || ""),
    })),
    outgoing: (outgoing.rows as any[]).map((r) => ({
      requestId: Number(r.request_id),
      userId: Number(r.to_user_id),
      username: String(r.username || ""),
    })),
  });
});

app.get("/api/friends/unread-count", authMiddleware, async (c: any) => {
  const me = c.get("user");
  const db = c.get("db");
  const r = await db.execute(sql`
    SELECT COUNT(*)::integer AS cnt
    FROM friend_requests
    WHERE to_user_id = ${me.id} AND status = 'pending'
  `);
  const cnt = Number((r.rows as any[])[0]?.cnt ?? 0);
  return c.json({ count: cnt });
});

app.get("/api/friends/search", authMiddleware, async (c: any) => {
  const me = c.get("user");
  const db = c.get("db");
  const q = cleanText(c.req.query("search") || "", 120).toLowerCase();
  if (!q || q.length < 2) return c.json({ results: [] });
  const rows = await db.execute(sql`
    SELECT id, username, email
    FROM users
    WHERE id <> ${me.id}
      AND (LOWER(username) LIKE ${"%" + q + "%"} OR LOWER(email) LIKE ${"%" + q + "%"})
    ORDER BY (LOWER(username) = ${q}) DESC, LOWER(username) ASC
    LIMIT 20
  `);
  return c.json({
    results: (rows.rows as any[]).map((r) => ({
      userId: Number(r.id),
      username: String(r.username || ""),
      email: String(r.email || ""),
    })),
  });
});

app.post("/api/friends/requests", authMiddleware, async (c: any) => {
  const me = c.get("user");
  const db = c.get("db");
  const body = await c.req.json();
  const toUserId = Number(body?.toUserId);
  if (!Number.isFinite(toUserId) || toUserId <= 0) {
    return c.json({ error: "Invalid user." }, 400);
  }
  if (toUserId === Number(me.id)) return c.json({ error: "Cannot add yourself." }, 400);

  const { low, high } = friendshipPair(Number(me.id), toUserId);
  const existingFriend = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(and(eq(friendships.userLow, low), eq(friendships.userHigh, high)))
    .limit(1);
  if (existingFriend.length) return c.json({ ok: true, status: "friends" });

  // If reverse pending exists, auto-accept (dojo-like handshake).
  const reverse = await db
    .select({ id: friendRequests.id })
    .from(friendRequests)
    .where(
      and(
        eq(friendRequests.fromUserId, toUserId),
        eq(friendRequests.toUserId, Number(me.id)),
        eq(friendRequests.status, "pending"),
      ),
    )
    .limit(1);
  if (reverse.length) {
    await db.update(friendRequests).set({ status: "accepted" }).where(eq(friendRequests.id, reverse[0].id));
    await db
      .insert(friendships)
      .values({ userLow: low, userHigh: high, createdAt: nowIso() })
      .onConflictDoNothing();
    return c.json({ ok: true, status: "friends" });
  }

  // Avoid duplicate pending requests from me -> them
  const pending = await db
    .select({ id: friendRequests.id })
    .from(friendRequests)
    .where(
      and(
        eq(friendRequests.fromUserId, Number(me.id)),
        eq(friendRequests.toUserId, toUserId),
        eq(friendRequests.status, "pending"),
      ),
    )
    .limit(1);
  if (pending.length) return c.json({ ok: true, status: "requested" });

  await db.insert(friendRequests).values({
    fromUserId: Number(me.id),
    toUserId,
    status: "pending",
    createdAt: nowIso(),
  });
  return c.json({ ok: true, status: "requested" });
});

app.post("/api/friends/requests/:requestId/accept", authMiddleware, async (c: any) => {
  const me = c.get("user");
  const db = c.get("db");
  const requestId = Number(c.req.param("requestId"));
  const reqRow = await db
    .select()
    .from(friendRequests)
    .where(and(eq(friendRequests.id, requestId), eq(friendRequests.toUserId, Number(me.id)), eq(friendRequests.status, "pending")))
    .limit(1);
  if (!reqRow.length) return c.json({ error: "Request not found." }, 404);

  const fromUserId = Number(reqRow[0].fromUserId);
  const { low, high } = friendshipPair(Number(me.id), fromUserId);
  await db.update(friendRequests).set({ status: "accepted" }).where(eq(friendRequests.id, requestId));
  await db
    .insert(friendships)
    .values({ userLow: low, userHigh: high, createdAt: nowIso() })
    .onConflictDoNothing();
  return c.json({ ok: true });
});

app.post("/api/friends/requests/:requestId/reject", authMiddleware, async (c: any) => {
  const me = c.get("user");
  const db = c.get("db");
  const requestId = Number(c.req.param("requestId"));
  const reqRow = await db
    .select({ id: friendRequests.id })
    .from(friendRequests)
    .where(and(eq(friendRequests.id, requestId), eq(friendRequests.toUserId, Number(me.id)), eq(friendRequests.status, "pending")))
    .limit(1);
  if (!reqRow.length) return c.json({ error: "Request not found." }, 404);
  await db.update(friendRequests).set({ status: "rejected" }).where(eq(friendRequests.id, requestId));
  return c.json({ ok: true });
});

app.get("/api/friends/:friendId/thread", authMiddleware, async (c: any) => {
  const me = c.get("user");
  const db = c.get("db");
  const friendId = Number(c.req.param("friendId"));
  if (!Number.isFinite(friendId) || friendId <= 0) return c.json({ messages: [] });
  const rows = await db.execute(sql`
    SELECT
      id,
      from_user_id,
      to_user_id,
      subject_id,
      question_key,
      question_json,
      marks,
      answer_json,
      is_correct,
      created_at,
      answered_at
    FROM friend_assignments
    WHERE (from_user_id = ${me.id} AND to_user_id = ${friendId})
       OR (from_user_id = ${friendId} AND to_user_id = ${me.id})
    ORDER BY created_at ASC, id ASC
    LIMIT 500
  `);
  return c.json({
    messages: (rows.rows as any[]).map((r) => ({
      assignmentId: Number(r.id),
      fromUserId: Number(r.from_user_id),
      toUserId: Number(r.to_user_id),
      subjectId: String(r.subject_id || ""),
      questionKey: String(r.question_key || ""),
      question: (() => {
        try { return JSON.parse(String(r.question_json || "{}")); } catch { return {}; }
      })(),
      marks: Number(r.marks || 1),
      answer: r.answer_json ? (() => { try { return JSON.parse(String(r.answer_json)); } catch { return null; } })() : null,
      isCorrect: r.is_correct == null ? null : Boolean(Number(r.is_correct)),
      createdAt: String(r.created_at || ""),
      answeredAt: r.answered_at ? String(r.answered_at) : null,
    })),
  });
});

app.post("/api/friends/:friendId/assign", authMiddleware, async (c: any) => {
  const me = c.get("user");
  const db = c.get("db");
  const friendId = Number(c.req.param("friendId"));
  const body = await c.req.json();
  const subjectId = canonicalSubjectId(body?.subjectId);
  const question = body?.question ?? null;
  const questionKey = cleanText(body?.questionKey || "", 2000) || cleanText(body?.question?.question || "", 2000);
  const marksNum = Number(body?.marks ?? body?.question?.marks ?? 1);
  const marks = Number.isFinite(marksNum) && marksNum > 0 ? Math.round(marksNum) : 1;

  if (!Number.isFinite(friendId) || friendId <= 0) return c.json({ error: "Invalid friend." }, 400);
  if (!subjectId) return c.json({ error: "Invalid subject." }, 400);
  if (!question || typeof question !== "object") return c.json({ error: "Invalid question." }, 400);
  if (!questionKey) return c.json({ error: "Invalid question key." }, 400);

  const { low, high } = friendshipPair(Number(me.id), friendId);
  const isFriend = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(and(eq(friendships.userLow, low), eq(friendships.userHigh, high)))
    .limit(1);
  if (!isFriend.length) return c.json({ error: "Not friends." }, 403);

  await db.insert(friendAssignments).values({
    fromUserId: Number(me.id),
    toUserId: friendId,
    subjectId,
    questionKey,
    questionJson: JSON.stringify(question),
    marks,
    createdAt: nowIso(),
  });
  return c.json({ ok: true });
});

app.post("/api/friends/assignments/:assignmentId/answer", authMiddleware, async (c: any) => {
  const me = c.get("user");
  const db = c.get("db");
  const assignmentId = Number(c.req.param("assignmentId"));
  const body = await c.req.json();
  const row = await db
    .select()
    .from(friendAssignments)
    .where(eq(friendAssignments.id, assignmentId))
    .limit(1);
  if (!row.length) return c.json({ error: "Not found." }, 404);
  if (Number(row[0].toUserId) !== Number(me.id)) return c.json({ error: "Forbidden." }, 403);

  let question: any = {};
  try {
    question = JSON.parse(String(row[0].questionJson || "{}"));
  } catch {
    question = {};
  }

  const isCorrect = scoreAssignedQuestion(question, body) ? 1 : 0;
  await db
    .update(friendAssignments)
    .set({
      answerJson: JSON.stringify(body ?? {}),
      isCorrect,
      answeredAt: nowIso(),
    })
    .where(eq(friendAssignments.id, assignmentId));
  return c.json({ ok: true, isCorrect: Boolean(isCorrect) });
});

app.get("/api/friends/:friendId/scorecard", authMiddleware, async (c: any) => {
  const db = c.get("db");
  const friendId = Number(c.req.param("friendId"));
  if (!Number.isFinite(friendId) || friendId <= 0) return c.json({ error: "Invalid user." }, 400);

  // Points here are for friend-assignments, not competition attempts.
  const assigned = await db.execute(sql`
    SELECT
      u.username AS username,
      COUNT(*)::integer AS total_assigned,
      COUNT(*) FILTER (WHERE answered_at IS NOT NULL)::integer AS total_answered,
      COUNT(*) FILTER (WHERE is_correct = 1)::integer AS correct_answers,
      COALESCE(SUM(CASE WHEN is_correct = 1 THEN marks ELSE 0 END), 0)::integer AS points
    FROM friend_assignments fa
    JOIN users u ON u.id = fa.to_user_id
    WHERE fa.to_user_id = ${friendId}
    GROUP BY u.username
  `);
  const r = (assigned.rows as any[])[0] || {};
  return c.json({
    userId: friendId,
    username: String(r.username ?? ""),
    points: Number(r.points ?? 0),
    correctAnswers: Number(r.correct_answers ?? 0),
    attempts: Number(r.total_answered ?? 0),
    totalAssigned: Number(r.total_assigned ?? 0),
  });
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
  const topic = cleanText(body.topic || "General", 100);
  const marks = Math.max(1, Math.round(Number(body.marks ?? 1)));
  const isCorrectRaw = body.isCorrect ?? body.correct;
  const isCorrect = isCorrectRaw ? 1 : 0;
  if (!subjectId || !questionKey) return c.json({ error: "Required fields missing." }, 400);
  await db.execute(sql`INSERT INTO question_attempts (user_id, subject_id, question_key, topic, marks, is_correct, answered_at) VALUES (${user.id}, ${subjectId}, ${questionKey}, ${topic}, ${marks}, ${isCorrect}, ${nowIso()}) ON CONFLICT(user_id, subject_id, question_key) DO UPDATE SET topic = EXCLUDED.topic, marks = EXCLUDED.marks, is_correct = EXCLUDED.is_correct, answered_at = EXCLUDED.answered_at`);
  return c.json({ ok: true });
});

app.get("/api/competition/:subjectId/stats", authMiddleware, async (c: any) => {
  const user = c.get("user"); const db = c.get("db"); const subjectId = c.req.param("subjectId");
  const MIN_RANKED_ATTEMPTS = 10;
  const range = String(c.req.query("range") ?? "all");
  let timeFilter = sql``;
  if (range === "week") {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day + 6) % 7;
    const start = new Date(now);
    start.setDate(now.getDate() - diffToMonday);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    timeFilter = sql` AND answered_at >= ${start.toISOString()} AND answered_at < ${end.toISOString()} `;
  }

  const studentResult = await db.execute(sql`SELECT COUNT(DISTINCT user_id) as count FROM question_attempts WHERE subject_id = ${subjectId} ${timeFilter}`);
  const totalStudents = Number((studentResult.rows[0] as any).count);

  const allScoresRows = await db.execute(sql`
    SELECT qa.user_id, u.username,
           SUM(CASE WHEN qa.is_correct = 1 THEN qa.marks ELSE 0 END) AS marks_correct,
           SUM(qa.marks) AS marks_attempted,
           COUNT(*)::int AS attempt_count
    FROM question_attempts qa
    JOIN users u ON u.id = qa.user_id
    WHERE qa.subject_id = ${subjectId} ${timeFilter}
    GROUP BY qa.user_id, u.username
  `);
  const allScores = allScoresRows.rows as any[];

  const pctRounded = (r: any) => {
    const ma = Number(r.marks_attempted);
    const mc = Number(r.marks_correct);
    return ma > 0 ? Math.round((mc / ma) * 100) : 0;
  };
  const eligible = allScores.filter((r) => Number(r.attempt_count) >= MIN_RANKED_ATTEMPTS);
  const sortedEligible = [...eligible].sort((a, b) => {
    const d = pctRounded(b) - pctRounded(a);
    if (d !== 0) return d;
    const da = Number(b.marks_attempted) - Number(a.marks_attempted);
    if (da !== 0) return da;
    return String(a.username).localeCompare(String(b.username));
  });

  const myRow = allScores.find((r) => r.user_id === user.id);
  const myAttempts = myRow ? Number(myRow.attempt_count) : 0;
  const myPct = myRow ? pctRounded(myRow) : 0;

  let rank: number | null = null;
  let percentile: number | null = null;
  if (myAttempts >= MIN_RANKED_ATTEMPTS && sortedEligible.length >= 2) {
    const idx = sortedEligible.findIndex((r) => r.user_id === user.id);
    rank = idx >= 0 ? idx + 1 : null;
    if (rank != null) {
      const below = sortedEligible.filter((r) => pctRounded(r) < myPct).length;
      percentile = sortedEligible.length > 1 ? Math.round((below / (sortedEligible.length - 1)) * 100) : 100;
    }
  }

  const leaderboardData = sortedEligible.slice(0, 10).map((r) => ({
    userId: r.user_id,
    username: r.username,
    correct: Number(r.marks_correct),
    total: Number(r.marks_attempted),
    attemptCount: Number(r.attempt_count),
    percent: pctRounded(r),
  }));

  const qRows = await db.execute(sql`
    SELECT question_key, MAX(topic) AS topic,
           SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END)::int AS fully_correct,
           COUNT(*)::int AS total_answered
    FROM question_attempts
    WHERE subject_id = ${subjectId} ${timeFilter}
    GROUP BY question_key
  `);
  const questionStats = (qRows.rows as any[]).map((r) => {
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

  const topicClassRows = await db.execute(sql`
    SELECT topic,
           SUM(CASE WHEN is_correct = 1 THEN marks ELSE 0 END) AS class_marks_correct,
           SUM(marks) AS class_marks_attempted
    FROM question_attempts
    WHERE subject_id = ${subjectId} ${timeFilter}
    GROUP BY topic
  `);

  const topicMyRows = await db.execute(sql`
    SELECT topic,
           SUM(CASE WHEN is_correct = 1 THEN marks ELSE 0 END) AS my_marks_correct,
           SUM(marks) AS my_marks_attempted
    FROM question_attempts
    WHERE subject_id = ${subjectId} AND user_id = ${user.id} ${timeFilter}
    GROUP BY topic
  `);

  const myTopicMap: Record<string, { myCorrect: number; myTotal: number }> = {};
  for (const r of topicMyRows.rows as any[]) {
    myTopicMap[r.topic] = { myCorrect: Number(r.my_marks_correct), myTotal: Number(r.my_marks_attempted) };
  }

  const topicUserRows = await db.execute(sql`
    SELECT user_id, topic,
           SUM(CASE WHEN is_correct = 1 THEN marks ELSE 0 END) AS marks_correct,
           SUM(marks) AS marks_attempted
    FROM question_attempts
    WHERE subject_id = ${subjectId} ${timeFilter}
    GROUP BY user_id, topic
  `);

  const byTopicUsers = new Map<string, { userId: number; pctRounded: number }[]>();
  for (const row of topicUserRows.rows as any[]) {
    const t = row.topic;
    if (!byTopicUsers.has(t)) byTopicUsers.set(t, []);
    const ma = Number(row.marks_attempted);
    const mc = Number(row.marks_correct);
    byTopicUsers.get(t)!.push({
      userId: row.user_id,
      pctRounded: ma > 0 ? Math.round((mc / ma) * 100) : 0,
    });
  }

  function topicPercentile(topic: string): number | null {
    const list = byTopicUsers.get(topic);
    if (!list || list.length < 2) return null;
    const mine = list.find((x) => x.userId === user.id);
    if (!mine) return null;
    const below = list.filter((x) => x.pctRounded < mine.pctRounded).length;
    return Math.round((below / (list.length - 1)) * 100);
  }

  const topicStats = (topicClassRows.rows as any[]).map((r) => ({
    topic: r.topic,
    correctCount: Number(r.class_marks_correct),
    totalAnswered: Number(r.class_marks_attempted),
    myCorrect: myTopicMap[r.topic]?.myCorrect ?? null,
    myTotal: myTopicMap[r.topic]?.myTotal ?? 0,
    topicPercentile: topicPercentile(r.topic),
  }));

  return c.json({
    totalStudents,
    percentile,
    rank,
    leaderboard: leaderboardData,
    questionStats,
    topicStats,
    minRankedAttempts: MIN_RANKED_ATTEMPTS,
  });
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
    const acc = parseFlexibleStringArray(
      (safeJsonParse(row.acceptedAnswers) as unknown) ?? row.acceptedAnswers,
    ) ?? undefined;
    const answerFallback = String(row.answer ?? "").trim();
    const normalizedAcc =
      acc?.length || row.type === "mcq" || !answerFallback ? acc : [answerFallback];
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
      acceptedAnswers: normalizedAcc,
      marks: typeof row.marks === "number" ? row.marks : 1,
      guidance: row.guidance || undefined,
      passage: row.passage || undefined,
    };
  });
  return c.json(list);
});

app.get("/api/admin/english/prompts", adminAccessMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    const rows = await db.execute(sql`
      SELECT p.id, p.section, p.prompt_text, b.title AS book_title
      FROM english_prompts p
      JOIN english_books b ON b.id = p.book_id
      ORDER BY p.section ASC, b.title ASC, p.id ASC
    `);
    return c.json({
      prompts: (rows.rows as any[]).map((r) => ({
        id: Number(r.id),
        section: normalizeEnglishSection(r.section),
        book: String(r.book_title || ""),
        prompt: String(r.prompt_text || ""),
      })),
    });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

app.get("/api/english/books", async (c: any) => {
  try {
    const db = c.get("db");
    const section = normalizeEnglishSection(c.req.query("section"));
    const rows = await db.execute(sql`
      SELECT
        b.id,
        b.title,
        SUM(
          CASE
            WHEN LEFT(UPPER(TRIM(REGEXP_REPLACE(COALESCE(p.section, ''), '^SECTION\\s*', '', 'i'))), 1) = 'A' THEN 1
            ELSE 0
          END
        ) AS prompt_count_a,
        SUM(
          CASE
            WHEN LEFT(UPPER(TRIM(REGEXP_REPLACE(COALESCE(p.section, ''), '^SECTION\\s*', '', 'i'))), 1) = 'B' THEN 1
            ELSE 0
          END
        ) AS prompt_count_b,
        SUM(
          CASE
            WHEN LEFT(UPPER(TRIM(REGEXP_REPLACE(COALESCE(p.section, ''), '^SECTION\\s*', '', 'i'))), 1) = 'C' THEN 1
            ELSE 0
          END
        ) AS prompt_count_c
      FROM english_books b
      LEFT JOIN english_prompts p ON p.book_id = b.id
      GROUP BY b.id, b.title
      ORDER BY b.title ASC
    `);
    const mapped = (rows.rows as any[]).map((r) => {
      const countA = Number(r.prompt_count_a || 0);
      const countB = Number(r.prompt_count_b || 0);
      const countC = Number(r.prompt_count_c || 0);
      const totalCount = countA + countB + countC;
      return {
        id: Number(r.id),
        title: String(r.title || ""),
        promptCount:
          section === "A" ? countA : section === "B" ? countB : countC,
        totalPromptCount: totalCount,
      };
    });
    const sectionScoped = mapped.filter((x) => x.promptCount > 0);
    if (sectionScoped.length > 0) {
      return c.json({ books: sectionScoped.map(({ totalPromptCount: _, ...rest }) => rest) });
    }
    // Fallback: if a section has no prompts at all, still return books with prompts from any section.
    return c.json({
      books: mapped
        .filter((x) => x.totalPromptCount > 0)
        .map(({ totalPromptCount, ...rest }) => ({ ...rest, promptCount: totalPromptCount })),
    });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

app.get("/api/english/prompts", async (c: any) => {
  try {
    const db = c.get("db");
    const section = normalizeEnglishSection(c.req.query("section"));
    const bookId = Number(c.req.query("bookId"));
    const rows =
      section === "A"
        ? Number.isFinite(bookId) && bookId > 0
          ? await db.execute(sql`
              SELECT p.id, p.prompt_text, p.section, b.id AS book_id, b.title AS book_title
              FROM english_prompts p
              JOIN english_books b ON b.id = p.book_id
              WHERE p.book_id = ${bookId} AND LEFT(UPPER(TRIM(REGEXP_REPLACE(COALESCE(p.section, ''), '^SECTION\\s*', '', 'i'))), 1) = 'A'
              ORDER BY p.id ASC
            `)
          : await db.execute(sql`
              SELECT p.id, p.prompt_text, p.section, b.id AS book_id, b.title AS book_title
              FROM english_prompts p
              JOIN english_books b ON b.id = p.book_id
              WHERE LEFT(UPPER(TRIM(REGEXP_REPLACE(COALESCE(p.section, ''), '^SECTION\\s*', '', 'i'))), 1) = 'A'
              ORDER BY p.id ASC
            `)
        : await db.execute(sql`
            SELECT p.id, p.prompt_text, p.section, b.id AS book_id, b.title AS book_title
            FROM english_prompts p
            JOIN english_books b ON b.id = p.book_id
            WHERE LEFT(UPPER(TRIM(REGEXP_REPLACE(COALESCE(p.section, ''), '^SECTION\\s*', '', 'i'))), 1) = UPPER(${section})
            ORDER BY p.id ASC
          `);
    const effectiveRows =
      section === "A" && ((rows.rows as any[])?.length ?? 0) === 0
        ? await db.execute(sql`
            SELECT p.id, p.prompt_text, p.section, b.id AS book_id, b.title AS book_title
            FROM english_prompts p
            JOIN english_books b ON b.id = p.book_id
            WHERE p.book_id = ${bookId}
            ORDER BY p.id ASC
          `)
        : rows;

    return c.json({
      prompts: (effectiveRows.rows as any[]).map((r) => ({
        id: Number(r.id),
        bookId: Number(r.book_id),
        bookTitle: String(r.book_title || ""),
        prompt: String(r.prompt_text || ""),
        section: normalizeEnglishSection(r.section),
      })),
    });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

app.post("/api/english/responses", authMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    const user = c.get("user");
    const body = await c.req.json();
    const promptId = Number(body?.promptId);
    const responseTypeRaw = cleanText(body?.responseType, 40).toLowerCase();
    const responseType = responseTypeRaw === "paragraph" ? "paragraph" : "essay";
    const responseText = cleanText(body?.responseText, 20000);
    const imageUrls = Array.isArray(body?.imageUrls)
      ? body.imageUrls.map((u: unknown) => String(u ?? "").trim()).filter(Boolean).slice(0, 8)
      : [];

    if (!Number.isFinite(promptId) || promptId <= 0) return c.json({ error: "promptId is required." }, 400);
    if (!responseText && imageUrls.length === 0) {
      return c.json({ error: "Provide response text or at least one image." }, 400);
    }

    const exists = await db
      .select({ id: englishPrompts.id })
      .from(englishPrompts)
      .where(eq(englishPrompts.id, promptId))
      .limit(1);
    if (!exists.length) return c.json({ error: "Prompt not found." }, 404);

    const imageUrlsJson = imageUrls.length ? JSON.stringify(imageUrls) : null;
    const now = nowIso();
    await db.execute(sql`
      INSERT INTO english_responses (prompt_id, user_id, response_type, response_text, image_urls, created_at, updated_at)
      VALUES (${promptId}, ${user.id}, ${responseType}, ${responseText || ""}, ${imageUrlsJson}, ${now}, ${now})
    `);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

app.get("/api/english/responses", authMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    const user = c.get("user");
    const section = normalizeEnglishSection(c.req.query("section"));
    const bookId = Number(c.req.query("bookId"));
    const rows =
      section === "A"
        ? Number.isFinite(bookId) && bookId > 0
          ? await db.execute(sql`
              SELECT r.id, r.prompt_id, r.user_id, r.response_type, r.response_text, r.image_urls, r.updated_at,
                     p.prompt_text, p.section, u.username, AVG(rr.score) AS avg_score, COUNT(rr.id) AS rating_count
              FROM english_responses r
              JOIN english_prompts p ON p.id = r.prompt_id
              JOIN english_books b ON b.id = p.book_id
              JOIN users u ON u.id = r.user_id
              LEFT JOIN english_response_ratings rr ON rr.response_id = r.id
              WHERE b.id = ${bookId} AND LEFT(UPPER(TRIM(REGEXP_REPLACE(COALESCE(p.section, ''), '^SECTION\\s*', '', 'i'))), 1) = 'A'
              GROUP BY r.id, p.prompt_text, p.section, u.username
              ORDER BY r.updated_at DESC
            `)
          : await db.execute(sql`
              SELECT r.id, r.prompt_id, r.user_id, r.response_type, r.response_text, r.image_urls, r.updated_at,
                     p.prompt_text, p.section, u.username, AVG(rr.score) AS avg_score, COUNT(rr.id) AS rating_count
              FROM english_responses r
              JOIN english_prompts p ON p.id = r.prompt_id
              JOIN users u ON u.id = r.user_id
              LEFT JOIN english_response_ratings rr ON rr.response_id = r.id
              WHERE LEFT(UPPER(TRIM(REGEXP_REPLACE(COALESCE(p.section, ''), '^SECTION\\s*', '', 'i'))), 1) = 'A'
              GROUP BY r.id, p.prompt_text, p.section, u.username
              ORDER BY r.updated_at DESC
            `)
        : await db.execute(sql`
            SELECT r.id, r.prompt_id, r.user_id, r.response_type, r.response_text, r.image_urls, r.updated_at,
                   p.prompt_text, p.section, u.username, AVG(rr.score) AS avg_score, COUNT(rr.id) AS rating_count
            FROM english_responses r
            JOIN english_prompts p ON p.id = r.prompt_id
            JOIN users u ON u.id = r.user_id
            LEFT JOIN english_response_ratings rr ON rr.response_id = r.id
            WHERE LEFT(UPPER(TRIM(REGEXP_REPLACE(COALESCE(p.section, ''), '^SECTION\\s*', '', 'i'))), 1) = UPPER(${section})
            GROUP BY r.id, p.prompt_text, p.section, u.username
            ORDER BY r.updated_at DESC
          `);

    const myRatings = await db.execute(sql`
      SELECT response_id, score FROM english_response_ratings WHERE rater_user_id = ${user.id}
    `);
    const myMap = new Map((myRatings.rows as any[]).map((r) => [Number(r.response_id), Number(r.score)]));

    return c.json({
      responses: (rows.rows as any[]).map((r) => ({
        id: Number(r.id),
        promptId: Number(r.prompt_id),
        prompt: String(r.prompt_text || ""),
        section: normalizeEnglishSection(r.section),
        userId: Number(r.user_id),
        username: String(r.username || ""),
        responseType: String(r.response_type || "essay"),
        responseText: String(r.response_text || ""),
        imageUrls: safeJsonColumn(r.image_urls) || [],
        updatedAt: String(r.updated_at || ""),
        averageScore:
          Number(r.rating_count || 0) > 0 && r.avg_score != null
            ? Math.round(Number(r.avg_score) * 10) / 10
            : null,
        ratingCount: Number(r.rating_count || 0),
        myScore: myMap.get(Number(r.id)) ?? null,
      })),
    });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

app.post("/api/english/responses/:id/rate", authMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    const user = c.get("user");
    const responseId = Number(c.req.param("id"));
    const body = await c.req.json();
    const score = Number(body?.score);
    if (!Number.isFinite(responseId) || responseId <= 0) {
      return c.json({ error: "response id is required." }, 400);
    }
    if (!Number.isFinite(score) || score < 1 || score > 10 || score !== Math.floor(score)) {
      return c.json({ error: "score must be an integer from 1 to 10." }, 400);
    }

    const target = await db
      .select({ userId: englishResponses.userId })
      .from(englishResponses)
      .where(eq(englishResponses.id, responseId))
      .limit(1);
    if (!target.length) return c.json({ error: "Response not found." }, 404);
    if (Number(target[0].userId) === Number(user.id)) {
      return c.json({ error: "You cannot rate your own response." }, 400);
    }

    await db.execute(sql`
      INSERT INTO english_response_ratings (response_id, rater_user_id, score, created_at)
      VALUES (${responseId}, ${user.id}, ${score}, ${nowIso()})
      ON CONFLICT(response_id, rater_user_id) DO UPDATE SET score = excluded.score
    `);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
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
  const updates: Record<string, unknown> = {};
  if (body.marks != null) {
    updates.marks = Math.max(1, Math.round(Number(body.marks ?? 1)));
  }
  if (Array.isArray(body.acceptedAnswers)) {
    const accepted = body.acceptedAnswers
      .map((x: unknown) => String(x ?? "").trim())
      .filter(Boolean);
    updates.acceptedAnswers = JSON.stringify(accepted);
  }
  if (!Object.keys(updates).length) {
    return c.json({ error: "No updatable fields provided." }, 400);
  }
  await c
    .get("db")
    .update(customQuestions)
    .set(updates)
    .where(eq(customQuestions.id, Number(c.req.param("id"))));
  return c.json({ ok: true });
});

app.post("/api/admin/questions/autofill-answers", adminAccessMiddleware, async (c: any) => {
  const db = c.get("db");
  const rows = await db.select().from(customQuestions).orderBy(asc(customQuestions.id));
  let updated = 0;
  let unresolved = 0;
  for (const row of rows as any[]) {
    const t = String(row.type ?? "").toLowerCase();
    if (t === "mcq") continue;
    const current = parseFlexibleStringArray(
      (safeJsonParse(row.acceptedAnswers) as unknown) ?? row.acceptedAnswers,
    ) ?? [];
    const fallback = String(row.answer ?? "").trim();
    const computed = computeExpectedAnswersFromQuestionText(row.question);
    const next = computed.length ? computed : fallback ? [fallback] : current.length ? current : [];
    if (!next.length) {
      unresolved++;
      continue;
    }
    if (JSON.stringify(current) === JSON.stringify(next)) continue;
    await db
      .update(customQuestions)
      .set({ acceptedAnswers: JSON.stringify(next) })
      .where(eq(customQuestions.id, Number(row.id)));
    updated++;
  }
  return c.json({ ok: true, updated, unresolved });
});

app.delete("/api/admin/questions/:id", adminAccessMiddleware, async (c: any) => {
  await c
    .get("db")
    .delete(customQuestions)
    .where(eq(customQuestions.id, Number(c.req.param("id"))));
  return c.json({ ok: true });
});

app.get("/api/admin/google-sheet/status", adminAccessMiddleware, async (c: any) => {
  const env = c.env as Env;
  const enabled = isSheetsConfigured(env);
  return c.json({
    enabled,
    tabs: enabled ? sheetsGetTabNames(env) : [],
    subjectFromTab: enabled ? sheetsSubjectIdFromTabMode(env) : false,
  });
});

app.get("/api/admin/google-sheet/diagnose", adminAccessMiddleware, async (c: any) => {
  const env = c.env as Env;
  if (!isSheetsConfigured(env)) {
    return c.json(
      { error: "Google Sheets is not configured. Add GOOGLE_SHEETS_SPREADSHEET_ID and GOOGLE_SERVICE_ACCOUNT_JSON on Pages." },
      503,
    );
  }
  try {
    const configuredTabs = sheetsGetTabNames(env);
    const spreadsheetTabTitles = await sheetsListSpreadsheetTabTitles(env);
    const missingFromSpreadsheet = configuredTabs.filter(
      (t) => !spreadsheetTabTitles.includes(t),
    );
    return c.json({
      spreadsheetTabTitles,
      missingFromSpreadsheet,
      hint:
        missingFromSpreadsheet.length > 0
          ? "Create a tab for each missing name exactly as listed (same spelling/case), or change GOOGLE_SHEETS_TAB_NAME to match existing tab names."
          : null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[google-sheet/diagnose]", msg);
    return c.json({ error: msg }, 500);
  }
});

app.post("/api/admin/questions/sync-from-sheet", adminAccessMiddleware, async (c: any) => {
  const env = c.env as Env;
  const db = c.get("db");
  if (!isSheetsConfigured(env)) {
    return c.json(
      {
        error:
          "Google Sheets is not configured. In Cloudflare Pages → Settings → Variables and secrets add GOOGLE_SHEETS_SPREADSHEET_ID, GOOGLE_SHEETS_TAB_NAME (e.g. english,methods), and GOOGLE_SERVICE_ACCOUNT_JSON (Secret, full service account JSON). Share the sheet with the service account email.",
      },
      503,
    );
  }

  try {
    const { rows: rawRows, tabErrors } = await sheetsReadDataRows(env);
    let imported = 0;
    let updated = 0;
    let deleted = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const item = rawRows[i]!;
      const row = item.row;
      const tabName = item.tabName;
      const p = sheetsParseRow(Array.isArray(row) ? row : []);
      if (sheetsSubjectIdFromTabMode(env) && tabName) {
        p.subject_id = tabName;
      }
      const action = (p.action || "").toUpperCase();
      const databaseId = p.database_id ? parseInt(p.database_id, 10) : NaN;

      try {
        if (action === "DELETE" && Number.isFinite(databaseId)) {
          await db
            .delete(customQuestions)
            .where(eq(customQuestions.id, databaseId));
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
        const createdAt = nowIso();

        if (Number.isFinite(databaseId)) {
          const exists = await db
            .select({ id: customQuestions.id })
            .from(customQuestions)
            .where(eq(customQuestions.id, databaseId))
            .limit(1);
          if (exists.length > 0) {
            await db
              .update(customQuestions)
              .set({
                subjectId: subjectIdSheet,
                type: p.type,
                topic,
                question: p.question,
                imageUrls: imageUrlsJson,
                options: optionsJson,
                answer,
                acceptedAnswers: acceptedRaw,
                guidance,
                passage,
                marks,
              })
              .where(eq(customQuestions.id, databaseId));
            updated++;
          } else {
            await db.insert(customQuestions).values({
              subjectId: subjectIdSheet,
              type: p.type,
              topic,
              question: p.question,
              imageUrls: imageUrlsJson,
              options: optionsJson,
              answer,
              acceptedAnswers: acceptedRaw,
              guidance,
              passage,
              marks,
              createdAt,
            });
            imported++;
          }
        } else {
          await db.insert(customQuestions).values({
            subjectId: subjectIdSheet,
            type: p.type,
            topic,
            question: p.question,
            imageUrls: imageUrlsJson,
            options: optionsJson,
            answer,
            acceptedAnswers: acceptedRaw,
            guidance,
            passage,
            marks,
            createdAt,
          });
          imported++;
        }
      } catch (e: unknown) {
        errors.push({
          row: i + 2,
          message: String(e instanceof Error ? e.message : e),
        });
      }
    }

    return c.json({
      ok: true,
      imported,
      updated,
      deleted,
      errors,
      tabErrors,
      rowsRead: rawRows.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[admin/questions/sync-from-sheet]", msg);
    return c.json({ error: `Could not sync from Google Sheet: ${msg}` }, 500);
  }
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
