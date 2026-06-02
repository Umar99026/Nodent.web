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
  const s0 = String(raw ?? "").trim().toUpperCase();
  const s = s0.replace(/^SECTION\s*/i, "").trim();
  const first = s.slice(0, 1);
  return first === "B" ? "B" : first === "C" ? "C" : "A";
}

/** Keep in sync with `frontend/src/lib/sectionBPrompts.ts` — one DB row per title + stimulus. */
const SECTION_B_CURATED_BOOK = "Section B Curated Prompts";
const SECTION_B_CURATED_PROMPT_TEXTS = [
  `Title: Origins.
Using at least one stimulus, write a crafted text exploring ideas about country and belonging.

Write a text that explores ideas about country.
Use the provided title.
Use at least one stimulus.

Stimulus
My body might go, but my heart can never leave.`,
  `Title: Origins.
Using at least one stimulus, write a crafted text exploring ideas about country and belonging.

Write a text that explores ideas about country.
Use the provided title.
Use at least one stimulus.

Stimulus
... there is no separation between people, animals, plants, land, sea and sky. It is all Country. It is all family. And everyone is part of the story.`,
  `Title: Small Acts, Big Wins.
Using at least one stimulus, write a crafted text exploring ideas about protest and collective action.

Write a text that explores ideas about protest.
Use the provided title.
Use at least one stimulus.

Stimulus
"I want to change the world," said Tiny Dragon. "Start with the next person who needs your help," replied Big Panda.`,
  `Title: Small Acts, Big Wins.
Using at least one stimulus, write a crafted text exploring ideas about protest and collective action.

Write a text that explores ideas about protest.
Use the provided title.
Use at least one stimulus.

Stimulus
And now my voice is louder than ever. Louder because people have joined me and together we make a chorus, standing up for what we believe.`,
  `Title: Changing Direction.
Using at least one stimulus, write a crafted text exploring ideas about personal journeys and transformation.

Write a text that explores ideas about personal journeys.
Use the provided title.
Use at least one stimulus.

Stimulus
You were looking for the key for years, but the door was always open!`,
  `Title: Changing Direction.
Using at least one stimulus, write a crafted text exploring ideas about personal journeys and transformation.

Write a text that explores ideas about personal journeys.
Use the provided title.
Use at least one stimulus.

Stimulus
In the midst of my journey through life I found myself in a dark forest, where the clear way forward was lost.`,
];

async function ensureSectionBCuratedPrompts(db: ReturnType<typeof drizzle>) {
  const now = nowIso();
  let bookId = Number(
    (
      await db.execute(sql`
        SELECT id FROM english_books WHERE title = ${SECTION_B_CURATED_BOOK} LIMIT 1
      `)
    ).rows?.[0]?.id ?? 0,
  );
  if (!bookId) {
    const created = await db.execute(sql`
      INSERT INTO english_books (title, created_at)
      VALUES (${SECTION_B_CURATED_BOOK}, ${now})
      RETURNING id
    `);
    bookId = Number((created.rows as any[])?.[0]?.id ?? 0);
  }
  if (!bookId) return;

  await db.execute(sql`
    DELETE FROM english_prompts
    WHERE
      LEFT(UPPER(TRIM(REGEXP_REPLACE(COALESCE(section, ''), '^SECTION\\s*', '', 'i'))), 1) = 'B'
      AND prompt_text ~* '^\\s*title\\s*:\\s*(origins|small\\s+acts|changing\\s+direction)'
  `);

  for (const promptText of SECTION_B_CURATED_PROMPT_TEXTS) {
    const existing = await db.execute(sql`
      SELECT id FROM english_prompts
      WHERE
        book_id = ${bookId}
        AND section = 'B'
        AND prompt_text = ${promptText}
      LIMIT 1
    `);
    if (Number((existing.rows as any[])?.[0]?.id ?? 0) > 0) continue;
    await db.execute(sql`
      INSERT INTO english_prompts (book_id, prompt_text, section, created_at)
      VALUES (${bookId}, ${promptText}, 'B', ${now})
    `);
  }
}

/** Matches `frontend/src/lib/methodsAreaTopic.ts` (keep in sync when editing). */
const METHODS_AREA_TITLES = [
  "Functions, relations and graphs",
  "Algebra, number and structure",
  "Calculus",
  "Data analysis, probability and statistics",
] as const;

function methodsRetagInfer(rawTopic: string, question: string, passage: string): string {
  const set = new Set(METHODS_AREA_TITLES);
  const stripUnit = (t: string) =>
    t.replace(/^unit\s*[12]\s*[—–-]\s*/i, "").trim();
  const t0 = String(rawTopic ?? "").trim();
  const stripped = stripUnit(t0);
  if (set.has(stripped)) return stripped;
  if (set.has(t0)) return t0;
  const norm = (x: string) => x.trim().toLowerCase().replace(/\s+/g, " ");
  const aliases: Record<string, (typeof METHODS_AREA_TITLES)[number]> = {
    calculus: "Calculus",
    "functions & graphs": "Functions, relations and graphs",
    trigonometry: "Functions, relations and graphs",
    trigonometric: "Functions, relations and graphs",
    algebra: "Algebra, number and structure",
    probability: "Data analysis, probability and statistics",
    statistics: "Data analysis, probability and statistics",
    "data analysis": "Data analysis, probability and statistics",
    functions: "Functions, relations and graphs",
    graphs: "Functions, relations and graphs",
    "section a": "Functions, relations and graphs",
    "section b": "Algebra, number and structure",
    "section c": "Calculus",
    "section d": "Data analysis, probability and statistics",
    general: "Algebra, number and structure",
  };
  const alias = aliases[norm(t0)];
  if (alias) return alias;

  const s = `${t0}\n${question}\n${passage}`.toLowerCase();
  const w = (re: RegExp, n = 2) => (re.test(s) ? n : 0);
  const fun =
    w(/\basymptote\b/i) +
    w(/\bperiodicity\b|\bperiod\b|\bamplitude\b/i) +
    w(/\bsin\s*\(|\bcos\s*\(|\btan\s*\(/i, 3) +
    w(/\bcomposite\b|\bf\s*∘\s*g/i) +
    w(/\binverse function\b/i) +
    w(/\blog_(?:e|a)?\s*\(|\bln\s*\(/i, 2) +
    w(/\be\^|\bexp\b/i, 2) +
    w(/\bunit circle\b|\bradian\b/i) +
    w(/\bdomain\b|\brange\b|\bco-?domain\b/i) +
    w(/\bgraph of\b|\btransform\b|\bdilation\b/i) +
    w(/\bf\s*:\s*r\s*→\s*r\b/) +
    w(/\bwhich.*graph\b/i, 2);
  const alg =
    w(/\bsimultaneous\b|\bsystem of equations\b/i, 3) +
    w(/\bnewton'?s method\b|\bbisection\b/i, 3) +
    w(/\bfactor theorem\b|\bremainder theorem\b/i, 2) +
    w(/\bparameter\s+k\b|\bcontaining the parameter\b/i, 2) +
    w(/\balgorithm\b|\bwhile\b.*\bprint\b/i, 2) +
    w(/\bax\s*\+\s*by\b/i, 2);
  const cal =
    w(/\bderivative\b|\bdifferentiat\b/i, 3) +
    w(/\btrapezium rule\b/i, 4) +
    w(/\bintegral\b|\banti-?differentiat\b/i, 3) +
    w(/\bgradient\b|\btangent\b/i, 2) +
    w(/\brate of change\b|\binstantaneous\b/i, 2) +
    w(/\bstationary\b|\binflection\b/i, 2) +
    w(/\bcentral difference\b/i, 3);
  const data =
    w(/\bconfidence interval\b/i, 3) +
    w(/\bPr\s*\(/i, 3) +
    w(/\bprobability\b/i, 2) +
    w(/\bvenn\b|\btree diagram\b/i, 2) +
    w(/\bindependent event\b|\bmutually exclusive\b/i, 2) +
    w(/\bwith(?:out)? replacement\b/i, 2);

  const scores: Record<string, number> = {
    "Functions, relations and graphs": fun,
    "Algebra, number and structure": alg,
    Calculus: cal,
    "Data analysis, probability and statistics": data,
  };
  let best = "Functions, relations and graphs";
  let v = -1;
  for (const k of METHODS_AREA_TITLES) {
    if (scores[k] > v) {
      v = scores[k];
      best = k;
    }
  }
  return best;
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

/** Round to the nearest 2 (e.g. 66.7 → 66). */
function roundPercentileToNearest2(value: number): number {
  return Math.round(value / 2) * 2;
}

/** “Top X%” band from rank (1 = best). Rank 2 of 10 → 20. Nearest 2%. */
function cohortPercentileFromRank(rank: number, total: number): number {
  if (total < 1 || rank < 1 || rank > total) return 0;
  const raw = (rank / total) * 100;
  return Math.max(2, Math.min(100, roundPercentileToNearest2(raw)));
}

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
// Session duration: 30 days when "remember me" is checked, otherwise 1 day.
function sessionExpiry(rememberMe = true): string {
  const d = new Date();
  d.setDate(d.getDate() + (rememberMe ? 30 : 1));
  return d.toISOString();
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

const MIN_PASSWORD_LENGTH = 8;
const AUTH_RATE_MAX = 25;
const AUTH_RATE_WINDOW_MS = 15 * 60 * 1000;
const rateBuckets = new Map<string, { n: number; reset: number }>();

function passwordPolicyError(password: string): string | null {
  const p = String(password ?? "").trim();
  if (!p) return "Password is required.";
  if (p.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}

function clientIp(c: any): string {
  const cf = c.req.header("CF-Connecting-IP");
  if (cf) return String(cf).trim();
  const fwd = c.req.header("X-Forwarded-For");
  if (fwd) return String(fwd).split(",")[0]?.trim() || "unknown";
  return "unknown";
}

/** Best-effort per-edge rate limit; pair with Cloudflare WAF for production. */
function rateLimitResponse(c: any, bucket: string, max = AUTH_RATE_MAX): Response | null {
  const key = `${clientIp(c)}:${bucket}`;
  const now = Date.now();
  let entry = rateBuckets.get(key);
  if (!entry || now > entry.reset) {
    entry = { n: 1, reset: now + AUTH_RATE_WINDOW_MS };
    rateBuckets.set(key, entry);
    return null;
  }
  entry.n += 1;
  if (entry.n > max) {
    return c.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      429,
    ) as Response;
  }
  return null;
}

async function hashResetToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return bytesToHex(new Uint8Array(digest));
}

function passwordResetExpiry(): string {
  const d = new Date();
  d.setHours(d.getHours() + 1);
  return d.toISOString();
}

function appOrigin(env: Env, requestUrl: string): string {
  const configured = String(env.FRONTEND_URL || "").trim().replace(/\/$/, "");
  if (configured) return configured;
  try {
    const u = new URL(requestUrl);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") {
      return "http://localhost:5173";
    }
    return u.origin;
  } catch {
    return "http://localhost:5173";
  }
}

async function sendPasswordResetEmail(env: Env, to: string, resetUrl: string): Promise<boolean> {
  const apiKey = String(env.RESEND_API_KEY || "").trim();
  const from = String(env.EMAIL_FROM || "Nodent <onboarding@resend.dev>").trim();
  const subject = "Reset your Nodent password";
  const html = `<p>Hi,</p><p>We received a request to reset your Nodent password. Click the link below — it expires in 1 hour.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`;

  // Preferred: Resend (requires API key)
  if (apiKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
      }),
    });
    if (res.ok) return true;
    console.error("[password-reset] Resend error:", await res.text());
  }

  // Fallback: MailChannels (works on Cloudflare Workers without an API key).
  // You should set EMAIL_FROM to a domain you control for best deliverability.
  try {
    const parsedFrom = (() => {
      const m = from.match(/^(.*?)<([^>]+)>$/);
      if (m) return { name: m[1].trim() || "Nodent", email: m[2].trim() };
      return { name: "Nodent", email: from };
    })();

    const res2 = await fetch("https://api.mailchannels.net/tx/v1/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: parsedFrom.email, name: parsedFrom.name },
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    });
    if (!res2.ok) {
      console.error("[password-reset] MailChannels error:", await res2.text());
      console.info("[password-reset] Reset link (email failed):", resetUrl);
      return false;
    }
    return true;
  } catch (e) {
    console.error("[password-reset] MailChannels exception:", errorChain(e));
    console.info("[password-reset] Reset link (email failed):", resetUrl);
    return false;
  }
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
  /** Resend (optional) — password reset emails */
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  /** Google Sheets (optional) — use plain text var + encrypted secret for JSON */
  GOOGLE_SHEETS_SPREADSHEET_ID?: string;
  GOOGLE_SHEETS_TAB_NAME?: string;
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;
  GOOGLE_SHEETS_SUBJECT_FROM_TAB?: string;
};
type Vars = { user: { id: number; email: string; username: string; token: string; profilePhoto?: string | null }; db: ReturnType<typeof createDb> };

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.onError((err: unknown, c) => {
  const msg = err instanceof Error ? err.stack || err.message : String(err);
  console.error("[onError]", msg);
  // Ensure we always return a response in local dev (Wrangler otherwise shows “No response!”)
  return c.json({ ok: false, error: msg }, 500);
});

// Minimal endpoint for debugging local dev runtime (no DB required).
app.get("/api/ping", (c) => c.json({ ok: true }));
let englishResponsesConstraintDropped = false;
let usersTablePatched = false;
let performanceIndexesPatched = false;
let studyTablesPatched = false;
let coreTablesPatched = false;
let lastSessionCleanupAt = 0;

async function ensureCoreTables(db: any) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS users (
      id serial PRIMARY KEY,
      username text NOT NULL DEFAULT '',
      email text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      password_salt text NOT NULL,
      hash_algorithm text NOT NULL DEFAULT 'pbkdf2',
      profile_photo text,
      study_goal_minutes integer NOT NULL DEFAULT 120,
      created_at text NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sessions (
      token text PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      created_at text NOT NULL,
      expires_at text NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash text PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      expires_at text NOT NULL,
      created_at text NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx
    ON password_reset_tokens (user_id)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_idx
    ON password_reset_tokens (expires_at)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS quiz_attempts (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      subject_id text NOT NULL,
      score integer NOT NULL,
      total_questions integer NOT NULL,
      percent integer NOT NULL,
      created_at text NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS written_responses (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      subject_id text NOT NULL,
      question_key text NOT NULL,
      response_text text NOT NULL,
      updated_at text NOT NULL,
      UNIQUE(user_id, subject_id, question_key)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS quiz_comments (
      id serial PRIMARY KEY,
      subject_id text NOT NULL,
      question_key text NOT NULL,
      user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      parent_comment_id integer REFERENCES quiz_comments (id) ON DELETE CASCADE,
      text text NOT NULL,
      image_urls text,
      created_at text NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS custom_questions (
      id serial PRIMARY KEY,
      subject_id text NOT NULL,
      type text NOT NULL,
      topic text NOT NULL DEFAULT 'General',
      question text NOT NULL,
      image_urls text,
      options text,
      answer text,
      accepted_answers text,
      marks integer NOT NULL DEFAULT 1,
      guidance text,
      passage text,
      created_at text NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS english_books (
      id serial PRIMARY KEY,
      title text NOT NULL UNIQUE,
      created_at text NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS english_prompts (
      id serial PRIMARY KEY,
      book_id integer NOT NULL REFERENCES english_books (id) ON DELETE CASCADE,
      prompt_text text NOT NULL,
      section text NOT NULL DEFAULT 'A',
      created_at text NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS english_responses (
      id serial PRIMARY KEY,
      prompt_id integer NOT NULL REFERENCES english_prompts (id) ON DELETE CASCADE,
      user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      response_type text NOT NULL DEFAULT 'essay',
      response_text text NOT NULL DEFAULT '',
      image_urls text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS english_response_ratings (
      id serial PRIMARY KEY,
      response_id integer NOT NULL REFERENCES english_responses (id) ON DELETE CASCADE,
      rater_user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      score integer NOT NULL,
      created_at text NOT NULL,
      UNIQUE(response_id, rater_user_id)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id serial PRIMARY KEY,
      subject_id text NOT NULL,
      user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      username text NOT NULL,
      text text NOT NULL,
      created_at text NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS question_attempts (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      subject_id text NOT NULL,
      question_key text NOT NULL,
      topic text NOT NULL DEFAULT 'General',
      marks integer NOT NULL DEFAULT 1,
      is_correct integer NOT NULL,
      answered_at text NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS forum_posts (
      id serial PRIMARY KEY,
      subject_id text NOT NULL,
      user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      username text NOT NULL,
      title text NOT NULL,
      body text NOT NULL,
      image_urls text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS forum_replies (
      id serial PRIMARY KEY,
      post_id integer NOT NULL REFERENCES forum_posts (id) ON DELETE CASCADE,
      subject_id text NOT NULL,
      user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      username text NOT NULL,
      body text NOT NULL,
      created_at text NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS dojo_challenges (
      id serial PRIMARY KEY,
      challenger_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      opponent_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      subject_id text NOT NULL,
      topic text NOT NULL DEFAULT 'General',
      question_set text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      opponent_read integer NOT NULL DEFAULT 0,
      created_at text NOT NULL,
      accepted_at text
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS dojo_battles (
      id serial PRIMARY KEY,
      challenge_id integer NOT NULL REFERENCES dojo_challenges (id) ON DELETE CASCADE,
      subject_id text NOT NULL,
      topic text NOT NULL DEFAULT 'General',
      player1_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      player2_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      player1_score integer NOT NULL DEFAULT 0,
      player2_score integer NOT NULL DEFAULT 0,
      current_index integer NOT NULL DEFAULT 0,
      question_started_at text NOT NULL,
      status text NOT NULL DEFAULT 'active',
      winner_id integer,
      question_set text NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS friend_requests (
      id serial PRIMARY KEY,
      from_user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      to_user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      status text NOT NULL DEFAULT 'pending',
      created_at text NOT NULL,
      responded_at text,
      UNIQUE(from_user_id, to_user_id)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS friendships (
      id serial PRIMARY KEY,
      user1_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      user2_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      created_at text NOT NULL,
      UNIQUE(user1_id, user2_id)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS friend_assignments (
      id serial PRIMARY KEY,
      from_user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      to_user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      subject_id text NOT NULL,
      question_key text NOT NULL,
      question_json text NOT NULL,
      marks integer NOT NULL DEFAULT 1,
      answer_json text,
      is_correct integer,
      created_at text NOT NULL,
      answered_at text
    )
  `);
}

// CORS
app.use("/api/*", cors({
  origin: (origin, c) => {
    if (!origin) {
      const fe = String(c.env.FRONTEND_URL || "").trim().replace(/\/$/, "");
      return fe || undefined;
    }
    if (origin.startsWith("http://localhost:") || origin.startsWith("http://127.0.0.1:")) {
      return origin;
    }
    if (origin.includes(".pages.dev")) return origin;
    const fe = String(c.env.FRONTEND_URL || "").trim().replace(/\/$/, "");
    if (fe && origin === fe) return origin;
    return undefined;
  },
  allowHeaders: ["Content-Type", "Authorization", "X-Admin-Key"],
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  credentials: true, maxAge: 86400,
}));

// DB middleware
app.use("/api/*", async (c, next) => {
  const db = createDb(c.env.DATABASE_URL);
  if (!coreTablesPatched) {
    try {
      await ensureCoreTables(db);
    } catch { /* ignore */ }
    finally { coreTablesPatched = true; }
  }
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
  if (!studyTablesPatched) {
    try {
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS study_days (
          id serial PRIMARY KEY,
          user_id integer NOT NULL,
          date text NOT NULL,
          daily_seconds integer NOT NULL DEFAULT 0,
          daily_seconds_by_subject text,
          goal_minutes integer,
          updated_at text NOT NULL,
          UNIQUE(user_id, date)
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS study_days_user_date_idx
        ON study_days (user_id, date)
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS user_subjects (
          id serial PRIMARY KEY,
          user_id integer NOT NULL,
          subject_id text NOT NULL,
          created_at text NOT NULL,
          UNIQUE(user_id, subject_id)
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS user_subjects_user_idx
        ON user_subjects (user_id)
      `);
    } catch {
      // ignore
    } finally {
      studyTablesPatched = true;
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
  const envKey = String((c.env as any)?.ADMIN_KEY ?? "").trim();
  if (headerKey && envKey && headerKey === envKey) {
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

// ---- Health ----
app.get("/api/health", async (c) => {
  try {
    const db = c.get("db");
    const result = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
    const userCount = (result.rows?.[0] as any)?.count ?? 0;
    return c.json({ ok: true, users: userCount });
  } catch (err: any) {
    return c.json({ ok: false, error: err?.message || "unknown" }, 500);
  }
});

// ---- Auth routes ----
app.post("/api/auth/signup", async (c) => {
  const limited = rateLimitResponse(c, "signup");
  if (limited) return limited;
  const body = await c.req.json();
  const db = c.get("db");
  const username = cleanText(body.username, 40);
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "").trim();
  if (username.length < 2) return c.json({ error: "Username must be at least 2 characters." }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return c.json({ error: "Please enter a valid email." }, 400);
  const pwErr = passwordPolicyError(password);
  if (pwErr) return c.json({ error: pwErr }, 400);
  const existingEmail = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existingEmail.length > 0) return c.json({ error: "An account with this email already exists." }, 400);
  const existingUsername = await db.select({ id: users.id }).from(users).where(sql`LOWER(${users.username}) = LOWER(${username})`).limit(1);
  if (existingUsername.length > 0) return c.json({ error: "That username is already taken." }, 400);
  const { salt, hash } = await hashPassword(password);
  const result = await db.insert(users).values({ username, email, passwordHash: hash, passwordSalt: salt, hashAlgorithm: "pbkdf2", createdAt: nowIso() }).returning({ id: users.id });
  const rememberMe = body.rememberMe !== false; // default true for signups
  const token = createToken();
  await db.insert(sessions).values({ token, userId: result[0].id, createdAt: nowIso(), expiresAt: sessionExpiry(rememberMe) });
  return c.json({ token, user: { id: result[0].id, username, email, profilePhoto: null } });
});

app.post("/api/auth/login", async (c) => {
  const limited = rateLimitResponse(c, "login");
  if (limited) return limited;
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
  const rememberMe = body.rememberMe !== false; // default true
  const token = createToken();
  await db.insert(sessions).values({ token, userId: user.id, createdAt: nowIso(), expiresAt: sessionExpiry(rememberMe) });
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

const FORGOT_PASSWORD_MESSAGE =
  "If an account exists for that email, we've sent password reset instructions.";

app.post("/api/auth/forgot-password", async (c) => {
  const limited = rateLimitResponse(c, "forgot-password");
  if (limited) return limited;
  try {
    const body = await c.req.json();
    const db = c.get("db");
    const email = String(body?.email || "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ error: "Please enter a valid email address." }, 400);
    }

    const found = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(sql`LOWER(${users.email}) = ${email}`)
      .limit(1);

    if (found.length > 0) {
      const userId = found[0].id;
      const rawToken = createToken();
      const tokenHash = await hashResetToken(rawToken);
      const now = nowIso();
      const expiresAt = passwordResetExpiry();

      await db.execute(sql`
        DELETE FROM password_reset_tokens WHERE user_id = ${userId}
      `);
      await db.execute(sql`
        INSERT INTO password_reset_tokens (token_hash, user_id, expires_at, created_at)
        VALUES (${tokenHash}, ${userId}, ${expiresAt}, ${now})
      `);

      const origin = appOrigin(c.env, c.req.url);
      const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(rawToken)}`;
      await sendPasswordResetEmail(c.env, found[0].email, resetUrl);
    }

    return c.json({ ok: true, message: FORGOT_PASSWORD_MESSAGE });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

app.post("/api/auth/reset-password", async (c) => {
  try {
    const body = await c.req.json();
    const db = c.get("db");
    const rawToken = String(body?.token || "").trim();
    const password = String(body?.password || "").trim();

    if (!rawToken) return c.json({ error: "Reset link is invalid or expired." }, 400);
    const pwErr = passwordPolicyError(password);
    if (pwErr) return c.json({ error: pwErr }, 400);

    const tokenHash = await hashResetToken(rawToken);
    const rows = await db.execute(sql`
      SELECT user_id, expires_at
      FROM password_reset_tokens
      WHERE token_hash = ${tokenHash}
      LIMIT 1
    `);
    const row = (rows.rows as any[])?.[0];
    if (!row) return c.json({ error: "Reset link is invalid or expired." }, 400);

    const userId = Number(row.user_id);
    if (!Number.isFinite(userId) || userId <= 0) {
      return c.json({ error: "Reset link is invalid or expired." }, 400);
    }
    if (String(row.expires_at) <= nowIso()) {
      await db.execute(sql`DELETE FROM password_reset_tokens WHERE token_hash = ${tokenHash}`);
      return c.json({ error: "Reset link is invalid or expired." }, 400);
    }

    const { salt, hash } = await hashPassword(password);
    await db
      .update(users)
      .set({ passwordHash: hash, passwordSalt: salt, hashAlgorithm: "pbkdf2" })
      .where(eq(users.id, userId));
    await db.execute(sql`DELETE FROM password_reset_tokens WHERE user_id = ${userId}`);
    await db.execute(sql`DELETE FROM sessions WHERE user_id = ${userId}`);

    return c.json({ ok: true, message: "Password updated. You can sign in now." });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
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
  const subjRows = await db.execute(sql`
    SELECT subject_id
    FROM user_subjects
    WHERE user_id = ${user.id}
    ORDER BY subject_id ASC
  `);
  return c.json({
    user: {
      id: user.id,
      email: user.email,
      username: user.username,
      profilePhoto: user.profilePhoto ?? null,
    },
    customQuestions: grouped,
    mySubjectIds: (subjRows.rows as any[]).map((r) => String(r.subject_id)),
  });
});

// ---- Subjects (persist user dashboard selection) ----
app.get("/api/subjects/my", authMiddleware, async (c: any) => {
  const user = c.get("user");
  const db = c.get("db");
  const rows = await db.execute(sql`
    SELECT subject_id
    FROM user_subjects
    WHERE user_id = ${user.id}
    ORDER BY subject_id ASC
  `);
  return c.json({ subjectIds: (rows.rows as any[]).map((r) => String(r.subject_id)) });
});

app.put("/api/subjects/my", authMiddleware, async (c: any) => {
  const user = c.get("user");
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({} as any));
  const subjectIdsRaw = Array.isArray(body?.subjectIds) ? body.subjectIds : [];
  const subjectIds = Array.from(
    new Set(
      subjectIdsRaw
        .map((x: any) => String(x ?? "").trim())
        .filter((x: string) => x.length > 0 && x.length <= 80),
    ),
  );
  await db.execute(sql`DELETE FROM user_subjects WHERE user_id = ${user.id}`);
  for (const sid of subjectIds) {
    await db.execute(sql`
      INSERT INTO user_subjects (user_id, subject_id, created_at)
      VALUES (${user.id}, ${sid}, ${nowIso()})
      ON CONFLICT(user_id, subject_id) DO NOTHING
    `);
  }
  return c.json({ ok: true, subjectIds });
});

// ---- Study (Track My Study cross-device persistence) ----
function safeJsonObj(raw: unknown): Record<string, number> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const key = String(k ?? "").trim();
    if (!key) continue;
    const n = Math.max(0, Math.floor(Number(v) || 0));
    out[key] = n;
  }
  return out;
}

function mergeSecondsMaps(a: Record<string, number>, b: Record<string, number>) {
  const out: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = Math.max(out[k] ?? 0, Math.max(0, Math.floor(Number(v) || 0)));
  }
  return out;
}

app.get("/api/study/history", authMiddleware, async (c: any) => {
  const user = c.get("user");
  const db = c.get("db");
  const from = String(c.req.query("from") ?? "").trim();
  const to = String(c.req.query("to") ?? "").trim();
  const fromIso = /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : "0000-01-01";
  const toIso = /^\d{4}-\d{2}-\d{2}$/.test(to) ? to : "9999-12-31";
  const rows = await db.execute(sql`
    SELECT date, daily_seconds, daily_seconds_by_subject
    FROM study_days
    WHERE user_id = ${user.id}
      AND date >= ${fromIso}
      AND date <= ${toIso}
    ORDER BY date ASC
  `);
  return c.json({
    days: (rows.rows as any[]).map((r) => ({
      date: String(r.date),
      dailySeconds: Number(r.daily_seconds ?? 0),
      dailySecondsBySubject: (() => {
        try {
          return safeJsonObj(JSON.parse(String(r.daily_seconds_by_subject ?? "{}")));
        } catch {
          return {};
        }
      })(),
    })),
  });
});

app.post("/api/study/sync", authMiddleware, async (c: any) => {
  const user = c.get("user");
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({} as any));
  const daysRaw = Array.isArray(body?.days) ? body.days : [];
  for (const entry of daysRaw) {
    const date = String(entry?.date ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const incomingSeconds = Math.max(0, Math.floor(Number(entry?.dailySeconds) || 0));
    const incomingBy = safeJsonObj(entry?.dailySecondsBySubject);
    const incomingGoal = entry?.goalMinutes != null ? Math.max(0, Math.floor(Number(entry.goalMinutes) || 0)) : null;

    const existing = await db.execute(sql`
      SELECT daily_seconds, daily_seconds_by_subject, goal_minutes
      FROM study_days
      WHERE user_id = ${user.id} AND date = ${date}
      LIMIT 1
    `);
    const row = (existing.rows as any[])[0];
    let mergedSeconds = incomingSeconds;
    let mergedBy = incomingBy;
    let mergedGoal: number | null = incomingGoal;
    if (row) {
      const oldSeconds = Math.max(0, Math.floor(Number(row.daily_seconds) || 0));
      mergedSeconds = Math.max(oldSeconds, incomingSeconds);
      let oldBy: Record<string, number> = {};
      try {
        oldBy = safeJsonObj(JSON.parse(String(row.daily_seconds_by_subject ?? "{}")));
      } catch {
        oldBy = {};
      }
      mergedBy = mergeSecondsMaps(oldBy, incomingBy);
      const oldGoal = row.goal_minutes == null ? null : Math.max(0, Math.floor(Number(row.goal_minutes) || 0));
      mergedGoal = Math.max(oldGoal ?? 0, incomingGoal ?? 0) || null;
    }

    const byJson = JSON.stringify(mergedBy);
    await db.execute(sql`
      INSERT INTO study_days (user_id, date, daily_seconds, daily_seconds_by_subject, goal_minutes, updated_at)
      VALUES (${user.id}, ${date}, ${mergedSeconds}, ${byJson}, ${mergedGoal}, ${nowIso()})
      ON CONFLICT(user_id, date) DO UPDATE SET
        daily_seconds = EXCLUDED.daily_seconds,
        daily_seconds_by_subject = EXCLUDED.daily_seconds_by_subject,
        goal_minutes = EXCLUDED.goal_minutes,
        updated_at = EXCLUDED.updated_at
    `);
  }
  return c.json({ ok: true });
});

app.put("/api/study/daily", authMiddleware, async (c: any) => {
  const user = c.get("user");
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({} as any));
  const date = String(body?.date ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: "Invalid date" }, 400);
  const incomingSeconds = Math.max(0, Math.floor(Number(body?.dailySeconds) || 0));
  const incomingBy = safeJsonObj(body?.dailySecondsBySubject);
  const incomingGoal = body?.goalMinutes != null ? Math.max(0, Math.floor(Number(body.goalMinutes) || 0)) : null;

  const existing = await db.execute(sql`
    SELECT daily_seconds, daily_seconds_by_subject, goal_minutes
    FROM study_days
    WHERE user_id = ${user.id} AND date = ${date}
    LIMIT 1
  `);
  const row = (existing.rows as any[])[0];
  let mergedSeconds = incomingSeconds;
  let mergedBy = incomingBy;
  let mergedGoal: number | null = incomingGoal;
  if (row) {
    const oldSeconds = Math.max(0, Math.floor(Number(row.daily_seconds) || 0));
    mergedSeconds = Math.max(oldSeconds, incomingSeconds);
    let oldBy: Record<string, number> = {};
    try {
      oldBy = safeJsonObj(JSON.parse(String(row.daily_seconds_by_subject ?? "{}")));
    } catch {
      oldBy = {};
    }
    mergedBy = mergeSecondsMaps(oldBy, incomingBy);
    const oldGoal = row.goal_minutes == null ? null : Math.max(0, Math.floor(Number(row.goal_minutes) || 0));
    mergedGoal = Math.max(oldGoal ?? 0, incomingGoal ?? 0) || null;
  }
  const byJson = JSON.stringify(mergedBy);
  await db.execute(sql`
    INSERT INTO study_days (user_id, date, daily_seconds, daily_seconds_by_subject, goal_minutes, updated_at)
    VALUES (${user.id}, ${date}, ${mergedSeconds}, ${byJson}, ${mergedGoal}, ${nowIso()})
    ON CONFLICT(user_id, date) DO UPDATE SET
      daily_seconds = EXCLUDED.daily_seconds,
      daily_seconds_by_subject = EXCLUDED.daily_seconds_by_subject,
      goal_minutes = EXCLUDED.goal_minutes,
      updated_at = EXCLUDED.updated_at
  `);
  return c.json({ ok: true });
});

// ---- Scorecard (Dashboard) ----
app.get("/api/scorecard", authMiddleware, async (c: any) => {
  const user = c.get("user");
  const db = c.get("db");
  const asOfDate = String(c.req.query("asOfDate") ?? "").trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(asOfDate) ? asOfDate : null;
  const MIN_SUBJECT_ATTEMPTS = 10;

  const totals = await db.execute(sql`
    SELECT
      COUNT(DISTINCT qa.user_id)::int AS total_students,
      COALESCE(SUM(CASE WHEN qa.user_id = ${user.id} AND qa.is_correct = 1 THEN qa.marks ELSE 0 END), 0)::int AS my_points
    FROM question_attempts qa
  `);
  const totalStudents = Number((totals.rows as any[])[0]?.total_students ?? 0);
  const points = Number((totals.rows as any[])[0]?.my_points ?? 0);

  // Rank by points (marks correct) across all subjects.
  const rankRows = await db.execute(sql`
    WITH by_user AS (
      SELECT user_id,
             COALESCE(SUM(CASE WHEN is_correct = 1 THEN marks ELSE 0 END), 0)::int AS points
      FROM question_attempts
      GROUP BY user_id
    ),
    ranked AS (
      SELECT user_id, points,
             DENSE_RANK() OVER (ORDER BY points DESC) AS rnk
      FROM by_user
    )
    SELECT rnk
    FROM ranked
    WHERE user_id = ${user.id}
    LIMIT 1
  `);
  const overallRank = rankRows.rows?.length ? Number((rankRows.rows as any[])[0]?.rnk ?? null) : null;

  // Subjects the student "does" (dashboard selection).
  const subjectRows = await db.execute(sql`
    SELECT subject_id
    FROM user_subjects
    WHERE user_id = ${user.id}
    ORDER BY subject_id ASC
  `);
  const subjectIds = (subjectRows.rows as any[]).map((r) => String(r.subject_id));

  // Average percentile across the student's selected subjects.
  // Percentile per subject is based on mark-weighted % (marks_correct / marks_attempted).
  let overallPercentile: number | null = null;
  if (subjectIds.length > 0) {
    let sum = 0;
    let n = 0;
    for (const sid of subjectIds) {
      const rows = await db.execute(sql`
        WITH by_user AS (
          SELECT user_id,
                 COALESCE(SUM(CASE WHEN is_correct = 1 THEN marks ELSE 0 END), 0)::int AS marks_correct,
                 COALESCE(SUM(marks), 0)::int AS marks_attempted
          FROM question_attempts
          WHERE subject_id = ${sid}
          GROUP BY user_id
        ),
        scored AS (
          SELECT user_id,
                 CASE WHEN marks_attempted > 0
                   THEN (marks_correct::float / marks_attempted::float)
                   ELSE NULL
                 END AS pct
          FROM by_user
          WHERE marks_attempted > 0
        ),
        ranked AS (
          SELECT user_id,
                 pct,
                 DENSE_RANK() OVER (ORDER BY pct DESC) AS rnk,
                 COUNT(*) OVER () AS cnt
          FROM scored
        )
        SELECT rnk, cnt
        FROM ranked
        WHERE user_id = ${user.id}
        LIMIT 1
      `);
      if (!rows.rows?.length) continue;
      const rnk = Number((rows.rows as any[])[0]?.rnk ?? 0);
      const cnt = Number((rows.rows as any[])[0]?.cnt ?? 0);
      if (!rnk || cnt <= 1) continue;
      const pct = cohortPercentileFromRank(rnk, cnt);
      sum += pct;
      n += 1;
    }
    overallPercentile = n > 0 ? sum / n : null;
  }

  const bestWeak = await db.execute(sql`
    SELECT subject_id,
           SUM(CASE WHEN is_correct = 1 THEN marks ELSE 0 END)::int AS marks_correct,
           SUM(marks)::int AS marks_attempted
    FROM question_attempts
    WHERE user_id = ${user.id}
    GROUP BY subject_id
  `);
  const perSubject = (bestWeak.rows as any[]).map((r) => {
    const attempted = Math.max(0, Number(r.marks_attempted ?? 0));
    const correct = Math.max(0, Number(r.marks_correct ?? 0));
    const pct = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
    return { subjectId: String(r.subject_id), attempted, correct, pct };
  }).filter((x) => x.attempted > 0);
  perSubject.sort((a, b) => b.pct - a.pct);
  const bestSubjectId = perSubject.length ? perSubject[0]!.subjectId : null;
  const weakestSubjectId = perSubject.length ? perSubject[perSubject.length - 1]!.subjectId : null;

  // Per-subject "report card" rows: subjects where this student has attempted >= 10 questions.
  const reportSubjects: Array<{
    subjectId: string;
    attempts: number;
    percentile: number | null;
    weakestTopic: { topic: string; percent: number; marksCorrect: number; marksAttempted: number } | null;
    strongestTopic: { topic: string; percent: number; marksCorrect: number; marksAttempted: number } | null;
  }> = [];

  const attemptedBySubjectRows = await db.execute(sql`
    SELECT subject_id, COUNT(*)::int AS attempts
    FROM question_attempts
    WHERE user_id = ${user.id}
    GROUP BY subject_id
  `);
  const attemptedBySubject = new Map<string, number>();
  for (const r of attemptedBySubjectRows.rows as any[]) {
    attemptedBySubject.set(String(r.subject_id), Number(r.attempts ?? 0));
  }

  const eligibleSubjectIds = Array.from(attemptedBySubject.entries())
    .filter(([, attempts]) => attempts >= MIN_SUBJECT_ATTEMPTS)
    .map(([sid]) => sid)
    .sort((a, b) => a.localeCompare(b));

  for (const sid of eligibleSubjectIds) {
    // Rank within this subject by mark-weighted % (marks_correct / marks_attempted), all time.
    const rankInSubject = await db.execute(sql`
      WITH by_user AS (
        SELECT user_id,
               COALESCE(SUM(CASE WHEN is_correct = 1 THEN marks ELSE 0 END), 0)::int AS marks_correct,
               COALESCE(SUM(marks), 0)::int AS marks_attempted
        FROM question_attempts
        WHERE subject_id = ${sid}
        GROUP BY user_id
      ),
      scored AS (
        SELECT user_id,
               CASE WHEN marks_attempted > 0
                 THEN (marks_correct::float / marks_attempted::float)
                 ELSE NULL
               END AS pct
        FROM by_user
        WHERE marks_attempted > 0
      ),
      ranked AS (
        SELECT user_id,
               DENSE_RANK() OVER (ORDER BY pct DESC) AS rnk,
               COUNT(*) OVER () AS cnt
        FROM scored
      )
      SELECT rnk, cnt
      FROM ranked
      WHERE user_id = ${user.id}
      LIMIT 1
    `);
    const rank = rankInSubject.rows?.length ? Number((rankInSubject.rows as any[])[0]?.rnk ?? null) : null;
    const total = rankInSubject.rows?.length ? Number((rankInSubject.rows as any[])[0]?.cnt ?? 0) : 0;
    const percentile =
      rank != null && total > 1
        ? cohortPercentileFromRank(rank, total)
        : null;

    // Weakest/strongest topic for this user in this subject (mark-weighted %).
    const topicRows = await db.execute(sql`
      SELECT topic,
             SUM(CASE WHEN is_correct = 1 THEN marks ELSE 0 END)::int AS marks_correct,
             SUM(marks)::int AS marks_attempted
      FROM question_attempts
      WHERE user_id = ${user.id} AND subject_id = ${sid}
      GROUP BY topic
    `);
    const topics = (topicRows.rows as any[])
      .map((r) => {
        const attempted = Math.max(0, Number(r.marks_attempted ?? 0));
        const correct = Math.max(0, Number(r.marks_correct ?? 0));
        const percent = attempted > 0 ? Math.round((correct / attempted) * 100) : 0;
        return {
          topic: String(r.topic || "General"),
          marksCorrect: correct,
          marksAttempted: attempted,
          percent,
        };
      })
      .filter((t) => t.marksAttempted > 0);

    let weakest: (typeof topics)[number] | null = null;
    let strongest: (typeof topics)[number] | null = null;
    for (const t of topics) {
      if (!weakest || t.percent < weakest.percent) weakest = t;
      if (!strongest || t.percent > strongest.percent) strongest = t;
    }

    reportSubjects.push({
      subjectId: sid,
      attempts: attemptedBySubject.get(sid) ?? 0,
      percentile,
      weakestTopic: weakest,
      strongestTopic: strongest,
    });
  }

  // Study streak up to asOfDate (or today if omitted).
  const end = date ?? new Date().toISOString().slice(0, 10);
  const streakRows = await db.execute(sql`
    SELECT date, daily_seconds
    FROM study_days
    WHERE user_id = ${user.id}
      AND date <= ${end}
    ORDER BY date DESC
    LIMIT 500
  `);
  let streak = 0;
  let cursor = end;
  const byDate = new Map<string, number>();
  for (const r of streakRows.rows as any[]) byDate.set(String(r.date), Number(r.daily_seconds ?? 0));
  for (;;) {
    const secs = byDate.get(cursor) ?? 0;
    if (secs <= 0) break;
    streak += 1;
    const d = new Date(cursor + "T00:00:00.000Z");
    d.setUTCDate(d.getUTCDate() - 1);
    cursor = d.toISOString().slice(0, 10);
  }

  return c.json({
    totalStudents,
    overallRank,
    marks: points,
    overallPercentile,
    bestSubjectId,
    weakestSubjectId,
    studyStreak: streak,
    reportSubjects,
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
    WITH range_scores AS (
      SELECT qa.user_id, u.username,
             SUM(CASE WHEN qa.is_correct = 1 THEN qa.marks ELSE 0 END) AS marks_correct,
             SUM(qa.marks) AS marks_attempted,
             COUNT(*)::int AS attempt_count_range
      FROM question_attempts qa
      JOIN users u ON u.id = qa.user_id
      WHERE qa.subject_id = ${subjectId} ${timeFilter}
      GROUP BY qa.user_id, u.username
    ),
    all_time_attempts AS (
      SELECT user_id, COUNT(*)::int AS attempt_count_all_time
      FROM question_attempts
      WHERE subject_id = ${subjectId}
      GROUP BY user_id
    )
    SELECT r.user_id, r.username, r.marks_correct, r.marks_attempted,
           r.attempt_count_range,
           COALESCE(a.attempt_count_all_time, 0)::int AS attempt_count_all_time
    FROM range_scores r
    LEFT JOIN all_time_attempts a ON a.user_id = r.user_id
  `);
  const allScores = allScoresRows.rows as any[];

  const pctRounded = (r: any) => {
    const ma = Number(r.marks_attempted);
    const mc = Number(r.marks_correct);
    return ma > 0 ? Math.round((mc / ma) * 100) : 0;
  };
  // Eligibility should be all-time: once you’ve done 10 questions ever, you’re ranked.
  const eligible = allScores.filter((r) => Number(r.attempt_count_all_time) >= MIN_RANKED_ATTEMPTS);
  const sortedEligible = [...eligible].sort((a, b) => {
    const d = pctRounded(b) - pctRounded(a);
    if (d !== 0) return d;
    const da = Number(b.marks_attempted) - Number(a.marks_attempted);
    if (da !== 0) return da;
    return String(a.username).localeCompare(String(b.username));
  });

  const myRow = allScores.find((r) => r.user_id === user.id);
  const myAttempts = myRow ? Number(myRow.attempt_count_all_time) : 0;
  const myPct = myRow ? pctRounded(myRow) : 0;

  let rank: number | null = null;
  let percentile: number | null = null;
  if (myAttempts >= MIN_RANKED_ATTEMPTS && sortedEligible.length >= 2) {
    const idx = sortedEligible.findIndex((r) => r.user_id === user.id);
    rank = idx >= 0 ? idx + 1 : null;
    if (rank != null) {
      percentile = cohortPercentileFromRank(rank, sortedEligible.length);
    }
  }

  const leaderboardData = sortedEligible.slice(0, 10).map((r) => ({
    userId: r.user_id,
    username: r.username,
    correct: Number(r.marks_correct),
    total: Number(r.marks_attempted),
    attemptCount: Number(r.attempt_count_all_time),
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
    const sorted = [...list].sort((a, b) => {
      if (b.pctRounded !== a.pctRounded) return b.pctRounded - a.pctRounded;
      return a.userId - b.userId;
    });
    const idx = sorted.findIndex((x) => x.userId === user.id);
    if (idx < 0) return null;
    return cohortPercentileFromRank(idx + 1, sorted.length);
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
    rankedStudents:
      rank != null && sortedEligible.length > 0 ? sortedEligible.length : null,
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

app.post("/api/admin/english/prompts/bulk", adminAccessMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    const body = await c.req.json();
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    if (!rows.length) return c.json({ error: "rows is required." }, 400);

    const now = nowIso();
    const errors: Array<{ index: number; message: string }> = [];
    const bookIdByTitle = new Map<string, number>();
    let importedBooks = 0;
    let importedPrompts = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] ?? {};
      const section = normalizeEnglishSection(r.section);
      const prompt = cleanText(r.prompt, 10000);
      const rawBook = cleanText(r.book, 200);
      const bookTitle =
        rawBook || (section === "A" ? "" : `Section ${section} Imported`);

      if (!prompt) {
        errors.push({ index: i, message: "Missing prompt." });
        continue;
      }
      if (!bookTitle) {
        errors.push({ index: i, message: "Missing book title." });
        continue;
      }

      let bookId = bookIdByTitle.get(bookTitle);
      if (!bookId) {
        // Ensure book exists (unique on title).
        const existing = await db.execute(sql`
          SELECT id FROM english_books WHERE title = ${bookTitle} LIMIT 1
        `);
        const existingId = Number((existing.rows as any[])?.[0]?.id ?? 0);
        if (existingId > 0) {
          bookId = existingId;
        } else {
          const created = await db.execute(sql`
            INSERT INTO english_books (title, created_at)
            VALUES (${bookTitle}, ${now})
            RETURNING id
          `);
          bookId = Number((created.rows as any[])?.[0]?.id ?? 0);
          if (!bookId) {
            errors.push({ index: i, message: "Failed to create book." });
            continue;
          }
          importedBooks += 1;
        }
        bookIdByTitle.set(bookTitle, bookId);
      }

      await db.execute(sql`
        INSERT INTO english_prompts (book_id, prompt_text, section, created_at)
        VALUES (${bookId}, ${prompt}, ${section}, ${now})
      `);
      importedPrompts += 1;
    }

    return c.json({ importedBooks, importedPrompts, errors });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

app.post("/api/admin/english/prompts/bulk-delete", adminAccessMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    const body = await c.req.json();
    const idsRaw = Array.isArray(body?.ids) ? body.ids : [];
    const ids = idsRaw
      .map((x: unknown) => Number(x))
      .filter((n: number) => Number.isFinite(n) && n > 0)
      .slice(0, 2000);
    if (!ids.length) return c.json({ error: "ids is required." }, 400);
    await db.execute(sql`DELETE FROM english_prompts WHERE id = ANY(${ids}::int[])`);
    // Clean up any empty books.
    await db.execute(sql`
      DELETE FROM english_books b
      WHERE NOT EXISTS (SELECT 1 FROM english_prompts p WHERE p.book_id = b.id)
    `);
    return c.json({ ok: true, deleted: ids.length });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

app.post("/api/admin/english/prompts/delete-creative-writing", adminAccessMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    const sectionBFilter = sql`
      LEFT(UPPER(TRIM(REGEXP_REPLACE(COALESCE(section, ''), '^SECTION\\s*', '', 'i'))), 1) = 'B'
      AND (
        LOWER(TRIM(prompt_text)) = 'creative writing'
        OR prompt_text ~* '^\\s*title\\s*:\\s*creative\\s*writing\\.?\\s*(\\n|$)'
        OR prompt_text ~* '^\\s*title\\s*:\\s*last\\s+light\\s+on\\s+platform\\s+9'
        OR prompt_text ~* '^\\s*title\\s*:\\s*borrowed\\s+silence'
        OR prompt_text ~* '^\\s*title\\s*:\\s*small\\s+fires'
        OR prompt_text ~* '^\\s*title\\s*:\\s*after\\s+the\\s+rain'
        OR (
          prompt_text ~* '^\\s*title\\s*:'
          AND prompt_text !~* 'stimulus'
          AND prompt_text !~* 'framework'
          AND prompt_text !~* 'using at least one'
          AND LENGTH(prompt_text) < 280
          AND prompt_text !~* '^\\s*title\\s*:\\s*origins'
          AND prompt_text !~* '^\\s*title\\s*:\\s*small\\s+acts'
          AND prompt_text !~* '^\\s*title\\s*:\\s*changing\\s+direction'
        )
      )
    `;
    const before = await db.execute(sql`
      SELECT COUNT(*)::int AS n
      FROM english_prompts
      WHERE ${sectionBFilter}
    `);
    const total = Number((before.rows as any[])?.[0]?.n ?? 0);
    await db.execute(sql`
      DELETE FROM english_prompts
      WHERE ${sectionBFilter}
    `);
    await db.execute(sql`
      DELETE FROM english_books b
      WHERE NOT EXISTS (SELECT 1 FROM english_prompts p WHERE p.book_id = b.id)
    `);
    return c.json({ ok: true, deleted: total });
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
    if (section === "B") {
      await ensureSectionBCuratedPrompts(db);
    }
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

    const prompts = (effectiveRows.rows as any[])
      .map((r) => ({
        id: Number(r.id),
        bookId: Number(r.book_id),
        bookTitle: String(r.book_title || ""),
        prompt: String(r.prompt_text || ""),
        section: normalizeEnglishSection(r.section),
      }))
      .filter((p) => String(p.prompt ?? "").trim().length > 0);
    return c.json({ prompts });
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

function parseCustomQuestionPayload(body: Record<string, unknown>) {
  const subjectId = canonicalSubjectId(
    cleanText(String(body.subjectId ?? body.subject_id ?? ""), 80),
  );
  const type = cleanText(String(body.type ?? ""), 20);
  const question = cleanText(String(body.question ?? ""), 1000);
  const topic = cleanText(String(body.topic || "General"), 100);
  const passage = body.passage ? cleanText(String(body.passage), 3000) : null;
  const guidance = body.guidance ? cleanText(String(body.guidance), 500) : null;

  let optionsJson: string | null = null;
  if (Array.isArray(body.options)) {
    optionsJson = JSON.stringify(body.options);
  } else if (body.options_json != null) {
    const opts = parseFlexibleStringArray(body.options_json);
    if (opts?.length) optionsJson = JSON.stringify(opts);
  }

  let acceptedAnswersJson: string | null = null;
  if (Array.isArray(body.acceptedAnswers)) {
    acceptedAnswersJson = JSON.stringify(body.acceptedAnswers);
  } else if (body.accepted_answers_json != null) {
    const acc = parseFlexibleStringArray(body.accepted_answers_json);
    if (acc?.length) acceptedAnswersJson = JSON.stringify(acc);
  }

  let imageUrlsJson: string | null = null;
  if (Array.isArray(body.imageUrls)) {
    const urls = body.imageUrls
      .map((u: unknown) => String(u ?? "").trim())
      .filter(Boolean)
      .slice(0, 6);
    if (urls.length) imageUrlsJson = JSON.stringify(urls);
  } else if (body.image_urls_json != null) {
    const imgs = parseFlexibleStringArray(body.image_urls_json);
    if (imgs?.length) imageUrlsJson = JSON.stringify(imgs.slice(0, 6));
  }

  const answerRaw = body.correctAnswer ?? body.answer;
  const answer = answerRaw ? cleanText(String(answerRaw), 500) : null;
  const marksDefault = type === "mcq" ? 1 : 2;
  const marksParsed = Math.round(Number(body.marks ?? marksDefault));
  const marks = Number.isFinite(marksParsed)
    ? Math.max(1, marksParsed)
    : marksDefault;

  return {
    subjectId,
    type,
    question,
    topic,
    passage,
    guidance,
    optionsJson,
    acceptedAnswersJson,
    imageUrlsJson,
    answer,
    marks,
  };
}

async function insertCustomQuestionRow(
  db: any,
  body: Record<string, unknown>,
): Promise<number> {
  const p = parseCustomQuestionPayload(body);
  if (!p.subjectId || !p.type || !p.question) {
    throw new Error("subjectId, type, and question are required.");
  }
  const result = await db
    .insert(customQuestions)
    .values({
      subjectId: p.subjectId,
      type: p.type,
      topic: p.topic,
      question: p.question,
      imageUrls: p.imageUrlsJson,
      options: p.optionsJson,
      answer: p.answer,
      acceptedAnswers: p.acceptedAnswersJson,
      guidance: p.guidance,
      passage: p.passage,
      marks: p.marks,
      createdAt: nowIso(),
    })
    .returning({ id: customQuestions.id });
  return Number(result[0].id);
}

app.post("/api/admin/questions", adminAccessMiddleware, async (c: any) => {
  const db = c.get("db");
  let body: Record<string, unknown>;
  try {
    body = await c.req.json() as Record<string, unknown>;
  } catch {
    return c.json({ error: "Invalid JSON body." }, 400);
  }

  if (!body.subjectId && !body.subject_id) {
    return c.json({ error: "subjectId, type, and question are required." }, 400);
  }

  try {
    const id = await insertCustomQuestionRow(db, body);
    return c.json({ ok: true, id });
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
  if (body.subjectId != null || body.subject_id != null) {
    updates.subjectId = canonicalSubjectId(
      cleanText(String(body.subjectId ?? body.subject_id), 80),
    );
  }
  if (body.type != null) updates.type = cleanText(body.type, 20);
  if (body.question != null) updates.question = cleanText(body.question, 1000);
  if (body.topic != null) {
    updates.topic = cleanText(body.topic, 240) || "General";
  }
  if (body.passage != null) {
    updates.passage = body.passage ? cleanText(body.passage, 3000) : null;
  }
  if (body.guidance != null) {
    updates.guidance = body.guidance ? cleanText(body.guidance, 500) : null;
  }
  if (body.marks != null) {
    updates.marks = Math.max(1, Math.round(Number(body.marks ?? 1)));
  }
  if (body.options != null || body.options_json != null) {
    if (Array.isArray(body.options)) {
      updates.options = JSON.stringify(body.options);
    } else {
      const opts = parseFlexibleStringArray(body.options_json);
      updates.options = opts?.length ? JSON.stringify(opts) : null;
    }
  }
  const answerRaw = body.correctAnswer ?? body.answer;
  if (answerRaw != null) {
    updates.answer = answerRaw ? cleanText(String(answerRaw), 500) : null;
  }
  if (Array.isArray(body.acceptedAnswers)) {
    const accepted = body.acceptedAnswers
      .map((x: unknown) => String(x ?? "").trim())
      .filter(Boolean);
    updates.acceptedAnswers = JSON.stringify(accepted);
  } else if (body.accepted_answers_json != null) {
    const acc = parseFlexibleStringArray(body.accepted_answers_json);
    updates.acceptedAnswers = acc?.length ? JSON.stringify(acc) : null;
  }
  if (Array.isArray(body.imageUrls)) {
    const urls = body.imageUrls
      .map((u: unknown) => String(u ?? "").trim())
      .filter(Boolean)
      .slice(0, 6);
    updates.imageUrls = urls.length ? JSON.stringify(urls) : null;
  } else if (body.image_urls_json != null) {
    const imgs = parseFlexibleStringArray(body.image_urls_json);
    updates.imageUrls = imgs?.length ? JSON.stringify(imgs.slice(0, 6)) : null;
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

app.post("/api/admin/questions/bulk", adminAccessMiddleware, async (c: any) => {
  const db = c.get("db");
  const body = await c.req.json();
  const rows = Array.isArray(body?.questions) ? body.questions : [];
  if (!rows.length) return c.json({ error: "questions array is required." }, 400);
  if (rows.length > 500) {
    return c.json({ error: "Maximum 500 questions per bulk request." }, 400);
  }

  let imported = 0;
  const errors: { index: number; message: string }[] = [];
  for (let i = 0; i < rows.length; i++) {
    try {
      await insertCustomQuestionRow(db, rows[i] as Record<string, unknown>);
      imported++;
    } catch (e: unknown) {
      errors.push({
        index: i,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return c.json({ ok: true, imported, errors });
});

app.post(
  "/api/admin/questions/attach-images-bulk",
  adminAccessMiddleware,
  async (c: any) => {
    const db = c.get("db");
    const body = await c.req.json();
    const mappings = Array.isArray(body?.mappings) ? body.mappings : [];
    if (!mappings.length) {
      return c.json({ error: "mappings array is required." }, 400);
    }

    let updated = 0;
    const errors: { index: number; message: string }[] = [];

    for (let i = 0; i < mappings.length; i++) {
      const m = mappings[i] as Record<string, unknown>;
      try {
        const imgs = parseFlexibleStringArray(m.image_urls_json);
        if (!imgs?.length) {
          throw new Error("image_urls_json must contain at least one URL.");
        }
        const imageUrlsJson = JSON.stringify(imgs.slice(0, 6));
        const questionId = Number(m.questionId);
        if (Number.isFinite(questionId) && questionId > 0) {
          const hit = await db
            .update(customQuestions)
            .set({ imageUrls: imageUrlsJson })
            .where(eq(customQuestions.id, questionId))
            .returning({ id: customQuestions.id });
          if (!hit.length) throw new Error(`Question id ${questionId} not found.`);
          updated++;
          continue;
        }

        const subjectId = canonicalSubjectId(
          cleanText(String(m.subjectId ?? m.subject_id ?? ""), 80),
        );
        const question = cleanText(String(m.question ?? ""), 1000);
        if (!subjectId || !question) {
          throw new Error("subjectId and question are required (or questionId).");
        }

        const found = await db
          .select({ id: customQuestions.id })
          .from(customQuestions)
          .where(
            and(
              eq(customQuestions.subjectId, subjectId),
              eq(customQuestions.question, question),
            ),
          )
          .limit(1);
        if (!found.length) {
          throw new Error("No matching question found for subject + question text.");
        }
        await db
          .update(customQuestions)
          .set({ imageUrls: imageUrlsJson })
          .where(eq(customQuestions.id, found[0].id));
        updated++;
      } catch (e: unknown) {
        errors.push({
          index: i,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return c.json({ ok: true, updated, errors });
  },
);

app.post("/api/admin/methods/retag-topics", adminAccessMiddleware, async (c: any) => {
  const db = c.get("db");
  const rows = await db
    .select()
    .from(customQuestions)
    .where(eq(customQuestions.subjectId, "methods"));
  let updated = 0;
  for (const row of rows as any[]) {
    const next = methodsRetagInfer(
      String(row.topic ?? ""),
      String(row.question ?? ""),
      row.passage ? String(row.passage) : "",
    );
    if (String(row.topic ?? "") === next) continue;
    await db.update(customQuestions).set({ topic: next }).where(eq(customQuestions.id, Number(row.id)));
    updated++;
  }
  return c.json({ ok: true, updated, total: rows.length });
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

app.post("/api/admin/questions/bulk-delete", adminAccessMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    const body = await c.req.json();
    const idsRaw = Array.isArray(body?.ids) ? body.ids : [];
    const ids = idsRaw
      .map((x: unknown) => Number(x))
      .filter((n: number) => Number.isFinite(n) && n > 0)
      .slice(0, 2000);
    if (!ids.length) return c.json({ error: "ids is required." }, 400);
    await db.execute(sql`DELETE FROM custom_questions WHERE id = ANY(${ids}::int[])`);
    return c.json({ ok: true, deleted: ids.length });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
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

// Pages Functions entry (used by `wrangler pages dev` / production deploy)
export const onRequest: PagesFunction<Env> = async (context) => {
  return app.fetch(context.request, context.env);
};

// Module worker entry (used by `wrangler dev` when main points at this file)
export default app;
