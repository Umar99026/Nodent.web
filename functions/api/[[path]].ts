import { Hono } from "hono";
import { cors } from "hono/cors";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, or, and, asc, desc, sql, notIlike } from "drizzle-orm";
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
import {
  markLongAnswer,
  markHandwritingAnswer,
  aiProviderPoolSize,
  openAiConfigured,
  openAiModel,
  questionHelpChat,
  generateMarkBreakdown,
  type SubjectMarkingContext,
} from "../lib/openai";
import {
  englishAiConfigured,
  englishAiReservationDetails,
  englishAiUserMessage,
  scoreEnglishResponse,
} from "../lib/englishOpenAi";
import {
  AiSafetyError,
  aiSafetyStatus,
  beginAiRequest,
  finishAiRequest,
  openAiEnglishReservationUsd,
  readCachedAiResult,
  sha256Key,
} from "../lib/aiSafety";
import {
  canRunEnglishAiMark,
  canRunAiResponse,
  ensurePracticeExamUsage,
  getPremiumUsageSummary,
  hasAiResponseUsageForRef,
  hasUsageForRefSince,
  hasPracticeExamAccess,
  isPremiumAccount,
  premiumRequiredResponse,
  PREMIUM_REQUIRED,
  quotaExceededResponse,
  reserveUsageSlot,
  rollbackUsageSlot,
  startOfUtcDayIso,
  FREE_DAILY_AI_RESPONSE_LIMIT,
  FREE_ENGLISH_ESSAY_LIMIT,
  USAGE_KIND_AI_RESPONSE,
  USAGE_KIND_ENGLISH_ESSAY_AI,
} from "../lib/premium";
import {
  qualifiesForOpenAiHandwriting,
  qualifiesForOpenAiMarking,
} from "../lib/wordedQuestion";
import { isPlaceholderTopic } from "../lib/topicDisplay";

// ---- Schema ----
const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().default(""),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  passwordSalt: text("password_salt").notNull(),
  hashAlgorithm: text("hash_algorithm").notNull().default("pbkdf2"),
  profilePhoto: text("profile_photo"),
  accountRole: text("account_role"),
  onboardingCompletedAt: text("onboarding_completed_at"),
  isVceStudent: integer("is_vce_student"),
  plan: text("plan").notNull().default("free"),
  premiumUntil: text("premium_until"),
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
  answerImageUrls: text("answer_image_urls"),
  options: text("options"),
  answer: text("answer"),
  acceptedAnswers: text("accepted_answers"),
  answerPartsJson: text("answer_parts_json"),
  markBreakdownJson: text("mark_breakdown_json"),
  guidance: text("guidance"),
  passage: text("passage"),
  marks: integer("marks").notNull().default(1),
  aiMarkingEnabled: integer("ai_marking_enabled"),
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
  marksEarned: integer("marks_earned"),
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

const userFeedback = pgTable("user_feedback", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  authorName: text("author_name"),
  authorEmail: text("author_email"),
  message: text("message").notNull(),
  rating: integer("rating"),
  vceStudent: text("vce_student"),
  featuresStandOut: text("features_stand_out"),
  createdAt: text("created_at").notNull(),
});

// ---- Helpers ----
/** Hardcoded admin email must match `ADMIN_EMAIL` in frontend `constants.ts`. */
const ADMIN_EMAIL_LC = "nodent.app@gmail.com";
/** Notified when a new user signs up (override with SIGNUP_NOTIFY_EMAIL in production). */
const SIGNUP_NOTIFY_EMAIL_DEFAULT = "ua99026@gmail.com";

function cleanText(value: unknown, maxLength = 1000): string {
  if (typeof value !== "string") return "";
  return value.replace(/\0/g, "").trim().slice(0, maxLength);
}

const MAX_STORED_DATA_URL_CHARS = 52_000;
/** Full practice-exam pages (one per API request) — must match PRACTICE_EXAM_PAGE_DATA_URL_CHARS in frontend. */
const MAX_PRACTICE_EXAM_PAGE_DATA_URL_CHARS = 900_000;
const MAX_MARKING_DATA_URL_CHARS = 220_000;

function isDataImageUrl(value: string): boolean {
  return /^data:image\/(png|jpe?g|webp);base64,/i.test(String(value ?? "").trim());
}

function collectHandwritingImages(body: Record<string, unknown>): string[] {
  const seen = new Set<string>();
  const images: string[] = [];
  const push = (raw: unknown) => {
    const s = String(raw ?? "").trim();
    if (!isDataImageUrl(s) || seen.has(s)) return;
    seen.add(s);
    images.push(s);
  };
  if (Array.isArray(body.responseImages)) {
    for (const img of body.responseImages) push(img);
  }
  if (Array.isArray(body.studentParts)) {
    for (const part of body.studentParts) push(part);
  }
  push(body.responseText);
  return images.slice(0, 4);
}

function validateMarkingImageUrls(urls: string[]): string | null {
  for (const raw of urls) {
    const u = String(raw ?? "").trim();
    if (!u) continue;
    if (/^data:/i.test(u) && u.length > MAX_MARKING_DATA_URL_CHARS) {
      return "Handwriting image is too large to mark. Try a smaller drawing area.";
    }
  }
  return null;
}

function validateStorableImageUrls(urls: string[]): string | null {
  for (const raw of urls) {
    const u = String(raw ?? "").trim();
    if (!u) continue;
    if (/^data:/i.test(u) && u.length > MAX_STORED_DATA_URL_CHARS) {
      return "Image is too large to store. Crop tighter or use a smaller screenshot.";
    }
  }
  return null;
}

function validatePracticeExamPageImageUrl(url: string): string | null {
  const u = String(url ?? "").trim();
  if (!u) return "imageDataUrl is required.";
  if (/^data:/i.test(u) && u.length > MAX_PRACTICE_EXAM_PAGE_DATA_URL_CHARS) {
    return "Exam page image is too large. Re-import the PDF at a lower page count or contact support.";
  }
  return null;
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

function subjectIdEquivalents(canonical: string): string[] {
  const sid = canonicalSubjectId(canonical);
  const base = [sid];
  const extra: Record<string, string[]> = {
    methods: ["mathematical methods", "mathematical-methods", "math methods", "mm"],
    "general-maths": ["general maths", "general mathematics", "general-mathematics"],
    "further-maths": ["further maths", "further mathematics"],
    "specialist-maths": ["specialist maths", "specialist mathematics"],
  };
  return Array.from(new Set([...base, ...(extra[sid] ?? [])]));
}

/** Match `frontend/src/lib/builtinQuestionsSeed.ts` — dedupe by subject + question stem. */
function questionStemKey(text: string): string {
  return String(text ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

/** Image-only / PDF imports often share these — not meaningful for duplicate blocking. */
const GENERIC_QUESTION_STEMS = new Set([
  "see figure.",
  "see figure",
  "see the figure.",
  "see the figure",
  "refer to the figure.",
  "see diagram.",
  "see graph.",
  "see table.",
]);

function isGenericQuestionStem(stem: string): boolean {
  const s = questionStemKey(stem);
  return !s || GENERIC_QUESTION_STEMS.has(s);
}

class DuplicateQuestionError extends Error {
  constructor() {
    super("Duplicate question stem for this subject.");
    this.name = "DuplicateQuestionError";
  }
}

function isDuplicateQuestionDbError(e: unknown): boolean {
  const msg = errorChain(e).toLowerCase();
  return (
    e instanceof DuplicateQuestionError ||
    msg.includes("custom_questions_subject_stem_unique") ||
    (msg.includes("duplicate key") && msg.includes("custom_questions"))
  );
}

/** DB lookup — authoritative duplicate check (survives concurrent imports). */
async function findExistingQuestionByStem(
  db: any,
  subjectId: string,
  question: string,
  excludeId?: number,
): Promise<number | null> {
  const sid = canonicalSubjectId(subjectId);
  const stem = questionStemKey(question);
  if (!sid || !stem) return null;
  const exclude = Number(excludeId);
  const result = await db.execute(
    Number.isFinite(exclude) && exclude > 0
      ? sql`
          SELECT id FROM custom_questions
          WHERE LOWER(TRIM(subject_id)) = ${sid}
            AND LOWER(REGEXP_REPLACE(TRIM(question), '\\s+', ' ', 'g')) = ${stem}
            AND id <> ${exclude}
          ORDER BY id ASC
          LIMIT 1
        `
      : sql`
          SELECT id FROM custom_questions
          WHERE LOWER(TRIM(subject_id)) = ${sid}
            AND LOWER(REGEXP_REPLACE(TRIM(question), '\\s+', ' ', 'g')) = ${stem}
          ORDER BY id ASC
          LIMIT 1
        `,
  );
  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  const id = Number((rows[0] as { id?: unknown })?.id);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function customQuestionStemSetKey(subjectId: string, question: string): string {
  const sid = canonicalSubjectId(subjectId);
  const stem = questionStemKey(question);
  return stem ? `${sid}::${stem}` : "";
}

function hashImportFingerprint(raw: string): string {
  let h = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h ^= raw.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/** Dedupe key — generic stems like "See figure." also use parts + images. */
function customQuestionImportKey(
  subjectId: string,
  question: string,
  body: Record<string, unknown>,
): string {
  const base = customQuestionStemSetKey(subjectId, question);
  if (!base) return "";
  const stem = questionStemKey(question);
  if (stem !== "see figure." && stem !== "see figure") return base;

  const fingerprint = JSON.stringify({
    parts: body.answerParts ?? body.answer_parts_json ?? null,
    images: body.imageUrls ?? body.image_urls_json ?? null,
    passage: body.passage ?? null,
  });
  return `${base}::${hashImportFingerprint(fingerprint)}`;
}

async function loadCustomQuestionStemKeys(db: any): Promise<Set<string>> {
  const result = await db.execute(sql`SELECT subject_id, question FROM custom_questions`);
  const rows = Array.isArray(result) ? result : (result.rows ?? []);
  const keys = new Set<string>();
  for (const r of rows as Array<{ subject_id?: string; question?: string }>) {
    const k = customQuestionStemSetKey(String(r.subject_id ?? ""), String(r.question ?? ""));
    if (k) keys.add(k);
  }
  return keys;
}

function normalizeEnglishSection(raw: unknown): "A" | "B" | "C" {
  const s0 = String(raw ?? "").trim().toUpperCase();
  const s = s0.replace(/^SECTION\s*/i, "").trim();
  const first = s.slice(0, 1);
  return first === "B" ? "B" : first === "C" ? "C" : "A";
}

/** Keep in sync with `frontend/src/pages/EnglishPracticePage.tsx` dedupePrompts. */
function normalizeEnglishPromptKey(text: unknown): string {
  return String(text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[""]/g, '"')
    .replace(/['']/g, "'")
    .trim();
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
  `Title: Borderlines.
Using at least one stimulus, write a crafted text exploring ideas about country, place and belonging.

Write a text that explores ideas about country.
Use the provided title.
Use at least one stimulus.

Stimulus
Home is not a place on a map. It is the language you dream in.`,
  `Title: Borderlines.
Using at least one stimulus, write a crafted text exploring ideas about country, place and belonging.

Write a text that explores ideas about country.
Use the provided title.
Use at least one stimulus.

Stimulus
The soil remembers what the headlines forget.`,
  `Title: Unmuted.
Using at least one stimulus, write a crafted text exploring ideas about protest, voice and collective action.

Write a text that explores ideas about protest.
Use the provided title.
Use at least one stimulus.

Stimulus
They told us to be quiet. We learned to whisper until our whispers sounded like thunder.`,
  `Title: Unmuted.
Using at least one stimulus, write a crafted text exploring ideas about protest, voice and collective action.

Write a text that explores ideas about protest.
Use the provided title.
Use at least one stimulus.

Stimulus
A sign is only cardboard until someone decides to stand in the rain and hold it.`,
  `Title: Halfway.
Using at least one stimulus, write a crafted text exploring ideas about personal journeys and transformation.

Write a text that explores ideas about personal journeys.
Use the provided title.
Use at least one stimulus.

Stimulus
I am not who I was, and not yet who I mean to become.`,
  `Title: Halfway.
Using at least one stimulus, write a crafted text exploring ideas about personal journeys and transformation.

Write a text that explores ideas about personal journeys.
Use the provided title.
Use at least one stimulus.

Stimulus
Sometimes the hardest step is the one that looks like standing still.`,
  `Title: The Long Way Round.
Using at least one stimulus, write a crafted text exploring ideas about personal journeys and transformation.

Write a text that explores ideas about personal journeys.
Use the provided title.
Use at least one stimulus.

Stimulus
What if the detour was not a mistake, but the point of the journey?`,
  `Title: The Long Way Round.
Using at least one stimulus, write a crafted text exploring ideas about personal journeys and transformation.

Write a text that explores ideas about personal journeys.
Use the provided title.
Use at least one stimulus.

Stimulus
You cannot return to the beginning, but you can choose what you carry forward.`,
  `Title: Second Chance.
Using at least one stimulus, write a crafted text exploring ideas about play, rules and imagination.

Write a text that explores ideas about play.
Use the provided title.
Use at least one stimulus.

Stimulus
Every game has rules. The interesting ones are the rules no one wrote down.`,
  `Title: Second Chance.
Using at least one stimulus, write a crafted text exploring ideas about play, rules and imagination.

Write a text that explores ideas about play.
Use the provided title.
Use at least one stimulus.

Stimulus
We pretended the creek was an ocean because nobody had told us how small our suburb was.`,
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

/** Minimum scored questions before a student appears in cohort rankings. */
const MIN_RANKED_ATTEMPTS = 10;

/**
 * Rank a user by mark-weighted % (marks earned ÷ marks attempted) within a cohort.
 * Everyone in the cohort must have at least `minAttempts` questions in the filter scope.
 */
async function getUserMarksRankInCohort(
  db: any,
  userId: number,
  filters: { subjectId?: string; subjectIdOptions?: string[]; topic?: string; timeFilter?: ReturnType<typeof sql> },
  minAttempts = MIN_RANKED_ATTEMPTS,
): Promise<{ rank: number | null; rankedStudents: number; percentile: number | null }> {
  const subjectFilter = filters.subjectIdOptions?.length
    ? sql` AND subject_id IN (${sqlTextInList(filters.subjectIdOptions)}) `
    : filters.subjectId
      ? sql` AND subject_id = ${filters.subjectId} `
      : sql``;
  const topicFilter = filters.topic ? sql` AND topic = ${filters.topic} ` : sql``;
  const timeFilter = filters.timeFilter ?? sql``;

  const rows = await db.execute(sql`
    WITH by_user AS (
      SELECT user_id,
        COALESCE(SUM(COALESCE(marks_earned, CASE WHEN is_correct = 1 THEN marks ELSE 0 END)), 0)::int AS marks_correct,
        COALESCE(SUM(marks), 0)::int AS marks_attempted,
        COUNT(*)::int AS attempt_count
      FROM question_attempts
      WHERE 1=1 ${subjectFilter} ${topicFilter} ${timeFilter}
      GROUP BY user_id
    ),
    eligible AS (
      SELECT user_id, marks_correct, marks_attempted,
        CASE WHEN marks_attempted > 0
          THEN marks_correct::float / marks_attempted::float
          ELSE NULL
        END AS pct
      FROM by_user
      WHERE attempt_count >= ${minAttempts} AND marks_attempted > 0
    ),
    ranked AS (
      SELECT user_id,
        DENSE_RANK() OVER (ORDER BY pct DESC, marks_attempted DESC, user_id ASC) AS rnk,
        COUNT(*) OVER ()::int AS cnt
      FROM eligible
    )
    SELECT rnk, cnt
    FROM ranked
    WHERE user_id = ${userId}
    LIMIT 1
  `);

  const row = (rows.rows as any[])?.[0];
  if (!row) {
    const countRows = await db.execute(sql`
      WITH by_user AS (
        SELECT user_id,
          COUNT(*)::int AS attempt_count,
          COALESCE(SUM(marks), 0)::int AS marks_attempted
        FROM question_attempts
        WHERE 1=1 ${subjectFilter} ${topicFilter} ${timeFilter}
        GROUP BY user_id
      )
      SELECT COUNT(*)::int AS cnt
      FROM by_user
      WHERE attempt_count >= ${minAttempts} AND marks_attempted > 0
    `);
    const rankedStudents = Number((countRows.rows as any[])?.[0]?.cnt ?? 0);
    return { rank: null, rankedStudents, percentile: null };
  }

  const rank = Number(row.rnk ?? 0) || null;
  const rankedStudents = Number(row.cnt ?? 0);
  const percentile =
    rank != null && rankedStudents > 1
      ? cohortPercentileFromRank(rank, rankedStudents)
      : null;
  return { rank, rankedStudents, percentile };
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

/** Safe student-facing message for question-help failures. */
function userFacingHelpError(e: unknown): string {
  const raw = errorChain(e);
  const lower = raw.toLowerCase();
  const fallback = "Could not get help right now. Try again.";

  if (
    lower.includes("insufficient_quota") ||
    lower.includes("exceeded your current quota") ||
    lower.includes("billing") ||
    /\b429\b/.test(lower)
  ) {
    if (lower.includes("limit: 0") || lower.includes("free_tier")) {
      return "This Gemini model has no free quota on your account. Set GEMINI_MODEL=gemini-2.5-flash in .dev.vars (or enable billing), then restart npm run dev:all.";
    }
    return "Gemini quota exceeded. Wait a bit, check ai.dev/rate-limit, or enable billing.";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Too many requests. Wait a moment and try again.";
  }
  if (lower.includes("gemini_api_key") || lower.includes("not configured")) {
    return "Question help is not configured (GEMINI_API_KEY missing).";
  }
  if (lower.includes("gemini error") || raw.includes("{")) {
    return fallback;
  }
  if (raw.length > 140) return fallback;
  return raw || fallback;
}

/** Safe student-facing message for written-answer / handwriting marking failures. */
function userFacingMarkError(e: unknown, handwriting = false): string {
  const raw = errorChain(e);
  const lower = raw.toLowerCase();
  const fallback = handwriting
    ? "Could not read your drawing. Try again in a moment."
    : "Could not mark your answer. Try again.";

  if (
    lower.includes("insufficient_quota") ||
    lower.includes("exceeded your current quota") ||
    lower.includes("billing")
  ) {
    return "AI marking is temporarily unavailable. Try again later.";
  }
  if (lower.includes("rate limit") || /\b429\b/.test(lower)) {
    return "Too many requests. Wait a moment and try again.";
  }
  if (lower.includes("gemini_api_key") || lower.includes("openai_api_key") || lower.includes("not configured")) {
    return "AI marking is not available right now.";
  }
  if (lower.includes("handwriting image is too large") || lower.includes("too large to mark")) {
    return "Your drawing is too large. Use a smaller area or less ink.";
  }
  if (lower.includes("gemini error") || lower.includes("openai error") || raw.includes("{")) {
    return fallback;
  }
  if (raw.length > 140) return fallback;
  return raw || fallback;
}
function createToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
}
function phoneUploadSessionExpiry(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() + 20);
  return d.toISOString();
}
function parseImageUrlList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((u) => String(u ?? "").trim())
    .filter((u) => u.startsWith("data:image/") || /^https?:\/\//i.test(u))
    .slice(0, 8);
}

type PracticeExamSlotRow = {
  id: string;
  pageNumber: number;
  key: string;
  label?: string;
  acceptedAnswer: string;
  marks?: number;
  overlayX: number;
  overlayY: number;
  overlayW: number;
  overlayH: number;
  transparentInput?: boolean;
};

type PracticeExamMcqRow = {
  id: string;
  questionNumber: number;
  pageNumber?: number;
  question?: string;
  options?: string[];
  stimulusImageUrl?: string;
  stimulusCrop?: { x: number; y: number; w: number; h: number };
  showStimulus?: boolean;
  optionOverlays?: Record<
    string,
    { overlayX: number; overlayY: number; overlayW: number; overlayH: number }
  >;
  mcqGroupBounds?: { overlayX: number; overlayY: number; overlayW: number; overlayH: number };
  mcqButtonsSeparated?: boolean;
  mcqGroupLayout?: "row" | "column";
  mcqButtonSizePct?: number;
  acceptedAnswer: string;
  marks?: number;
};

const MAX_MCQ_STIMULUS_DATA_URL_CHARS = 400_000;

function parseCropRect(raw: unknown): PracticeExamMcqRow["stimulusCrop"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const row = raw as Record<string, unknown>;
  const x = Number(row.x);
  const y = Number(row.y);
  const w = Number(row.w);
  const h = Number(row.h);
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return undefined;
  return {
    x: Math.min(1, Math.max(0, x)),
    y: Math.min(1, Math.max(0, y)),
    w: Math.min(1, Math.max(0.01, w)),
    h: Math.min(1, Math.max(0.01, h)),
  };
}

function validateMcqStimulusImageUrl(url: string): string | null {
  const u = String(url ?? "").trim();
  if (!u) return null;
  if (/^data:/i.test(u) && u.length > MAX_MCQ_STIMULUS_DATA_URL_CHARS) {
    return `MCQ stimulus image is too large (max ~${Math.round(MAX_MCQ_STIMULUS_DATA_URL_CHARS / 1000)}KB per question).`;
  }
  return null;
}

function parseOverlayRect(
  raw: unknown,
): { overlayX: number; overlayY: number; overlayW: number; overlayH: number } | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const overlayX = Number(row.overlayX);
  const overlayY = Number(row.overlayY);
  const overlayW = Number(row.overlayW);
  const overlayH = Number(row.overlayH);
  if (![overlayX, overlayY, overlayW, overlayH].every((n) => Number.isFinite(n))) return null;
  return {
    overlayX: Math.min(100, Math.max(0, overlayX)),
    overlayY: Math.min(100, Math.max(0, overlayY)),
    overlayW: Math.min(100, Math.max(1, overlayW)),
    overlayH: Math.min(100, Math.max(1, overlayH)),
  };
}

function parseMcqOptionOverlays(
  raw: unknown,
): PracticeExamMcqRow["optionOverlays"] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const out: NonNullable<PracticeExamMcqRow["optionOverlays"]> = {};
  for (const letter of ["A", "B", "C", "D"]) {
    const rect = parseOverlayRect((raw as Record<string, unknown>)[letter]);
    if (rect) out[letter] = rect;
  }
  return Object.keys(out).length ? out : undefined;
}

function parsePracticeExamLayout(value: unknown): "written" | "mcq_then_written" {
  return String(value ?? "").trim() === "mcq_then_written" ? "mcq_then_written" : "written";
}

function parsePracticeExamMcqCount(value: unknown, layout: "written" | "mcq_then_written"): number {
  const n = Math.round(Number(value));
  if (layout !== "mcq_then_written") return 0;
  if (!Number.isFinite(n) || n < 1) return 20;
  return Math.min(60, n);
}

function parsePracticeExamMcqItems(value: unknown): PracticeExamMcqRow[] {
  if (!Array.isArray(value)) return [];
  const out: PracticeExamMcqRow[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const id = cleanText(row.id, 80);
    const questionNumber = Math.round(Number(row.questionNumber));
    const acceptedAnswer = cleanText(row.acceptedAnswer, 500);
    if (!id || !questionNumber || questionNumber < 1 || questionNumber > 60) continue;
    if (!acceptedAnswer) continue;
    const pageNumber = Math.round(Number(row.pageNumber));
    const optionOverlays = parseMcqOptionOverlays(row.optionOverlays);
    const mcqGroupBounds = parseOverlayRect(row.mcqGroupBounds);
    const mcqButtonsSeparated =
      row.mcqButtonsSeparated === true || row.mcqButtonsSeparated === "true";
    const mcqGroupLayout =
      row.mcqGroupLayout === "column" || row.mcqGroupLayout === "row"
        ? row.mcqGroupLayout
        : undefined;
    const mcqButtonSizePct = Number(row.mcqButtonSizePct);
    const question = cleanText(row.question, 12_000);
    const optionsRaw = Array.isArray(row.options) ? row.options : [];
    const options = optionsRaw
      .slice(0, 4)
      .map((o) => cleanText(o, 4000))
      .filter(Boolean);
    const stimulusImageUrl = cleanText(row.stimulusImageUrl, MAX_MCQ_STIMULUS_DATA_URL_CHARS + 20);
    const stimulusErr = stimulusImageUrl ? validateMcqStimulusImageUrl(stimulusImageUrl) : null;
    if (stimulusErr) continue;
    const stimulusCrop = parseCropRect(row.stimulusCrop);
    const showStimulus =
      row.showStimulus === false || row.showStimulus === "false" ? false : undefined;
    out.push({
      id,
      questionNumber,
      ...(pageNumber > 0 ? { pageNumber } : {}),
      ...(question ? { question } : {}),
      ...(options.length === 4 ? { options } : {}),
      ...(stimulusImageUrl ? { stimulusImageUrl } : {}),
      ...(stimulusCrop ? { stimulusCrop } : {}),
      ...(showStimulus === false ? { showStimulus: false } : {}),
      ...(optionOverlays ? { optionOverlays } : {}),
      ...(mcqGroupBounds ? { mcqGroupBounds } : {}),
      ...(mcqButtonsSeparated ? { mcqButtonsSeparated: true } : {}),
      ...(mcqGroupLayout ? { mcqGroupLayout } : {}),
      ...(Number.isFinite(mcqButtonSizePct) &&
      mcqButtonSizePct >= 0.5 &&
      mcqButtonSizePct <= 12
        ? { mcqButtonSizePct }
        : {}),
      acceptedAnswer,
      marks: row.marks != null ? Math.max(1, Math.round(Number(row.marks))) : 1,
    });
  }
  out.sort((a, b) => a.questionNumber - b.questionNumber);
  return out.slice(0, 60);
}

function parsePracticeExamSlots(value: unknown): PracticeExamSlotRow[] {
  if (!Array.isArray(value)) return [];
  const out: PracticeExamSlotRow[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const id = cleanText(row.id, 80);
    const pageNumber = Math.round(Number(row.pageNumber));
    const key = cleanText(row.key, 40);
    const acceptedAnswer = cleanText(row.acceptedAnswer, 500);
    const overlayX = Number(row.overlayX);
    const overlayY = Number(row.overlayY);
    const overlayW = Number(row.overlayW);
    const overlayH = Number(row.overlayH);
    if (!id || !pageNumber || pageNumber < 1 || !key) continue;
    if (![overlayX, overlayY, overlayW, overlayH].every((n) => Number.isFinite(n))) continue;
    out.push({
      id,
      pageNumber,
      key,
      label: row.label ? cleanText(row.label, 200) : undefined,
      acceptedAnswer,
      marks: row.marks != null ? Math.max(1, Math.round(Number(row.marks))) : 1,
      overlayX: Math.min(100, Math.max(0, overlayX)),
      overlayY: Math.min(100, Math.max(0, overlayY)),
      overlayW: Math.min(100, Math.max(1, overlayW)),
      overlayH: Math.min(100, Math.max(1, overlayH)),
      ...(row.transparentInput === true || row.transparentInput === 1
        ? { transparentInput: true }
        : {}),
    });
  }
  return out.slice(0, 500);
}

async function upsertPracticeExamRow(
  db: ReturnType<typeof createDb>,
  subjectId: string,
  year: number,
  examNumber: number,
): Promise<number> {
  const sid = canonicalSubjectId(subjectId);
  const examNum = Math.round(Number(examNumber)) === 2 ? 2 : 1;
  const now = nowIso();
  const existing = await db.execute(sql`
    SELECT id FROM practice_exams
    WHERE subject_id = ${sid} AND year = ${year} AND exam_number = ${examNum}
    LIMIT 1
  `);
  const row = (existing.rows as Record<string, unknown>[])[0];
  if (row?.id != null) return Number(row.id);
  const inserted = await db.execute(sql`
    INSERT INTO practice_exams (subject_id, year, exam_number, slots_json, published, created_at, updated_at)
    VALUES (${sid}, ${year}, ${examNum}, '[]', 0, ${now}, ${now})
    RETURNING id
  `);
  return Number((inserted.rows as Record<string, unknown>[])[0]?.id);
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

const COMMON_EMAIL_DOMAIN_TYPOS: Record<string, string> = {
  "gmai.com": "gmail.com",
  "gamil.com": "gmail.com",
  "gmial.com": "gmail.com",
  "gmail.co": "gmail.com",
  "hotmal.com": "hotmail.com",
  "hotmai.com": "hotmail.com",
  "outlok.com": "outlook.com",
  "outloo.com": "outlook.com",
  "yahooo.com": "yahoo.com",
};

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  "10minutemail.com",
  "example.com",
  "example.net",
  "example.org",
  "guerrillamail.com",
  "mailinator.com",
  "temp-mail.org",
  "tempmail.com",
]);

function signupEmailDomainError(rawEmail: string): string | null {
  const email = String(rawEmail ?? "").trim().toLowerCase();
  const at = email.lastIndexOf("@");
  if (at <= 0 || at !== email.indexOf("@")) return "Please enter a valid email address.";
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  if (
    local.length > 64 ||
    local.startsWith(".") ||
    local.endsWith(".") ||
    local.includes("..") ||
    !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local)
  ) {
    return "Please enter a valid email address.";
  }
  const suggestedDomain = COMMON_EMAIL_DOMAIN_TYPOS[domain];
  if (suggestedDomain) return `Check the email domain — did you mean ${suggestedDomain}?`;
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return "Use a permanent email address from your school or email provider.";
  }
  const labels = domain.split(".");
  const validLabels =
    domain.length <= 253 &&
    labels.length >= 2 &&
    labels.every(
      (label) =>
        label.length > 0 &&
        label.length <= 63 &&
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/i.test(label),
    );
  const tld = labels[labels.length - 1] ?? "";
  if (!validLabels || !/^(?:[a-z]{2,63}|xn--[a-z0-9-]{2,59})$/i.test(tld)) {
    return "Enter an email with a real domain, like name@gmail.com.";
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

async function sendHtmlEmail(
  env: Env,
  to: string,
  subject: string,
  html: string,
  logTag = "email",
): Promise<boolean> {
  const apiKey = String(env.RESEND_API_KEY || "").trim();
  const from = String(env.EMAIL_FROM || "Nodent <onboarding@resend.dev>").trim();

  if (!apiKey) {
    console.warn(`[${logTag}] RESEND_API_KEY is not set — trying MailChannels fallback`);
  }

  if (apiKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to: [to], subject, html }),
    });
    if (res.ok) return true;
    console.error(`[${logTag}] Resend error:`, await res.text());
  }

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
      console.error(`[${logTag}] MailChannels error:`, await res2.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[${logTag}] MailChannels exception:`, errorChain(e));
    return false;
  }
}

async function sendPasswordResetEmail(env: Env, to: string, resetUrl: string): Promise<boolean> {
  const html = `<p>Hi,</p><p>We received a request to reset your Nodent password. Click the link below — it expires in 1 hour.</p><p><a href="${resetUrl}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`;
  const ok = await sendHtmlEmail(env, to, "Reset your Nodent password", html, "password-reset");
  if (!ok) console.info("[password-reset] Reset link (email failed):", resetUrl);
  return ok;
}

function signupNotifyEmail(env: Env): string {
  return String(env.SIGNUP_NOTIFY_EMAIL || SIGNUP_NOTIFY_EMAIL_DEFAULT)
    .trim()
    .toLowerCase();
}

async function sendNewSignupNotificationEmail(
  env: Env,
  user: { id: number; username: string; email: string },
): Promise<boolean> {
  const notifyTo = signupNotifyEmail(env);
  if (!notifyTo) return false;
  const createdAt = new Date().toISOString();
  const html = `<p>A new user signed up on Nodent.</p>
<ul>
  <li><strong>Username:</strong> ${escapeHtml(user.username)}</li>
  <li><strong>Email:</strong> ${escapeHtml(user.email)}</li>
  <li><strong>User ID:</strong> ${user.id}</li>
  <li><strong>Signed up at (UTC):</strong> ${escapeHtml(createdAt)}</li>
</ul>`;
  return sendHtmlEmail(
    env,
    notifyTo,
    `New Nodent signup: ${user.username}`,
    html,
    "signup-notify",
  );
}

function isSmokeTestEmail(email: string): boolean {
  return email.toLowerCase().endsWith("@nodent-smoke.test");
}

async function sendWelcomeEmail(
  env: Env,
  requestUrl: string,
  user: { username: string; email: string },
): Promise<boolean> {
  if (isSmokeTestEmail(user.email)) return false;
  const origin = appOrigin(env, requestUrl);
  const feedbackUrl = `${origin}/feedback`;
  const html = `<p>Hi ${escapeHtml(user.username)},</p>
<p>Thank you for signing up to Nodent — we really appreciate you being here.</p>
<p>We built Nodent for students who are tired of waiting for results to find out where they stand. Our vision is a competitive VCE revision platform that shows your level before SACs and exams, so you can revise with purpose and walk into assessments with confidence.</p>
<p>We would love to hear how your first experience goes. Share quick feedback here:</p>
<p><a href="${feedbackUrl}">Tell us what you think</a></p>
<p>See you on the leaderboard,<br/>The Nodent team</p>`;
  return sendHtmlEmail(
    env,
    user.email,
    "Welcome to Nodent",
    html,
    "welcome-email",
  );
}

async function sendFeedbackNotificationEmail(
  env: Env,
  author: { id?: number | null; name: string; email?: string | null },
  message: string,
  rating: number | null,
  extras?: { vceStudent?: string | null; featuresStandOut?: string | null },
): Promise<boolean> {
  const notifyTo = signupNotifyEmail(env);
  if (!notifyTo) return false;
  const ratingLine =
    rating != null && rating >= 1 && rating <= 5
      ? `<li><strong>Rating:</strong> ${rating}/5</li>`
      : "";
  const vceLine = extras?.vceStudent
    ? `<li><strong>VCE student:</strong> ${escapeHtml(extras.vceStudent)}</li>`
    : "";
  const featuresLine = extras?.featuresStandOut
    ? `<li><strong>Features that stand out:</strong> ${escapeHtml(extras.featuresStandOut).replace(/\n/g, "<br/>")}</li>`
    : "";
  const userIdLine =
    author.id != null ? `<li><strong>User ID:</strong> ${author.id}</li>` : "";
  const emailLine = author.email
    ? `<li><strong>Email:</strong> ${escapeHtml(author.email)}</li>`
    : "";
  const html = `<p>New feedback from a Nodent user.</p>
<ul>
  <li><strong>Name:</strong> ${escapeHtml(author.name)}</li>
  ${emailLine}
  ${userIdLine}
  ${ratingLine}
  ${vceLine}
</ul>
${featuresLine ? `<p>${featuresLine}</p>` : ""}
<p><strong>Feedback:</strong></p>
<p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>`;
  return sendHtmlEmail(
    env,
    notifyTo,
    `Nodent feedback from ${author.name}`,
    html,
    "feedback-notify",
  );
}

function escapeHtml(raw: string): string {
  return String(raw ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
      userFeedback,
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
  /** Inbox for new-signup alerts (defaults to ua99026@gmail.com). */
  SIGNUP_NOTIFY_EMAIL?: string;
  /** Google Sheets (optional) — use plain text var + encrypted secret for JSON */
  GOOGLE_SHEETS_SPREADSHEET_ID?: string;
  GOOGLE_SHEETS_TAB_NAME?: string;
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;
  GOOGLE_SHEETS_SUBJECT_FROM_TAB?: string;
  /** Google Gemini + xAI Grok — long-answer marking, English scoring, handwriting */
  GEMINI_API_KEY?: string;
  GEMINI_API_KEY_2?: string;
  GROQ_API_KEY?: string;
  GROQ_API_KEY_1?: string;
  GROQ_API_KEY_2?: string;
  GEMINI_MODEL?: string;
  GEMINI_ENGLISH_MODEL?: string;
  GEMINI_VISION_MODEL?: string;
  GROQ_MODEL?: string;
  /** OpenAI — English essay marking only (gpt-4o-mini by default) */
  OPENAI_API_KEY?: string;
  OPENAI_ENGLISH_MODEL?: string;
  OPENAI_INPUT_USD_PER_MILLION?: string;
  OPENAI_CACHED_INPUT_USD_PER_MILLION?: string;
  OPENAI_OUTPUT_USD_PER_MILLION?: string;
  AI_DISABLE_LIVE_CALLS?: string;
  AI_DAILY_USER_REQUEST_LIMIT?: string;
  AI_DAILY_APP_REQUEST_LIMIT?: string;
  AI_SPEND_WARNING_PERCENT?: string;
  OPENAI_DAILY_USER_USD_LIMIT?: string;
  OPENAI_DAILY_APP_USD_LIMIT?: string;
  OPENAI_ENGLISH_MAX_REQUEST_USD?: string;
  AI_REQUEST_TIMEOUT_MS?: string;
};
type AccountRole = "student" | "teacher";

type Vars = {
  user: {
    id: number;
    email: string;
    username: string;
    token: string;
    profilePhoto?: string | null;
    accountRole?: AccountRole | null;
    onboardingCompletedAt?: string | null;
    isVceStudent?: boolean | null;
    plan?: string | null;
    premiumUntil?: string | null;
  };
  db: ReturnType<typeof createDb>;
};

const app = new Hono<{ Bindings: Env; Variables: Vars }>();

app.onError((err: unknown, c) => {
  const msg = err instanceof Error ? err.stack || err.message : String(err);
  console.error("[onError]", msg);
  // Ensure we always return a response in local dev (Wrangler otherwise shows “No response!”)
  return c.json({ ok: false, error: msg }, 500);
});

// Minimal endpoint for debugging local dev runtime (no DB required).
app.get("/api/ping", (c) => c.json({ ok: true }));
let englishResponsesSchemaPatched = false;
let usersTablePatched = false;
let usersAccountRolePatched = false;
let performanceIndexesPatched = false;
let studyTablesPatched = false;
let classTablesPatched = false;
let coreTablesPatched = false;
let uniqueStemIndexPatched = false;
let markBreakdownPatched = false;
let onboardingPatched = false;
let premiumPatched = false;
let lastSessionCleanupAt = 0;
/** One migration at a time — parallel requests must not each run ensureCoreTables. */
let dbInitPromise: Promise<void> | null = null;

const DB_INIT_TIMEOUT_MS = 45_000;

async function isDatabaseProvisioned(db: ReturnType<typeof createDb>): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT 1 AS ok
      FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'users'
      LIMIT 1
    `);
    const rows = Array.isArray(result) ? result : (result.rows ?? []);
    return rows.length > 0;
  } catch {
    return false;
  }
}

async function runDbMigrations(db: ReturnType<typeof createDb>): Promise<void> {
  if (!coreTablesPatched) {
    try {
      const provisioned = await isDatabaseProvisioned(db);
      if (!provisioned) {
        await ensureCoreTables(db);
      }
    } catch {
      try {
        await ensureCoreTables(db);
      } catch {
        /* ignore */
      }
    } finally {
      coreTablesPatched = true;
    }
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
      /* ignore */
    } finally {
      usersTablePatched = true;
    }
  }
  if (!usersAccountRolePatched) {
    try {
      await db.execute(sql`
        ALTER TABLE users
        ADD COLUMN IF NOT EXISTS account_role text
      `);
    } catch {
      /* ignore */
    } finally {
      usersAccountRolePatched = true;
    }
  }
  if (!englishResponsesSchemaPatched) {
    try {
      await db.execute(sql`
        ALTER TABLE english_responses
        DROP CONSTRAINT IF EXISTS english_responses_prompt_user_unique
      `);
      await db.execute(sql`
        ALTER TABLE english_responses
        ALTER COLUMN prompt_id DROP NOT NULL
      `);
      await db.execute(sql`
        ALTER TABLE english_responses ADD COLUMN IF NOT EXISTS ai_score integer
      `);
      await db.execute(sql`
        ALTER TABLE english_responses ADD COLUMN IF NOT EXISTS ai_feedback text
      `);
      await db.execute(sql`
        ALTER TABLE english_responses ADD COLUMN IF NOT EXISTS ai_scored_at text
      `);
      await db.execute(sql`
        ALTER TABLE english_responses ADD COLUMN IF NOT EXISTS custom_prompt_text text
      `);
      await db.execute(sql`
        ALTER TABLE english_responses ADD COLUMN IF NOT EXISTS ai_criteria_json text
      `);
      await db.execute(sql`
        ALTER TABLE english_responses ADD COLUMN IF NOT EXISTS ai_highlights_json text
      `);
      await db.execute(sql`
        ALTER TABLE english_responses ADD COLUMN IF NOT EXISTS ai_scoring_status text
      `);
      await db.execute(sql`
        ALTER TABLE english_responses ADD COLUMN IF NOT EXISTS ai_scoring_error text
      `);
      await db.execute(sql`
        ALTER TABLE english_responses ADD COLUMN IF NOT EXISTS ai_scoring_started_at text
      `);
      await db.execute(sql`
        ALTER TABLE english_responses ADD COLUMN IF NOT EXISTS is_public integer NOT NULL DEFAULT 0
      `);
      englishResponsesSchemaPatched = true;
    } catch (error) {
      console.error("[english responses schema patch]", errorChain(error));
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
      /* ignore */
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
      /* ignore */
    } finally {
      studyTablesPatched = true;
    }
  }
  if (!classTablesPatched) {
    try {
      await ensureClassTables(db);
    } catch {
      /* ignore */
    } finally {
      classTablesPatched = true;
    }
  }
  if (!premiumPatched) {
    try {
      await db.execute(sql`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free'
      `);
      await db.execute(sql`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS premium_until text
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS user_usage_events (
          id serial PRIMARY KEY,
          user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
          kind text NOT NULL,
          ref_key text,
          created_at text NOT NULL
        )
      `);
      await db.execute(sql`
        CREATE INDEX IF NOT EXISTS user_usage_events_user_kind_idx
        ON user_usage_events (user_id, kind, created_at)
      `);
    } catch {
      /* ignore */
    } finally {
      premiumPatched = true;
    }
  }
  if (!onboardingPatched) {
    try {
      await db.execute(sql`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed_at text
      `);
      await db.execute(sql`
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_vce_student integer
      `);
      await db.execute(sql`
        ALTER TABLE user_subjects ADD COLUMN IF NOT EXISTS confidence_rank integer
      `);
      await db.execute(sql`
        UPDATE users
        SET onboarding_completed_at = created_at
        WHERE onboarding_completed_at IS NULL
          AND id IN (SELECT DISTINCT user_id FROM user_subjects)
      `);
    } catch {
      /* ignore */
    } finally {
      onboardingPatched = true;
    }
  }
  if (!markBreakdownPatched) {
    try {
      await db.execute(sql`
        ALTER TABLE custom_questions ADD COLUMN IF NOT EXISTS mark_breakdown_json text
      `);
      await db.execute(sql`
        CREATE TABLE IF NOT EXISTS subject_marking_context (
          subject_id text PRIMARY KEY,
          prompt_text text NOT NULL DEFAULT '',
          resources_json text NOT NULL DEFAULT '[]',
          updated_at text NOT NULL
        )
      `);
    } catch {
      /* ignore */
    } finally {
      markBreakdownPatched = true;
    }
  }
  if (!uniqueStemIndexPatched) {
    try {
      await db.execute(sql`
        CREATE UNIQUE INDEX IF NOT EXISTS custom_questions_subject_stem_unique
        ON custom_questions (
          LOWER(TRIM(subject_id)),
          LOWER(REGEXP_REPLACE(TRIM(question), '\\s+', ' ', 'g'))
        )
      `);
    } catch {
      /* duplicates may still exist — run scripts/dedupe-custom-questions.mjs --apply */
    } finally {
      uniqueStemIndexPatched = true;
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
      /* ignore */
    } finally {
      lastSessionCleanupAt = nowMs;
    }
  }
}

function ensureDbReady(db: ReturnType<typeof createDb>): Promise<void> {
  if (!dbInitPromise) {
    dbInitPromise = runDbMigrations(db).catch((err) => {
      dbInitPromise = null;
      throw err;
    });
  }
  return dbInitPromise;
}

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
    ALTER TABLE custom_questions ADD COLUMN IF NOT EXISTS answer_parts_json text
  `);
  await db.execute(sql`
    ALTER TABLE custom_questions ADD COLUMN IF NOT EXISTS answer_image_urls text
  `);
  await db.execute(sql`
    ALTER TABLE custom_questions ADD COLUMN IF NOT EXISTS ai_marking_enabled integer
  `);
  await db.execute(sql`
    ALTER TABLE custom_questions ADD COLUMN IF NOT EXISTS mark_breakdown_json text
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS subject_marking_context (
      subject_id text PRIMARY KEY,
      prompt_text text NOT NULL DEFAULT '',
      resources_json text NOT NULL DEFAULT '[]',
      updated_at text NOT NULL
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
    ALTER TABLE english_responses ADD COLUMN IF NOT EXISTS ai_score integer
  `);
  await db.execute(sql`
    ALTER TABLE english_responses ADD COLUMN IF NOT EXISTS ai_feedback text
  `);
  await db.execute(sql`
    ALTER TABLE english_responses ADD COLUMN IF NOT EXISTS ai_scored_at text
  `);
  await db.execute(sql`
    ALTER TABLE english_responses ADD COLUMN IF NOT EXISTS custom_prompt_text text
  `);
  await db.execute(sql`
    ALTER TABLE english_responses ADD COLUMN IF NOT EXISTS ai_criteria_json text
  `);
  await db.execute(sql`
    ALTER TABLE english_responses ADD COLUMN IF NOT EXISTS ai_highlights_json text
  `);
  await db.execute(sql`
    ALTER TABLE english_responses ADD COLUMN IF NOT EXISTS ai_scoring_status text
  `);
  await db.execute(sql`
    ALTER TABLE english_responses ADD COLUMN IF NOT EXISTS ai_scoring_error text
  `);
  await db.execute(sql`
    ALTER TABLE english_responses ADD COLUMN IF NOT EXISTS ai_scoring_started_at text
  `);
  await db.execute(sql`
    ALTER TABLE english_responses ADD COLUMN IF NOT EXISTS is_public integer NOT NULL DEFAULT 0
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS english_responses_public_scored_idx
    ON english_responses (is_public, ai_scored_at, updated_at)
  `);
  await db.execute(sql`
    ALTER TABLE english_responses ALTER COLUMN prompt_id DROP NOT NULL
  `);
  await db.execute(sql`
    ALTER TABLE written_responses ADD COLUMN IF NOT EXISTS ai_correct integer
  `);
  await db.execute(sql`
    ALTER TABLE written_responses ADD COLUMN IF NOT EXISTS ai_score_percent integer
  `);
  await db.execute(sql`
    ALTER TABLE written_responses ADD COLUMN IF NOT EXISTS ai_feedback text
  `);
  await db.execute(sql`
    ALTER TABLE written_responses ADD COLUMN IF NOT EXISTS ai_marked_at text
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
      marks_earned integer,
      is_correct integer NOT NULL,
      answered_at text NOT NULL
    )
  `);
  await db.execute(sql`
    ALTER TABLE question_attempts ADD COLUMN IF NOT EXISTS marks_earned integer
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS question_attempts_user_subject_question_idx
    ON question_attempts (user_id, subject_id, question_key)
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
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS user_feedback (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      message text NOT NULL,
      rating integer,
      created_at text NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS user_feedback_user_idx ON user_feedback (user_id, created_at DESC)
  `);
  await db.execute(sql`
    ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS author_name text
  `);
  await db.execute(sql`
    ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS author_email text
  `);
  await db.execute(sql`
    ALTER TABLE user_feedback ALTER COLUMN user_id DROP NOT NULL
  `);
  await db.execute(sql`
    ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS vce_student text
  `);
  await db.execute(sql`
    ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS features_stand_out text
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS phone_upload_sessions (
      token text PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      purpose text NOT NULL DEFAULT 'create',
      subject_id text,
      question_key text,
      pending_images text NOT NULL DEFAULT '[]',
      created_at text NOT NULL,
      expires_at text NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS phone_upload_sessions_user_idx
    ON phone_upload_sessions (user_id, created_at DESC)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS phone_upload_sessions_expires_idx
    ON phone_upload_sessions (expires_at)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS practice_exams (
      id serial PRIMARY KEY,
      subject_id text NOT NULL,
      year integer NOT NULL,
      slots_json text NOT NULL DEFAULT '[]',
      published integer NOT NULL DEFAULT 0,
      created_at text NOT NULL,
      updated_at text NOT NULL,
      UNIQUE(subject_id, year)
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS practice_exams_subject_idx
    ON practice_exams (subject_id, year DESC)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS practice_exam_pages (
      exam_id integer NOT NULL REFERENCES practice_exams (id) ON DELETE CASCADE,
      page_number integer NOT NULL,
      image_data_url text NOT NULL,
      PRIMARY KEY (exam_id, page_number)
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS teacher_classes (
      id serial PRIMARY KEY,
      teacher_id integer NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
      join_code text NOT NULL UNIQUE,
      class_name text NOT NULL DEFAULT 'My class',
      created_at text NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS class_members (
      class_id integer NOT NULL REFERENCES teacher_classes (id) ON DELETE CASCADE,
      user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      joined_at text NOT NULL,
      PRIMARY KEY (class_id, user_id)
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS class_members_user_idx
    ON class_members (user_id)
  `);
}

async function ensureClassTables(db: ReturnType<typeof createDb>) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS teacher_classes (
      id serial PRIMARY KEY,
      teacher_id integer NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
      join_code text NOT NULL UNIQUE,
      class_name text NOT NULL DEFAULT 'My class',
      created_at text NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS class_members (
      class_id integer NOT NULL REFERENCES teacher_classes (id) ON DELETE CASCADE,
      user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      joined_at text NOT NULL,
      PRIMARY KEY (class_id, user_id)
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS class_members_user_idx
    ON class_members (user_id)
  `);
}

async function ensurePracticeExamTables(db: ReturnType<typeof createDb>) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS practice_exams (
      id serial PRIMARY KEY,
      subject_id text NOT NULL,
      year integer NOT NULL,
      slots_json text NOT NULL DEFAULT '[]',
      published integer NOT NULL DEFAULT 0,
      created_at text NOT NULL,
      updated_at text NOT NULL,
      UNIQUE(subject_id, year)
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS practice_exams_subject_idx
    ON practice_exams (subject_id, year DESC)
  `);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS practice_exam_pages (
      exam_id integer NOT NULL REFERENCES practice_exams (id) ON DELETE CASCADE,
      page_number integer NOT NULL,
      image_data_url text NOT NULL,
      PRIMARY KEY (exam_id, page_number)
    )
  `);
  await db.execute(sql`
    ALTER TABLE practice_exams ADD COLUMN IF NOT EXISTS transparent_inputs integer NOT NULL DEFAULT 0
  `);
  await db.execute(sql`
    ALTER TABLE practice_exams ADD COLUMN IF NOT EXISTS exam_number integer NOT NULL DEFAULT 1
  `);
  await db.execute(sql`
    ALTER TABLE practice_exams ADD COLUMN IF NOT EXISTS layout text NOT NULL DEFAULT 'written'
  `);
  await db.execute(sql`
    ALTER TABLE practice_exams ADD COLUMN IF NOT EXISTS mcq_count integer NOT NULL DEFAULT 0
  `);
  await db.execute(sql`
    ALTER TABLE practice_exams ADD COLUMN IF NOT EXISTS mcq_json text NOT NULL DEFAULT '[]'
  `);
  await db.execute(sql`
    ALTER TABLE practice_exams DROP CONSTRAINT IF EXISTS practice_exams_subject_id_year_key
  `);
  await db.execute(sql`
    CREATE UNIQUE INDEX IF NOT EXISTS practice_exams_subject_year_exam_idx
    ON practice_exams (subject_id, year, exam_number)
  `);
}

async function ensurePhoneUploadSessionsTable(db: ReturnType<typeof createDb>) {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS phone_upload_sessions (
      token text PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users (id) ON DELETE CASCADE,
      purpose text NOT NULL DEFAULT 'create',
      subject_id text,
      question_key text,
      pending_images text NOT NULL DEFAULT '[]',
      created_at text NOT NULL,
      expires_at text NOT NULL
    )
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS phone_upload_sessions_user_idx
    ON phone_upload_sessions (user_id, created_at DESC)
  `);
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS phone_upload_sessions_expires_idx
    ON phone_upload_sessions (expires_at)
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
    if (/^https:\/\/([a-z0-9-]+\.)?nodentlearning\.com$/i.test(origin)) return origin;
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
  const dbUrl = String(c.env.DATABASE_URL ?? "").trim();
  if (!dbUrl) {
    return c.json(
      {
        error:
          "DATABASE_URL is not configured. Add it to .dev.vars in the project root, then restart the API.",
      },
      503,
    );
  }

  const db = createDb(dbUrl);
  c.set("db", db);

  try {
    await Promise.race([
      ensureDbReady(db),
      new Promise<never>((_, reject) => {
        setTimeout(
          () =>
            reject(
              new Error(
                "Database connection timed out. Check DATABASE_URL in .dev.vars and your network.",
              ),
            ),
          DB_INIT_TIMEOUT_MS,
        );
      }),
    ]);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[db middleware]", msg);
    return c.json({ error: msg }, 503);
  }

  await next();
});

// Auth middleware helper
async function authMiddleware(c: any, next: any) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return c.json({ error: "Authentication required." }, 401);
  const token = authHeader.slice(7);
  const db = c.get("db");
  let row: any = null;
  try {
    const q = await db.execute(sql`
      SELECT
        u.id AS user_id,
        u.email AS email,
        u.username AS username,
        u.profile_photo AS profile_photo,
        u.account_role AS account_role,
        u.onboarding_completed_at AS onboarding_completed_at,
        u.is_vce_student AS is_vce_student,
        u.plan AS plan,
        u.premium_until AS premium_until,
        s.expires_at AS expires_at
      FROM sessions s
      INNER JOIN users u ON s.user_id = u.id
      WHERE s.token = ${token}
      LIMIT 1
    `);
    row = (q.rows as any[] | undefined)?.[0] ?? null;
  } catch (e) {
    console.error("[authMiddleware] session lookup failed", errorChain(e));
    // Treat as unauthenticated instead of 500s cascading through the app.
    return c.json({ error: "Authentication required." }, 401);
  }
  if (!row) return c.json({ error: "Invalid session." }, 401);
  if (new Date(String(row.expires_at)) < new Date()) {
    await db.execute(sql`DELETE FROM sessions WHERE token = ${token}`);
    return c.json({ error: "Session expired." }, 401);
  }
  c.set("user", {
    id: Number(row.user_id),
    email: String(row.email ?? ""),
    username: String(row.username ?? ""),
    profilePhoto: row.profile_photo ?? null,
    accountRole: normalizeAccountRole(row.account_role),
    onboardingCompletedAt: row.onboarding_completed_at ?? null,
    isVceStudent:
      row.is_vce_student === 1
        ? true
        : row.is_vce_student === 0
          ? false
          : null,
    plan: row.plan ?? "free",
    premiumUntil: row.premium_until ?? null,
    token,
  });
  await next();
}

async function resolveOptionalUser(
  c: any,
): Promise<{ id: number; email: string; username: string } | null> {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  const db = c.get("db");
  let row: any = null;
  try {
    const q = await db.execute(sql`
      SELECT u.id AS user_id, u.email AS email, u.username AS username, s.expires_at AS expires_at
      FROM sessions s
      INNER JOIN users u ON s.user_id = u.id
      WHERE s.token = ${token}
      LIMIT 1
    `);
    row = (q.rows as any[] | undefined)?.[0] ?? null;
  } catch (e) {
    console.error("[resolveOptionalUser] session lookup failed", errorChain(e));
    return null;
  }
  if (!row) return null;
  if (new Date(String(row.expires_at)) < new Date()) {
    await db.execute(sql`DELETE FROM sessions WHERE token = ${token}`);
    return null;
  }
  return {
    id: Number(row.user_id),
    email: String(row.email ?? ""),
    username: String(row.username ?? ""),
  };
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
  let row: any = null;
  try {
    const q = await db.execute(sql`
      SELECT u.id AS user_id, u.email AS email, u.username AS username, s.expires_at AS expires_at
      FROM sessions s
      INNER JOIN users u ON s.user_id = u.id
      WHERE s.token = ${token}
      LIMIT 1
    `);
    row = (q.rows as any[] | undefined)?.[0] ?? null;
  } catch (e) {
    console.error("[adminAccessMiddleware] session lookup failed", errorChain(e));
    return c.json({ error: "Admin access denied." }, 403);
  }
  if (!row) return c.json({ error: "Invalid session." }, 401);
  if (new Date(String(row.expires_at)) < new Date()) {
    await db.execute(sql`DELETE FROM sessions WHERE token = ${token}`);
    return c.json({ error: "Session expired." }, 401);
  }
  const email = String(row.email || "").toLowerCase();
  if (email !== ADMIN_EMAIL_LC) {
    return c.json({ error: "Admin access denied." }, 403);
  }
  c.set("user", {
    id: Number(row.user_id),
    email: String(row.email ?? ""),
    username: String(row.username ?? ""),
    token,
  });
  await next();
}

const TEACHER_JOIN_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomTeacherJoinCode(length = 6): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += TEACHER_JOIN_CODE_CHARS[Math.floor(Math.random() * TEACHER_JOIN_CODE_CHARS.length)]!;
  }
  return out;
}

async function ensureUniqueJoinCode(db: any): Promise<string> {
  for (let attempt = 0; attempt < 24; attempt++) {
    const code = randomTeacherJoinCode(attempt > 12 ? 8 : 6);
    const existing = await db.execute(sql`
      SELECT 1 FROM teacher_classes WHERE join_code = ${code} LIMIT 1
    `);
    if (!(existing.rows as any[]).length) return code;
  }
  return `${randomTeacherJoinCode(4)}${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

function normalizeAccountRole(raw: unknown): AccountRole | null {
  const value = String(raw ?? "").trim().toLowerCase();
  if (value === "student" || value === "teacher") return value;
  return null;
}

function isAdminEmail(email: unknown): boolean {
  return String(email ?? "").trim().toLowerCase() === ADMIN_EMAIL_LC;
}

function publicUserPayload(row: {
  id: number;
  username?: string | null;
  email: string;
  profilePhoto?: string | null;
  accountRole?: string | null;
  onboardingCompletedAt?: string | null;
  isVceStudent?: number | boolean | null;
  plan?: string | null;
  premiumUntil?: string | null;
}) {
  const email = String(row.email ?? "");
  const accountRole = normalizeAccountRole(row.accountRole);
  const isVceRaw = row.isVceStudent;
  const isVceStudent =
    isVceRaw === true || isVceRaw === 1
      ? true
      : isVceRaw === false || isVceRaw === 0
        ? false
        : null;
  const plan = String(row.plan ?? "free").trim() || "free";
  const premiumUntil = row.premiumUntil ?? null;
  const premium = isPremiumAccount({ id: row.id, email, plan, premiumUntil });
  return {
    id: row.id,
    username: row.username || email,
    email,
    profilePhoto: row.profilePhoto ?? null,
    accountRole: isAdminEmail(email) ? null : accountRole,
    onboardingCompletedAt: row.onboardingCompletedAt ?? null,
    isVceStudent,
    plan,
    premiumUntil,
    isPremium: premium,
  };
}

function isTeacherAccount(user: {
  email?: string | null;
  accountRole?: string | null;
}): boolean {
  if (isAdminEmail(user?.email)) return true;
  return normalizeAccountRole(user?.accountRole) === "teacher";
}

function teacherAccessDenied(c: any): Response | null {
  const user = c.get("user");
  if (!isTeacherAccount(user)) {
    return c.json({ error: "Teacher access denied." }, 403);
  }
  return null;
}

async function getOrCreateTeacherClassRow(db: any, teacherId: number) {
  const existing = await db.execute(sql`
    SELECT id, join_code, class_name, created_at
    FROM teacher_classes
    WHERE teacher_id = ${teacherId}
    LIMIT 1
  `);
  if ((existing.rows as any[]).length) {
    return (existing.rows as any[])[0] as {
      id: number;
      join_code: string;
      class_name: string;
      created_at: string;
    };
  }
  const joinCode = await ensureUniqueJoinCode(db);
  const createdAt = nowIso();
  const inserted = await db.execute(sql`
    INSERT INTO teacher_classes (teacher_id, join_code, class_name, created_at)
    VALUES (${teacherId}, ${joinCode}, 'My class', ${createdAt})
    ON CONFLICT (teacher_id) DO UPDATE SET class_name = teacher_classes.class_name
    RETURNING id, join_code, class_name, created_at
  `);
  if ((inserted.rows as any[]).length) {
    return (inserted.rows as any[])[0] as {
      id: number;
      join_code: string;
      class_name: string;
      created_at: string;
    };
  }
  const again = await db.execute(sql`
    SELECT id, join_code, class_name, created_at
    FROM teacher_classes
    WHERE teacher_id = ${teacherId}
    LIMIT 1
  `);
  return (again.rows as any[])[0] as {
    id: number;
    join_code: string;
    class_name: string;
    created_at: string;
  };
}

async function getClassMemberIds(db: any, classId: number): Promise<number[]> {
  const rows = await db.execute(sql`
    SELECT user_id FROM class_members WHERE class_id = ${classId}
  `);
  return (rows.rows as any[]).map((r) => Number(r.user_id)).filter((id) => id > 0);
}

function pctFromMarks(correct: number, attempted: number): number {
  if (attempted <= 0) return 0;
  return Math.round((correct / attempted) * 100);
}

function topicStatKey(subjectId: string, topic: string): string {
  return `${String(subjectId)}::${String(topic)}`;
}

async function loadPlatformTopicBenchmarks(
  db: any,
  subjectId?: string,
  excludeUserIds?: number[],
) {
  const subjectFilter = subjectId ? sql` AND subject_id = ${subjectId} ` : sql``;
  const excludeFilter =
    excludeUserIds?.length
      ? sql` AND user_id NOT IN (${sqlIntInList(excludeUserIds)}) `
      : sql``;
  const rows = await db.execute(sql`
    SELECT topic, subject_id,
           SUM(COALESCE(marks_earned, CASE WHEN is_correct = 1 THEN marks ELSE 0 END))::int AS marks_correct,
           SUM(marks)::int AS marks_attempted,
           COUNT(DISTINCT user_id)::int AS student_count
    FROM question_attempts
    WHERE 1=1 ${subjectFilter} ${excludeFilter}
    GROUP BY topic, subject_id
    HAVING SUM(marks) > 0
  `);
  const byTopic = new Map<
    string,
    { platformPercent: number; platformMarksAttempted: number; platformStudentCount: number }
  >();
  for (const r of rows.rows as any[]) {
    const mc = Number(r.marks_correct ?? 0);
    const ma = Number(r.marks_attempted ?? 0);
    byTopic.set(
      topicStatKey(String(r.subject_id ?? ""), String(r.topic ?? "General")),
      {
        platformPercent: pctFromMarks(mc, ma),
        platformMarksAttempted: ma,
        platformStudentCount: Number(r.student_count ?? 0),
      },
    );
  }
  return byTopic;
}

async function loadTopicUserPercents(db: any, subjectId?: string) {
  const subjectFilter = subjectId ? sql` AND subject_id = ${subjectId} ` : sql``;
  const rows = await db.execute(sql`
    SELECT user_id, topic, subject_id,
           SUM(COALESCE(marks_earned, CASE WHEN is_correct = 1 THEN marks ELSE 0 END))::int AS marks_correct,
           SUM(marks)::int AS marks_attempted
    FROM question_attempts
    WHERE 1=1 ${subjectFilter}
    GROUP BY user_id, topic, subject_id
    HAVING SUM(marks) > 0
  `);
  const byTopic = new Map<string, { userId: number; pct: number }[]>();
  for (const r of rows.rows as any[]) {
    const key = topicStatKey(String(r.subject_id ?? ""), String(r.topic ?? "General"));
    const mc = Number(r.marks_correct ?? 0);
    const ma = Number(r.marks_attempted ?? 0);
    if (!byTopic.has(key)) byTopic.set(key, []);
    byTopic.get(key)!.push({
      userId: Number(r.user_id),
      pct: pctFromMarks(mc, ma),
    });
  }
  return byTopic;
}

function topicPercentileForUser(
  byTopic: Map<string, { userId: number; pct: number }[]>,
  subjectId: string,
  topic: string,
  userId: number,
): number | null {
  const list = byTopic.get(topicStatKey(subjectId, topic));
  if (!list || list.length < 2) return null;
  const sorted = [...list].sort((a, b) => {
    if (b.pct !== a.pct) return b.pct - a.pct;
    return a.userId - b.userId;
  });
  const idx = sorted.findIndex((x) => x.userId === userId);
  if (idx < 0) return null;
  return cohortPercentileFromRank(idx + 1, sorted.length);
}

function enrichTopicRow(
  row: {
    topic: string;
    subjectId: string;
    marksCorrect: number;
    marksAttempted: number;
    percent: number;
    studentsAttempted?: number;
  },
  platform: Map<
    string,
    { platformPercent: number; platformMarksAttempted: number; platformStudentCount: number }
  >,
  topicPercentile?: number | null,
) {
  const bench = platform.get(topicStatKey(row.subjectId, row.topic));
  const platformPercent = bench?.platformPercent ?? null;
  const vsPlatform = platformPercent != null ? row.percent - platformPercent : null;
  return {
    ...row,
    platformPercent,
    platformMarksAttempted: bench?.platformMarksAttempted ?? 0,
    platformStudentCount: bench?.platformStudentCount ?? 0,
    vsPlatform,
    topicPercentile: topicPercentile ?? null,
  };
}

async function loadPlatformSubjectPercents(db: any) {
  const rows = await db.execute(sql`
    SELECT subject_id,
           COALESCE(SUM(COALESCE(marks_earned, CASE WHEN is_correct = 1 THEN marks ELSE 0 END)), 0)::int AS marks_correct,
           COALESCE(SUM(marks), 0)::int AS marks_attempted
    FROM question_attempts
    GROUP BY subject_id
    HAVING SUM(marks) > 0
  `);
  const map = new Map<string, number>();
  for (const r of rows.rows as any[]) {
    const mc = Number(r.marks_correct ?? 0);
    const ma = Number(r.marks_attempted ?? 0);
    map.set(String(r.subject_id ?? ""), pctFromMarks(mc, ma));
  }
  return map;
}

async function loadPlatformOverallPercent(
  db: any,
  subjectId?: string,
  excludeUserIds?: number[],
): Promise<number | null> {
  const subjectFilter = subjectId ? sql` AND subject_id = ${subjectId} ` : sql``;
  const excludeFilter =
    excludeUserIds?.length
      ? sql` AND user_id NOT IN (${sqlIntInList(excludeUserIds)}) `
      : sql``;
  const rows = await db.execute(sql`
    SELECT
      COALESCE(SUM(COALESCE(marks_earned, CASE WHEN is_correct = 1 THEN marks ELSE 0 END)), 0)::int AS marks_correct,
      COALESCE(SUM(marks), 0)::int AS marks_attempted
    FROM question_attempts
    WHERE 1=1 ${subjectFilter} ${excludeFilter}
  `);
  const mc = Number((rows.rows as any[])[0]?.marks_correct ?? 0);
  const ma = Number((rows.rows as any[])[0]?.marks_attempted ?? 0);
  return ma > 0 ? pctFromMarks(mc, ma) : null;
}

async function studentOverallPercentile(
  db: any,
  studentId: number,
  subjectId?: string,
): Promise<number | null> {
  const subjectFilter = subjectId ? sql` AND subject_id = ${subjectId} ` : sql``;
  const rows = await db.execute(sql`
    SELECT user_id,
           COALESCE(SUM(COALESCE(marks_earned, CASE WHEN is_correct = 1 THEN marks ELSE 0 END)), 0)::int AS marks_correct,
           COALESCE(SUM(marks), 0)::int AS marks_attempted,
           COUNT(*)::int AS attempt_count
    FROM question_attempts
    WHERE 1=1 ${subjectFilter}
    GROUP BY user_id
    HAVING SUM(marks) > 0
  `);
  const eligible = (rows.rows as any[])
    .map((r) => ({
      userId: Number(r.user_id),
      pct: pctFromMarks(Number(r.marks_correct ?? 0), Number(r.marks_attempted ?? 0)),
      attempts: Number(r.attempt_count ?? 0),
    }))
    .filter((r) => r.attempts >= MIN_RANKED_ATTEMPTS);
  if (eligible.length < 2) return null;
  const sorted = [...eligible].sort((a, b) => {
    if (b.pct !== a.pct) return b.pct - a.pct;
    return a.userId - b.userId;
  });
  const idx = sorted.findIndex((x) => x.userId === studentId);
  if (idx < 0) return null;
  return cohortPercentileFromRank(idx + 1, sorted.length);
}

/** Drizzle expands JS arrays as tuples — use IN (...) instead of ANY($n::int[]). */
function sqlIntInList(ids: number[]) {
  if (!ids.length) return sql`-1`;
  return sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  );
}

/** Drizzle expands JS arrays as tuples — use IN (...) for text arrays too. */
function sqlTextInList(values: string[]) {
  if (!values.length) return sql`''`;
  return sql.join(
    values.map((v) => sql`${v}`),
    sql`, `,
  );
}

async function buildClassTopicStats(
  db: any,
  memberIds: number[],
  subjectId?: string,
) {
  if (!memberIds.length) {
    return {
      topicStats: [] as any[],
      weakTopics: [] as any[],
      belowAvgTopics: [] as any[],
      avgPercent: null as number | null,
      platformPercent: null as number | null,
      vsPlatform: null as number | null,
    };
  }

  const subjectFilter = subjectId ? sql` AND qa.subject_id = ${subjectId} ` : sql``;
  const [topicRows, platform, platformPercent] = await Promise.all([
    db.execute(sql`
    SELECT qa.topic,
           qa.subject_id,
           SUM(COALESCE(qa.marks_earned, CASE WHEN qa.is_correct = 1 THEN qa.marks ELSE 0 END))::int AS marks_correct,
           SUM(qa.marks)::int AS marks_attempted,
           COUNT(DISTINCT qa.user_id)::int AS students_attempted
    FROM question_attempts qa
    WHERE qa.user_id IN (${sqlIntInList(memberIds)})
    ${subjectFilter}
    GROUP BY qa.topic, qa.subject_id
    HAVING SUM(qa.marks) > 0
  `),
    loadPlatformTopicBenchmarks(db, subjectId, memberIds),
    loadPlatformOverallPercent(db, subjectId, memberIds),
  ]);

  const topicStats = (topicRows.rows as any[]).map((r) => {
    const marksCorrect = Number(r.marks_correct ?? 0);
    const marksAttempted = Number(r.marks_attempted ?? 0);
    return enrichTopicRow(
      {
        topic: String(r.topic ?? "General"),
        subjectId: String(r.subject_id ?? ""),
        marksCorrect,
        marksAttempted,
        percent: pctFromMarks(marksCorrect, marksAttempted),
        studentsAttempted: Number(r.students_attempted ?? 0),
      },
      platform,
    );
  });

  topicStats.sort((a, b) => a.percent - b.percent || a.topic.localeCompare(b.topic));

  const mapTopicSummary = (t: (typeof topicStats)[number]) => ({
    topic: t.topic,
    subjectId: t.subjectId,
    percent: t.percent,
    marksAttempted: t.marksAttempted,
    platformPercent: t.platformPercent,
    vsPlatform: t.vsPlatform,
    studentsAttempted: t.studentsAttempted,
  });

  const belowAvgTopics = topicStats
    .filter(
      (t) =>
        t.marksAttempted >= 3 &&
        t.platformPercent != null &&
        (t.vsPlatform ?? 0) < 0,
    )
    .sort((a, b) => (a.vsPlatform ?? 0) - (b.vsPlatform ?? 0))
    .slice(0, 12)
    .map(mapTopicSummary);

  const weakTopics = topicStats
    .filter((t) => t.marksAttempted >= 3)
    .slice(0, 8)
    .map(mapTopicSummary);

  const totalCorrect = topicStats.reduce((sum, t) => sum + t.marksCorrect, 0);
  const totalAttempted = topicStats.reduce((sum, t) => sum + t.marksAttempted, 0);
  const avgPercent = totalAttempted > 0 ? pctFromMarks(totalCorrect, totalAttempted) : null;
  const vsPlatform =
    avgPercent != null && platformPercent != null ? avgPercent - platformPercent : null;

  return { topicStats, weakTopics, belowAvgTopics, avgPercent, platformPercent, vsPlatform };
}

async function buildStudentStats(
  db: any,
  studentId: number,
  subjectId?: string,
) {
  const subjectFilter = subjectId ? sql` AND subject_id = ${subjectId} ` : sql``;
  const [totals, topicRows, platform, topicUserPercents, platformPercent, overallPercentile] =
    await Promise.all([
      db.execute(sql`
    SELECT
      COALESCE(SUM(COALESCE(marks_earned, CASE WHEN is_correct = 1 THEN marks ELSE 0 END)), 0)::int AS marks_correct,
      COALESCE(SUM(marks), 0)::int AS marks_attempted,
      COUNT(*)::int AS question_count
    FROM question_attempts
    WHERE user_id = ${studentId}
    ${subjectFilter}
  `),
      db.execute(sql`
    SELECT topic, subject_id,
           SUM(COALESCE(marks_earned, CASE WHEN is_correct = 1 THEN marks ELSE 0 END))::int AS marks_correct,
           SUM(marks)::int AS marks_attempted
    FROM question_attempts
    WHERE user_id = ${studentId}
    ${subjectFilter}
    GROUP BY topic, subject_id
    HAVING SUM(marks) > 0
  `),
      loadPlatformTopicBenchmarks(db, subjectId),
      loadTopicUserPercents(db, subjectId),
      loadPlatformOverallPercent(db, subjectId),
      studentOverallPercentile(db, studentId, subjectId),
    ]);
  const marksCorrect = Number((totals.rows as any[])[0]?.marks_correct ?? 0);
  const marksAttempted = Number((totals.rows as any[])[0]?.marks_attempted ?? 0);
  const questionCount = Number((totals.rows as any[])[0]?.question_count ?? 0);
  const percent = pctFromMarks(marksCorrect, marksAttempted);
  const vsPlatform =
    marksAttempted > 0 && platformPercent != null ? percent - platformPercent : null;

  const topicStats = (topicRows.rows as any[]).map((r) => {
    const mc = Number(r.marks_correct ?? 0);
    const ma = Number(r.marks_attempted ?? 0);
    const subject = String(r.subject_id ?? "");
    const topic = String(r.topic ?? "General");
    return enrichTopicRow(
      {
        topic,
        subjectId: subject,
        marksCorrect: mc,
        marksAttempted: ma,
        percent: pctFromMarks(mc, ma),
      },
      platform,
      topicPercentileForUser(topicUserPercents, subject, topic, studentId),
    );
  });

  topicStats.sort((a, b) => a.percent - b.percent || a.topic.localeCompare(b.topic));

  const weakTopics = topicStats.filter((t) => t.marksAttempted >= 3).slice(0, 8);

  const subjectRows = await db.execute(sql`
    SELECT subject_id,
           SUM(COALESCE(marks_earned, CASE WHEN is_correct = 1 THEN marks ELSE 0 END))::int AS marks_correct,
           SUM(marks)::int AS marks_attempted
    FROM question_attempts
    WHERE user_id = ${studentId}
    GROUP BY subject_id
    HAVING SUM(marks) > 0
    ORDER BY subject_id ASC
  `);

  const platformBySubject = await loadPlatformSubjectPercents(db);

  const subjects = (subjectRows.rows as any[]).map((r) => {
    const mc = Number(r.marks_correct ?? 0);
    const ma = Number(r.marks_attempted ?? 0);
    const sid = String(r.subject_id ?? "");
    const studentPct = pctFromMarks(mc, ma);
    const subPlatform = platformBySubject.get(sid) ?? null;
    return {
      subjectId: sid,
      marksCorrect: mc,
      marksAttempted: ma,
      percent: studentPct,
      platformPercent: subPlatform,
      vsPlatform: subPlatform != null ? studentPct - subPlatform : null,
    };
  });

  return {
    marksCorrect,
    marksAttempted,
    percent,
    questionCount,
    platformPercent,
    vsPlatform,
    overallPercentile,
    topicStats,
    weakTopics,
    subjects,
  };
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
  const emailErr = signupEmailDomainError(email);
  if (emailErr) return c.json({ error: emailErr }, 400);
  const pwErr = passwordPolicyError(password);
  if (pwErr) return c.json({ error: pwErr }, 400);
  const existingEmail = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existingEmail.length > 0) return c.json({ error: "An account with this email already exists." }, 400);
  const existingUsername = await db.select({ id: users.id }).from(users).where(sql`LOWER(${users.username}) = LOWER(${username})`).limit(1);
  if (existingUsername.length > 0) return c.json({ error: "That username is already taken." }, 400);
  const isAdminSignup = isAdminEmail(email);
  const accountRole = isAdminSignup ? null : normalizeAccountRole(body.accountRole);
  if (!isAdminSignup && !accountRole) {
    return c.json({ error: "Please choose whether you are a student or teacher." }, 400);
  }
  const { salt, hash } = await hashPassword(password);
  const result = await db
    .insert(users)
    .values({
      username,
      email,
      passwordHash: hash,
      passwordSalt: salt,
      hashAlgorithm: "pbkdf2",
      accountRole,
      createdAt: nowIso(),
    })
    .returning({ id: users.id });
  const userId = result[0].id;
  const rememberMe = body.rememberMe !== false; // default true for signups
  const token = createToken();
  await db.insert(sessions).values({ token, userId, createdAt: nowIso(), expiresAt: sessionExpiry(rememberMe) });
  try {
    const sent = await sendNewSignupNotificationEmail(c.env, {
      id: userId,
      username,
      email,
    });
    if (sent) {
      console.info("[signup-notify] alert sent to", signupNotifyEmail(c.env));
    } else {
      console.error(
        "[signup-notify] alert not sent — set RESEND_API_KEY (and EMAIL_FROM) in Cloudflare Pages",
      );
    }
  } catch (e) {
    console.error("[signup-notify] failed:", errorChain(e));
  }
  try {
    const welcomed = await sendWelcomeEmail(c.env, c.req.url, { username, email });
    if (welcomed) {
      console.info("[welcome-email] sent to", email);
    } else if (!isSmokeTestEmail(email)) {
      console.error(
        "[welcome-email] not sent — set RESEND_API_KEY (and EMAIL_FROM) in Cloudflare Pages",
      );
    }
  } catch (e) {
    console.error("[welcome-email] failed:", errorChain(e));
  }
  return c.json({
    token,
    user: publicUserPayload({ id: userId, username, email, profilePhoto: null, accountRole }),
  });
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
    user: publicUserPayload(user),
  });
});

app.post("/api/auth/logout", authMiddleware, async (c: any) => {
  const user = c.get("user");
  await c.get("db").delete(sessions).where(eq(sessions.token, user.token));
  return c.json({ ok: true });
});

/** Lightweight session check (no question bank). Used on app load for fast auth. */
app.get("/api/auth/session", authMiddleware, async (c: any) => {
  const user = c.get("user");
  return c.json({
    user: publicUserPayload(user),
  });
});

app.get("/api/premium/usage", authMiddleware, async (c: any) => {
  const user = c.get("user");
  const db = c.get("db");
  const env = c.env as Env;
  const premium = isPremiumAccount(user);
  const providerCount = aiProviderPoolSize(env);
  const usage = await getPremiumUsageSummary(db, user.id, premium, providerCount);
  return c.json(usage);
});

app.post("/api/feedback", async (c) => {
  const limited = rateLimitResponse(c, "feedback");
  if (limited) return limited;
  const db = c.get("db");
  const body = await c.req.json();
  const message = cleanText(body.message, 4000);
  if (message.length < 3) {
    return c.json({ error: "Please enter at least a few words of feedback." }, 400);
  }
  const ratingRaw = body.rating;
  const rating =
    ratingRaw == null || ratingRaw === ""
      ? null
      : Math.min(5, Math.max(1, Math.round(Number(ratingRaw))));
  if (rating == null || !Number.isFinite(rating)) {
    return c.json({ error: "Please choose a rating from 1 to 5." }, 400);
  }
  const vceStudentRaw = cleanText(body.vceStudent, 20).toLowerCase();
  const vceStudent =
    vceStudentRaw === "yes" || vceStudentRaw === "no" ? vceStudentRaw : null;
  if (!vceStudent) {
    return c.json({ error: "Please tell us whether you are a VCE student." }, 400);
  }
  const featuresStandOut = cleanText(body.featuresStandOut, 2000);
  if (featuresStandOut.length < 3) {
    return c.json({ error: "Please mention at least one feature that stands out." }, 400);
  }
  const sessionUser = await resolveOptionalUser(c);
  const authorName = sessionUser
    ? sessionUser.username
    : cleanText(body.name, 80) || "Anonymous";
  const authorEmail = sessionUser
    ? sessionUser.email
    : String(body.email || "").trim().toLowerCase() || null;
  const createdAt = nowIso();
  await db.insert(userFeedback).values({
    userId: sessionUser?.id ?? null,
    authorName,
    authorEmail,
    message,
    rating,
    vceStudent,
    featuresStandOut,
    createdAt,
  });
  try {
    await sendFeedbackNotificationEmail(
      c.env,
      { id: sessionUser?.id ?? null, name: authorName, email: authorEmail },
      message,
      rating,
      { vceStudent, featuresStandOut },
    );
  } catch (e) {
    console.error("[feedback-notify] failed:", errorChain(e));
  }
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
        accountRole: users.accountRole,
      })
      .from(users)
      .where(eq(users.id, user.id))
      .limit(1);
    return c.json({
      user: publicUserPayload(refreshed[0]),
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
    const answerImgs = safeJsonParse(
      (row as { answerImageUrls?: string | null }).answerImageUrls ?? null,
    ) as string[] | undefined;
    const t = String(row.type || "");
    const marksNum = Number(row.marks);
    const marks =
      Number.isFinite(marksNum) && marksNum > 0 ? Math.round(marksNum) : 1;
    const parts = safeJsonParse(row.answerPartsJson) as unknown[] | undefined;
    const markBreakdown = safeJsonParse(
      (row as { markBreakdownJson?: string | null }).markBreakdownJson ?? null,
    );
    const aiRaw = (row as { aiMarkingEnabled?: number | null }).aiMarkingEnabled;
    const useAiMarking =
      aiRaw === 0 ? false : aiRaw === 1 ? true : undefined;
    grouped[sid].push({
      id: row.id,
      type: t === "short_answer" ? "short" : t === "long_answer" ? "long" : row.type,
      topic: row.topic ?? "General",
      question: row.question,
      imageUrls: imgs,
      answerImageUrls: answerImgs,
      options: opts,
      answer: row.answer || undefined,
      acceptedAnswers: acc,
      answerParts: Array.isArray(parts) ? parts : undefined,
      markBreakdown:
        markBreakdown && typeof markBreakdown === "object" ? markBreakdown : undefined,
      guidance: row.guidance || undefined,
      passage: row.passage || undefined,
      marks,
      useAiMarking,
    });
  }
  const subjRows = await db.execute(sql`
    SELECT subject_id
    FROM user_subjects
    WHERE user_id = ${user.id}
    ORDER BY subject_id ASC
  `);
  return c.json({
    user: publicUserPayload(user),
    customQuestions: grouped,
    mySubjectIds: (subjRows.rows as any[]).map((r) => String(r.subject_id)),
  });
});

// ---- Subjects (persist user dashboard selection) ----
app.get("/api/subjects/my", authMiddleware, async (c: any) => {
  const user = c.get("user");
  const db = c.get("db");
  const rows = await db.execute(sql`
    SELECT subject_id, confidence_rank
    FROM user_subjects
    WHERE user_id = ${user.id}
    ORDER BY COALESCE(confidence_rank, 9999) ASC, subject_id ASC
  `);
  const subjects = (rows.rows as any[]).map((r) => ({
    subjectId: String(r.subject_id),
    confidenceRank:
      r.confidence_rank == null ? null : Number(r.confidence_rank),
  }));
  return c.json({
    subjectIds: subjects.map((s) => s.subjectId),
    subjects,
  });
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
  const rankById = new Map<string, number>();
  if (Array.isArray(body?.subjects)) {
    for (const row of body.subjects) {
      const sid = String(row?.subjectId ?? "").trim();
      const rank = Number(row?.confidenceRank);
      if (sid && Number.isFinite(rank) && rank > 0) rankById.set(sid, Math.round(rank));
    }
  } else if (body?.confidenceRanks && typeof body.confidenceRanks === "object") {
    for (const [sid, rank] of Object.entries(body.confidenceRanks as Record<string, unknown>)) {
      const n = Number(rank);
      if (sid && Number.isFinite(n) && n > 0) rankById.set(sid, Math.round(n));
    }
  }
  await db.execute(sql`DELETE FROM user_subjects WHERE user_id = ${user.id}`);
  for (const sid of subjectIds) {
    const confidenceRank = rankById.get(sid) ?? null;
    await db.execute(sql`
      INSERT INTO user_subjects (user_id, subject_id, created_at, confidence_rank)
      VALUES (${user.id}, ${sid}, ${nowIso()}, ${confidenceRank})
      ON CONFLICT(user_id, subject_id) DO NOTHING
    `);
  }
  return c.json({ ok: true, subjectIds });
});

app.post("/api/onboarding/complete", authMiddleware, async (c: any) => {
  const user = c.get("user");
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({} as any));

  const isVceRaw = body?.isVceStudent;
  const isVceStudent =
    isVceRaw === true || isVceRaw === 1 || String(isVceRaw).toLowerCase() === "yes"
      ? 1
      : isVceRaw === false || isVceRaw === 0 || String(isVceRaw).toLowerCase() === "no"
        ? 0
        : null;

  const rowsRaw = Array.isArray(body?.subjects) ? body.subjects : [];
  const subjectRows = rowsRaw
    .map((row: any, idx: number) => {
      const subjectId = String(row?.subjectId ?? row?.id ?? "").trim();
      const rank = Number(row?.confidenceRank ?? idx + 1);
      if (!subjectId) return null;
      return {
        subjectId,
        confidenceRank: Number.isFinite(rank) && rank > 0 ? Math.round(rank) : idx + 1,
      };
    })
    .filter(Boolean) as { subjectId: string; confidenceRank: number }[];

  if (subjectRows.length === 0) {
    return c.json({ error: "Pick at least one subject." }, 400);
  }

  const uniqueIds = Array.from(new Set(subjectRows.map((r) => r.subjectId)));
  if (uniqueIds.length !== subjectRows.length) {
    return c.json({ error: "Duplicate subjects in ranking." }, 400);
  }

  await db.execute(sql`DELETE FROM user_subjects WHERE user_id = ${user.id}`);
  for (const row of subjectRows) {
    await db.execute(sql`
      INSERT INTO user_subjects (user_id, subject_id, created_at, confidence_rank)
      VALUES (${user.id}, ${row.subjectId}, ${nowIso()}, ${row.confidenceRank})
    `);
  }

  const completedAt = nowIso();
  await db.execute(sql`
    UPDATE users
    SET onboarding_completed_at = ${completedAt},
        is_vce_student = ${isVceStudent}
    WHERE id = ${user.id}
  `);

  return c.json({
    ok: true,
    user: publicUserPayload({
      id: user.id,
      username: user.username,
      email: user.email,
      profilePhoto: user.profilePhoto ?? null,
      accountRole: user.accountRole,
      onboardingCompletedAt: completedAt,
      isVceStudent,
    }),
    subjectIds: subjectRows.map((r) => r.subjectId),
    subjects: subjectRows,
  });
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

  const totals = await db.execute(sql`
    SELECT
      COUNT(DISTINCT qa.user_id)::int AS total_students,
      COALESCE(SUM(CASE WHEN qa.user_id = ${user.id} THEN COALESCE(qa.marks_earned, CASE WHEN qa.is_correct = 1 THEN qa.marks ELSE 0 END) ELSE 0 END), 0)::int AS my_points,
      COALESCE(SUM(CASE WHEN qa.user_id = ${user.id} THEN qa.marks ELSE 0 END), 0)::int AS my_marks_attempted
    FROM question_attempts qa
  `);
  const totalStudents = Number((totals.rows as any[])[0]?.total_students ?? 0);
  const points = Number((totals.rows as any[])[0]?.my_points ?? 0);
  const marksAttemptedOverall = Number((totals.rows as any[])[0]?.my_marks_attempted ?? 0);

  const overallCohort = await getUserMarksRankInCohort(db, user.id, {}, MIN_RANKED_ATTEMPTS);
  const overallRank = overallCohort.rank;

  // Subjects the student "does" (dashboard selection).
  const subjectRows = await db.execute(sql`
    SELECT subject_id
    FROM user_subjects
    WHERE user_id = ${user.id}
    ORDER BY subject_id ASC
  `);
  const subjectIds = (subjectRows.rows as any[]).map((r) => String(r.subject_id));

  // Average percentile across the student's selected subjects (each needs MIN_RANKED_ATTEMPTS).
  let overallPercentile: number | null = null;
  if (subjectIds.length > 0) {
    let sum = 0;
    let n = 0;
    for (const sid of subjectIds) {
      const subjectIdOptions = subjectIdEquivalents(sid);
      const { percentile } = await getUserMarksRankInCohort(
        db,
        user.id,
        { subjectId: sid, subjectIdOptions },
        MIN_RANKED_ATTEMPTS,
      );
      if (percentile == null) continue;
      sum += percentile;
      n += 1;
    }
    overallPercentile = n > 0 ? sum / n : null;
  }

  const bestWeak = await db.execute(sql`
    SELECT subject_id,
           SUM(COALESCE(marks_earned, CASE WHEN is_correct = 1 THEN marks ELSE 0 END))::int AS marks_correct,
           SUM(marks)::int AS marks_attempted
    FROM question_attempts
    WHERE user_id = ${user.id}
    GROUP BY subject_id
  `);
  const perSubjectRaw = (bestWeak.rows as any[]).map((r) => ({
    subjectId: canonicalSubjectId(r.subject_id),
    attempted: Math.max(0, Number(r.marks_attempted ?? 0)),
    correct: Math.max(0, Number(r.marks_correct ?? 0)),
  }));
  const byCanonical = new Map<string, { attempted: number; correct: number }>();
  for (const row of perSubjectRaw) {
    const cur = byCanonical.get(row.subjectId) ?? { attempted: 0, correct: 0 };
    cur.attempted += row.attempted;
    cur.correct += row.correct;
    byCanonical.set(row.subjectId, cur);
  }
  const perSubject = Array.from(byCanonical.entries()).map(([subjectId, v]) => {
    const pct = v.attempted > 0 ? Math.round((v.correct / v.attempted) * 100) : 0;
    return { subjectId, attempted: v.attempted, correct: v.correct, pct };
  }).filter((x) => x.attempted > 0);
  perSubject.sort((a, b) => b.pct - a.pct);
  const bestSubjectId = perSubject.length ? perSubject[0]!.subjectId : null;
  const weakestSubjectId = perSubject.length ? perSubject[perSubject.length - 1]!.subjectId : null;

  // Per-subject report rows for every selected subject (and any attempted subject).
  const reportSubjects: Array<{
    subjectId: string;
    attempts: number;
    marksCorrect: number;
    marksAttempted: number;
    rank: number | null;
    rankedStudents: number;
    percentile: number | null;
    subjectPercent: number;
    weakestTopic: {
      topic: string;
      percent: number;
      percentile: number | null;
      marksCorrect: number;
      marksAttempted: number;
    } | null;
    strongestTopic: {
      topic: string;
      percent: number;
      percentile: number | null;
      marksCorrect: number;
      marksAttempted: number;
    } | null;
  }> = [];

  const attemptedBySubjectRows = await db.execute(sql`
    SELECT subject_id, COUNT(*)::int AS attempts
    FROM question_attempts
    WHERE user_id = ${user.id}
    GROUP BY subject_id
  `);
  const attemptedBySubject = new Map<string, number>();
  for (const r of attemptedBySubjectRows.rows as any[]) {
    const sid = canonicalSubjectId(r.subject_id);
    attemptedBySubject.set(sid, (attemptedBySubject.get(sid) ?? 0) + Number(r.attempts ?? 0));
  }

  const reportSubjectIds = Array.from(
    new Set([
      ...subjectIds,
      ...Array.from(attemptedBySubject.keys()),
    ]),
  ).sort((a, b) => a.localeCompare(b));

  for (const sid of reportSubjectIds) {
    const subjectMarks = perSubject.find((row) => row.subjectId === sid);
    const subjectIdOptions = subjectIdEquivalents(sid);
    const {
      rank,
      rankedStudents: total,
      percentile,
    } = await getUserMarksRankInCohort(
      db,
      user.id,
      { subjectId: sid, subjectIdOptions },
      MIN_RANKED_ATTEMPTS,
    );

    // Weakest/strongest topic for this user in this subject (mark-weighted %).
    const topicRows = await db.execute(sql`
      SELECT topic,
             SUM(COALESCE(marks_earned, CASE WHEN is_correct = 1 THEN marks ELSE 0 END))::int AS marks_correct,
             SUM(marks)::int AS marks_attempted
      FROM question_attempts
      WHERE user_id = ${user.id} AND subject_id IN (${sqlTextInList(subjectIdOptions)})
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
      .filter((t) => t.marksAttempted > 0 && !isPlaceholderTopic(t.topic));

    let weakest: (typeof topics)[number] | null = null;
    let strongest: (typeof topics)[number] | null = null;
    for (const t of topics) {
      if (!weakest || t.percent < weakest.percent) weakest = t;
      if (!strongest || t.percent > strongest.percent) strongest = t;
    }

    const getTopicPercentile = async (topic: string | null) => {
      if (!topic) return null;
      const { percentile: topicPercentile } = await getUserMarksRankInCohort(
        db,
        user.id,
        { subjectId: sid, topic },
        1,
      );
      return topicPercentile;
    };

    const weakestTopicPercentile = await getTopicPercentile(weakest?.topic ?? null);
    const strongestTopicPercentile = await getTopicPercentile(strongest?.topic ?? null);

    reportSubjects.push({
      subjectId: sid,
      attempts: attemptedBySubject.get(sid) ?? 0,
      marksCorrect: subjectMarks?.correct ?? 0,
      marksAttempted: subjectMarks?.attempted ?? 0,
      rank,
      rankedStudents: total,
      percentile,
      subjectPercent: subjectMarks?.pct ?? 0,
      weakestTopic: weakest
        ? { ...weakest, percentile: weakestTopicPercentile }
        : null,
      strongestTopic: strongest
        ? { ...strongest, percentile: strongestTopicPercentile }
        : null,
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
    marksCorrect: points,
    marksAttempted: marksAttemptedOverall,
    overallPercentile,
    overallRankedStudents: overallCohort.rankedStudents,
    bestSubjectId,
    weakestSubjectId,
    studyStreak: streak,
    reportSubjects,
  });
});

// ---- Teacher / class ----
app.get("/api/teacher/class", authMiddleware, async (c: any) => {
  const denied = teacherAccessDenied(c);
  if (denied) return denied;
  const user = c.get("user");
  const db = c.get("db");
  const classRow = await getOrCreateTeacherClassRow(db, user.id);
  const memberIds = await getClassMemberIds(db, classRow.id);
  return c.json({
    classId: classRow.id,
    className: classRow.class_name,
    joinCode: classRow.join_code,
    memberCount: memberIds.length,
    createdAt: classRow.created_at,
  });
});

app.patch("/api/teacher/class", authMiddleware, async (c: any) => {
  const denied = teacherAccessDenied(c);
  if (denied) return denied;
  const user = c.get("user");
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const className = String(body?.className ?? "").trim().slice(0, 80);
  if (!className) return c.json({ error: "Class name is required." }, 400);
  const classRow = await getOrCreateTeacherClassRow(db, user.id);
  await db.execute(sql`
    UPDATE teacher_classes SET class_name = ${className} WHERE id = ${classRow.id}
  `);
  return c.json({ ok: true, className });
});

app.get("/api/teacher/class/members", authMiddleware, async (c: any) => {
  const denied = teacherAccessDenied(c);
  if (denied) return denied;
  const user = c.get("user");
  const db = c.get("db");
  const subjectId = String(c.req.query("subjectId") ?? "").trim();
  const classRow = await getOrCreateTeacherClassRow(db, user.id);
  const subjectFilter = subjectId ? sql` AND qa.subject_id = ${subjectId} ` : sql``;

  const rows = await db.execute(sql`
    SELECT u.id AS user_id,
           u.username,
           u.email,
           cm.joined_at,
           COALESCE(SUM(COALESCE(qa.marks_earned, CASE WHEN qa.is_correct = 1 THEN qa.marks ELSE 0 END)), 0)::int AS marks_correct,
           COALESCE(SUM(qa.marks), 0)::int AS marks_attempted,
           COUNT(qa.question_key)::int AS question_count
    FROM class_members cm
    JOIN users u ON u.id = cm.user_id
    LEFT JOIN question_attempts qa ON qa.user_id = u.id ${subjectFilter}
    WHERE cm.class_id = ${classRow.id}
    GROUP BY u.id, u.username, u.email, cm.joined_at
    ORDER BY LOWER(u.username) ASC, u.id ASC
  `);

  const members = (rows.rows as any[]).map((r) => {
    const marksCorrect = Number(r.marks_correct ?? 0);
    const marksAttempted = Number(r.marks_attempted ?? 0);
    return {
      userId: Number(r.user_id),
      username: String(r.username ?? ""),
      email: String(r.email ?? ""),
      joinedAt: String(r.joined_at ?? ""),
      marksCorrect,
      marksAttempted,
      percent: pctFromMarks(marksCorrect, marksAttempted),
      questionCount: Number(r.question_count ?? 0),
    };
  });

  return c.json({ members });
});

app.get("/api/teacher/class/stats", authMiddleware, async (c: any) => {
  const denied = teacherAccessDenied(c);
  if (denied) return denied;
  const user = c.get("user");
  const db = c.get("db");
  const subjectId = String(c.req.query("subjectId") ?? "").trim() || undefined;
  const classRow = await getOrCreateTeacherClassRow(db, user.id);
  const memberIds = await getClassMemberIds(db, classRow.id);
  const { topicStats, weakTopics, belowAvgTopics, avgPercent, platformPercent, vsPlatform } =
    await buildClassTopicStats(db, memberIds, subjectId);

  const subjectFilter = subjectId ? sql` AND qa.subject_id = ${subjectId} ` : sql``;
  const activeRows = memberIds.length
    ? await db.execute(sql`
        SELECT COUNT(DISTINCT qa.user_id)::int AS active_students,
               COALESCE(SUM(COALESCE(qa.marks_earned, CASE WHEN qa.is_correct = 1 THEN qa.marks ELSE 0 END)), 0)::int AS marks_correct,
               COALESCE(SUM(qa.marks), 0)::int AS marks_attempted,
               COUNT(*)::int AS question_count
        FROM question_attempts qa
        WHERE qa.user_id IN (${sqlIntInList(memberIds)})
        ${subjectFilter}
      `)
    : { rows: [{ active_students: 0, marks_correct: 0, marks_attempted: 0, question_count: 0 }] };

  const active = (activeRows.rows as any[])[0] ?? {};
  const marksCorrect = Number(active.marks_correct ?? 0);
  const marksAttempted = Number(active.marks_attempted ?? 0);

  return c.json({
    classId: classRow.id,
    className: classRow.class_name,
    memberCount: memberIds.length,
    activeStudents: Number(active.active_students ?? 0),
    questionCount: Number(active.question_count ?? 0),
    marksCorrect,
    marksAttempted,
    avgPercent: marksAttempted > 0 ? pctFromMarks(marksCorrect, marksAttempted) : avgPercent,
    platformPercent,
    vsPlatform,
    topicStats,
    weakTopics,
    belowAvgTopics,
  });
});

app.get("/api/teacher/class/students/:studentId/stats", authMiddleware, async (c: any) => {
  const denied = teacherAccessDenied(c);
  if (denied) return denied;
  const user = c.get("user");
  const db = c.get("db");
  const studentId = Number(c.req.param("studentId"));
  if (!studentId) return c.json({ error: "Invalid student." }, 400);
  const subjectId = String(c.req.query("subjectId") ?? "").trim() || undefined;
  const classRow = await getOrCreateTeacherClassRow(db, user.id);
  const memberCheck = await db.execute(sql`
    SELECT 1 FROM class_members
    WHERE class_id = ${classRow.id} AND user_id = ${studentId}
    LIMIT 1
  `);
  if (!(memberCheck.rows as any[]).length) {
    return c.json({ error: "Student is not in your class." }, 404);
  }

  const profile = await db.execute(sql`
    SELECT id, username, email FROM users WHERE id = ${studentId} LIMIT 1
  `);
  if (!(profile.rows as any[]).length) return c.json({ error: "Student not found." }, 404);
  const p = (profile.rows as any[])[0];
  const stats = await buildStudentStats(db, studentId, subjectId);

  return c.json({
    userId: studentId,
    username: String(p.username ?? ""),
    email: String(p.email ?? ""),
    ...stats,
  });
});

app.post("/api/class/join", authMiddleware, async (c: any) => {
  const user = c.get("user");
  const db = c.get("db");
  const body = await c.req.json().catch(() => ({}));
  const joinCode = String(body?.joinCode ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (joinCode.length < 4) {
    return c.json({ error: "Enter a valid class code." }, 400);
  }

  const classRows = await db.execute(sql`
    SELECT tc.id, tc.class_name, tc.join_code, u.username AS teacher_name
    FROM teacher_classes tc
    JOIN users u ON u.id = tc.teacher_id
    WHERE tc.join_code = ${joinCode}
    LIMIT 1
  `);
  if (!(classRows.rows as any[]).length) {
    return c.json({ error: "Class code not found." }, 404);
  }
  const classRow = (classRows.rows as any[])[0];
  const classId = Number(classRow.id);

  if (String(user.email ?? "").toLowerCase() === ADMIN_EMAIL_LC) {
    const teacherRow = await db.execute(sql`
      SELECT teacher_id FROM teacher_classes WHERE id = ${classId} LIMIT 1
    `);
    const teacherId = Number((teacherRow.rows as any[])[0]?.teacher_id ?? 0);
    if (teacherId === user.id) {
      return c.json({ error: "You cannot join your own class." }, 400);
    }
  }

  const existingMembership = await db.execute(sql`
    SELECT cm.class_id, tc.class_name, tc.join_code, u.username AS teacher_name
    FROM class_members cm
    JOIN teacher_classes tc ON tc.id = cm.class_id
    JOIN users u ON u.id = tc.teacher_id
    WHERE cm.user_id = ${user.id}
    LIMIT 1
  `);
  if ((existingMembership.rows as any[]).length) {
    const existing = (existingMembership.rows as any[])[0];
    const existingClassId = Number(existing.class_id);
    if (existingClassId === classId) {
      return c.json({
        ok: true,
        alreadyMember: true,
        classId,
        className: String(existing.class_name ?? "Class"),
        joinCode: String(existing.join_code ?? joinCode),
        teacherName: String(existing.teacher_name ?? "Teacher"),
      });
    }
    return c.json(
      {
        error: `You're already in ${String(existing.class_name ?? "a class")}. Ask your teacher if you need to switch.`,
      },
      400,
    );
  }

  await db.execute(sql`
    INSERT INTO class_members (class_id, user_id, joined_at)
    VALUES (${classId}, ${user.id}, ${nowIso()})
    ON CONFLICT (class_id, user_id) DO NOTHING
  `);

  return c.json({
    ok: true,
    classId,
    className: String(classRow.class_name ?? "Class"),
    joinCode: String(classRow.join_code ?? joinCode),
    teacherName: String(classRow.teacher_name ?? "Teacher"),
  });
});

app.get("/api/class/preview", authMiddleware, async (c: any) => {
  const db = c.get("db");
  const joinCode = String(c.req.query("code") ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  if (joinCode.length < 4) {
    return c.json({ error: "Enter a valid class code." }, 400);
  }

  const rows = await db.execute(sql`
    SELECT tc.class_name, tc.join_code, u.username AS teacher_name,
           (SELECT COUNT(*)::int FROM class_members cm WHERE cm.class_id = tc.id) AS member_count
    FROM teacher_classes tc
    JOIN users u ON u.id = tc.teacher_id
    WHERE tc.join_code = ${joinCode}
    LIMIT 1
  `);
  if (!(rows.rows as any[]).length) {
    return c.json({ error: "Class code not found." }, 404);
  }
  const r = (rows.rows as any[])[0];
  return c.json({
    className: String(r.class_name ?? "Class"),
    teacherName: String(r.teacher_name ?? "Teacher"),
    joinCode: String(r.join_code ?? joinCode),
    memberCount: Number(r.member_count ?? 0),
  });
});

app.get("/api/class/membership", authMiddleware, async (c: any) => {
  const user = c.get("user");
  const db = c.get("db");
  const rows = await db.execute(sql`
    SELECT tc.id AS class_id, tc.class_name, tc.join_code, u.username AS teacher_name, cm.joined_at
    FROM class_members cm
    JOIN teacher_classes tc ON tc.id = cm.class_id
    JOIN users u ON u.id = tc.teacher_id
    WHERE cm.user_id = ${user.id}
    ORDER BY cm.joined_at DESC
    LIMIT 1
  `);
  if (!(rows.rows as any[]).length) {
    return c.json({ enrolled: false });
  }
  const r = (rows.rows as any[])[0];
  return c.json({
    enrolled: true,
    classId: Number(r.class_id),
    className: String(r.class_name ?? ""),
    joinCode: String(r.join_code ?? ""),
    teacherName: String(r.teacher_name ?? ""),
    joinedAt: String(r.joined_at ?? ""),
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
      COALESCE(SUM(COALESCE(marks_earned, CASE WHEN is_correct = 1 THEN marks ELSE 0 END)), 0)::integer AS points
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
  const rows = await db.execute(sql`
    SELECT qa.user_id, u.username, u.email,
           MAX(qa.percent) AS best_percent,
           MAX(qa.score) AS best_score,
           MAX(qa.total_questions) AS best_total,
           COUNT(qa.id) AS attempts
    FROM quiz_attempts qa
    JOIN users u ON u.id = qa.user_id
    WHERE qa.subject_id = ${subjectId}
    GROUP BY qa.user_id, u.username, u.email
    ORDER BY best_percent DESC, best_score DESC
    LIMIT 10
  `);
  const leaderboard = (rows.rows as any[]).map((r) => ({
    ...r,
    username: publicLeaderboardUsername(r.user_id, r.email, r.username),
  }));
  return c.json({ leaderboard });
});

// ---- Competition ----
app.post("/api/competition/answer", authMiddleware, async (c: any) => {
  const user = c.get("user"); const db = c.get("db"); const body = await c.req.json();
  const subjectId = canonicalSubjectId(body.subjectId); const questionKey = cleanText(body.questionKey, 1000);
  const topic = cleanText(body.topic || "General", 100);
  const marksTotal = Math.max(1, Math.round(Number(body.marks ?? 1)));
  const isCorrectRaw = body.isCorrect ?? body.correct;
  const isCorrect = isCorrectRaw ? 1 : 0;
  const earnedRaw = body.marksEarned ?? body.marks_earned;
  const marksEarned = Number.isFinite(Number(earnedRaw))
    ? Math.min(marksTotal, Math.max(0, Math.round(Number(earnedRaw))))
    : isCorrect
      ? marksTotal
      : 0;
  if (!subjectId || !questionKey) return c.json({ error: "Required fields missing." }, 400);
  await db.execute(sql`INSERT INTO question_attempts (user_id, subject_id, question_key, topic, marks, marks_earned, is_correct, answered_at) VALUES (${user.id}, ${subjectId}, ${questionKey}, ${topic}, ${marksTotal}, ${marksEarned}, ${isCorrect}, ${nowIso()}) ON CONFLICT(user_id, subject_id, question_key) DO UPDATE SET topic = EXCLUDED.topic, marks = EXCLUDED.marks, marks_earned = EXCLUDED.marks_earned, is_correct = EXCLUDED.is_correct, answered_at = EXCLUDED.answered_at`);
  return c.json({ ok: true });
});

app.get("/api/competition/:subjectId/stats", authMiddleware, async (c: any) => {
  const user = c.get("user"); const db = c.get("db"); const subjectId = c.req.param("subjectId");
  const MIN_RANKED = MIN_RANKED_ATTEMPTS;
  const range = String(c.req.query("range") ?? "all");
  let timeFilter = sql``;
  if (range === "week") {
    // Rolling last 7 days (more intuitive + makes week/all-time differ more often).
    const end = new Date();
    const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
    timeFilter = sql` AND answered_at >= ${start.toISOString()} AND answered_at < ${end.toISOString()} `;
  }

  const studentResult = await db.execute(sql`SELECT COUNT(DISTINCT user_id) as count FROM question_attempts WHERE subject_id = ${subjectId} ${timeFilter}`);
  const totalStudents = Number((studentResult.rows[0] as any).count);

  const allScoresRows = await db.execute(sql`
    WITH range_scores AS (
      SELECT qa.user_id, u.username, u.email,
             SUM(COALESCE(qa.marks_earned, CASE WHEN qa.is_correct = 1 THEN qa.marks ELSE 0 END)) AS marks_correct,
             SUM(qa.marks) AS marks_attempted,
             COUNT(*)::int AS attempt_count_range
      FROM question_attempts qa
      JOIN users u ON u.id = qa.user_id
      WHERE qa.subject_id = ${subjectId} ${timeFilter}
      GROUP BY qa.user_id, u.username, u.email
    ),
    all_time_attempts AS (
      SELECT user_id, COUNT(*)::int AS attempt_count_all_time
      FROM question_attempts
      WHERE subject_id = ${subjectId}
      GROUP BY user_id
    )
    SELECT r.user_id, r.username, r.email, r.marks_correct, r.marks_attempted,
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
  const eligible = allScores.filter((r) => Number(r.attempt_count_all_time) >= MIN_RANKED);
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
  if (myAttempts >= MIN_RANKED && sortedEligible.length >= 2) {
    const idx = sortedEligible.findIndex((r) => r.user_id === user.id);
    rank = idx >= 0 ? idx + 1 : null;
    if (rank != null) {
      percentile = cohortPercentileFromRank(rank, sortedEligible.length);
    }
  }

  const leaderboardData = sortedEligible.slice(0, 10).map((r) => ({
    userId: r.user_id,
    username: publicLeaderboardUsername(r.user_id, r.email, r.username),
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
           SUM(COALESCE(marks_earned, CASE WHEN is_correct = 1 THEN marks ELSE 0 END)) AS class_marks_correct,
           SUM(marks) AS class_marks_attempted
    FROM question_attempts
    WHERE subject_id = ${subjectId} ${timeFilter}
    GROUP BY topic
  `);

  const topicMyRows = await db.execute(sql`
    SELECT topic,
           SUM(COALESCE(marks_earned, CASE WHEN is_correct = 1 THEN marks ELSE 0 END)) AS my_marks_correct,
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
           SUM(COALESCE(marks_earned, CASE WHEN is_correct = 1 THEN marks ELSE 0 END)) AS marks_correct,
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

  const myQuestionRows = await db.execute(sql`
    SELECT question_key, is_correct
    FROM question_attempts
    WHERE subject_id = ${subjectId} AND user_id = ${user.id}
  `);
  const myQuestionAttempts = (myQuestionRows.rows as any[]).map((r) => ({
    questionKey: String(r.question_key),
    isCorrect: Number(r.is_correct) === 1,
  }));

  return c.json({
    totalStudents,
    percentile,
    rank,
    rankedStudents:
      rank != null && sortedEligible.length > 0 ? sortedEligible.length : null,
    myMarksCorrect: myRow ? Number(myRow.marks_correct) : 0,
    myMarksAttempted: myRow ? Number(myRow.marks_attempted) : 0,
    myPercent: myPct,
    leaderboard: leaderboardData,
    questionStats,
    topicStats,
    myQuestionAttempts,
    minRankedAttempts: MIN_RANKED,
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

async function loadSubjectMarkingContext(
  db: any,
  subjectId: string,
): Promise<SubjectMarkingContext | undefined> {
  const sid = canonicalSubjectId(subjectId);
  const rows = await db.execute(sql`
    SELECT prompt_text, resources_json
    FROM subject_marking_context
    WHERE subject_id = ${sid}
    LIMIT 1
  `);
  const row = (rows.rows as any[])?.[0];
  if (!row) return undefined;
  const promptText = String(row.prompt_text ?? "").trim();
  const resourcesRaw = safeJsonParse(row.resources_json);
  const resources = Array.isArray(resourcesRaw)
    ? resourcesRaw
        .map((r) => {
          if (typeof r === "string") return r.trim();
          if (r && typeof r === "object") {
            const o = r as Record<string, unknown>;
            return String(o.content ?? o.text ?? o.name ?? "").trim();
          }
          return "";
        })
        .filter(Boolean)
        .slice(0, 20)
    : [];
  if (!promptText && !resources.length) return undefined;
  return { promptText, resources };
}

async function runEnglishAiScore(
  db: any,
  env: Env,
  responseId: number,
  userId: number,
): Promise<{
  score: number;
  summary: string;
  criteria: Record<string, { score: number; feedback: string }>;
  highlights: { quote: string; type: string; criterion?: string; feedback: string }[];
} | null> {
  if (!englishAiConfigured(env)) return null;
  const rows = await db.execute(sql`
    SELECT r.response_text, r.custom_prompt_text, p.prompt_text,
           r.ai_score, r.ai_feedback, r.ai_criteria_json, r.ai_highlights_json, r.ai_scored_at
    FROM english_responses r
    LEFT JOIN english_prompts p ON p.id = r.prompt_id
    WHERE r.id = ${responseId}
    LIMIT 1
  `);
  const row = (rows.rows as any[])[0];
  if (!row) return null;
  if (row.ai_scored_at && row.ai_score != null) {
    return {
      score: Number(row.ai_score),
      summary: String(row.ai_feedback ?? ""),
      criteria: parseEnglishCriteriaJson(row.ai_criteria_json) ?? {},
      highlights: parseEnglishHighlightsJson(row.ai_highlights_json),
    };
  }
  const responseText = String(row.response_text ?? "").trim();
  if (responseText.length < 20) return null;

  const started = Date.now();
  let reservation: Awaited<ReturnType<typeof beginAiRequest>> | null = null;
  const telemetry: {
    inputTokens: number; cachedInputTokens: number; outputTokens: number;
    totalTokens: number; estimatedCostUsd: number;
  }[] = [];
  let result;
  try {
    const scoringStartedAt = nowIso();
    await db.execute(sql`
      UPDATE english_responses
      SET ai_scoring_status = 'pending',
          ai_scoring_error = NULL,
          ai_scoring_started_at = ${scoringStartedAt}
      WHERE id = ${responseId}
    `);
    const reservationDetails = englishAiReservationDetails(env);
    reservation = await beginAiRequest({
      db,
      env,
      requestKey: `english-score:${responseId}`,
      userId,
      route: "/api/english/responses/:id/ai-score",
      feature: "english_essay_marking",
      provider: reservationDetails.provider,
      model: reservationDetails.model,
      reservedCostUsd: reservationDetails.provider === "openai"
        ? openAiEnglishReservationUsd(env)
        : 0,
    });
    const promptText = String(row.custom_prompt_text ?? row.prompt_text ?? "").trim();
    result = await scoreEnglishResponse(env, {
      promptText,
      responseText,
      subjectContext: await loadSubjectMarkingContext(db, "english"),
    }, {
      route: "/api/english/responses/:id/ai-score",
      feature: "english_essay_marking",
      userId,
      onOpenAiRequest: (event) => telemetry.push(event),
    });
    const now = nowIso();
    await db.execute(sql`
      UPDATE english_responses
      SET ai_score = ${result.score},
          ai_feedback = ${result.summary},
          ai_criteria_json = ${JSON.stringify(result.criteria)},
          ai_highlights_json = ${JSON.stringify(result.highlights)},
          ai_scored_at = ${now},
          ai_scoring_status = 'complete',
          ai_scoring_error = NULL
      WHERE id = ${responseId}
    `);
    await finishAiRequest({
      db, reservation, success: true, latencyMs: Date.now() - started,
      inputTokens: telemetry.reduce((n, row) => n + row.inputTokens, 0),
      cachedInputTokens: telemetry.reduce((n, row) => n + row.cachedInputTokens, 0),
      outputTokens: telemetry.reduce((n, row) => n + row.outputTokens, 0),
      totalTokens: telemetry.reduce((n, row) => n + row.totalTokens, 0),
      actualCostUsd: telemetry.reduce((n, row) => n + row.estimatedCostUsd, 0),
    });
    return result;
  } catch (error) {
    if (reservation) {
      await finishAiRequest({
        db, reservation, success: false, latencyMs: Date.now() - started,
        inputTokens: telemetry.reduce((n, row) => n + row.inputTokens, 0),
        cachedInputTokens: telemetry.reduce((n, row) => n + row.cachedInputTokens, 0),
        outputTokens: telemetry.reduce((n, row) => n + row.outputTokens, 0),
        totalTokens: telemetry.reduce((n, row) => n + row.totalTokens, 0),
        actualCostUsd: telemetry.reduce((n, row) => n + row.estimatedCostUsd, 0),
        errorCode: error instanceof AiSafetyError
          ? error.code
          : error instanceof Error ? error.name : "ai_error",
      }).catch(() => undefined);
    }
    const safeError = error instanceof AiSafetyError
      ? error.message
      : englishAiUserMessage(error);
    await db.execute(sql`
      UPDATE english_responses
      SET ai_scoring_status = 'failed',
          ai_scoring_error = ${safeError}
      WHERE id = ${responseId}
    `).catch(() => undefined);
    throw error;
  }
}

function parseEnglishCriteriaJson(raw: unknown): Record<string, { score: number; feedback: string }> | null {
  if (raw == null || raw === "") return null;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as Record<string, { score: number; feedback: string }>;
  } catch {
    return null;
  }
}

function parseEnglishHighlightsJson(raw: unknown): { quote: string; type: string; criterion?: string; feedback: string }[] {
  if (raw == null || raw === "") return [];
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function mapEnglishResponseRow(r: Record<string, unknown>) {
  const customPrompt = r.custom_prompt_text != null ? String(r.custom_prompt_text) : "";
  const catalogPrompt = r.prompt_text != null ? String(r.prompt_text) : "";
  return {
    id: Number(r.id),
    promptId: r.prompt_id != null ? Number(r.prompt_id) : null,
    customPrompt: customPrompt || null,
    prompt: customPrompt || catalogPrompt || "",
    section: r.section != null ? normalizeEnglishSection(r.section) : null,
    userId: Number(r.user_id),
    username: String(r.username || ""),
    responseType: String(r.response_type || "essay"),
    responseText: String(r.response_text || ""),
    imageUrls: safeJsonColumn(r.image_urls) || [],
    updatedAt: String(r.updated_at || ""),
    aiScore: r.ai_score != null ? Number(r.ai_score) : null,
    aiFeedback: r.ai_feedback != null ? String(r.ai_feedback) : null,
    aiCriteria: parseEnglishCriteriaJson(r.ai_criteria_json),
    aiHighlights: parseEnglishHighlightsJson(r.ai_highlights_json),
    aiScoredAt: r.ai_scored_at != null ? String(r.ai_scored_at) : null,
    aiScoringStatus: r.ai_scoring_status != null ? String(r.ai_scoring_status) : null,
    aiScoringError: r.ai_scoring_error != null ? String(r.ai_scoring_error) : null,
    aiScoringStartedAt:
      r.ai_scoring_started_at != null ? String(r.ai_scoring_started_at) : null,
    isPublic: Number(r.is_public ?? 0) === 1,
  };
}

// ---- Phone QR upload (Create / quiz answer images) ----
app.post("/api/written/upload-token", authMiddleware, async (c: any) => {
  try {
    const user = c.get("user");
    const db = c.get("db");
    await ensurePhoneUploadSessionsTable(db);
    const body = await c.req.json().catch(() => ({}));
    const purpose = cleanText(body?.purpose, 40) || "create";
    const subjectId = body?.subjectId ? cleanText(body.subjectId, 80) : null;
    const questionKey = body?.questionKey ? cleanText(body.questionKey, 120) : null;
    const token = createToken();
    const now = nowIso();
    await db.execute(sql`
      INSERT INTO phone_upload_sessions (token, user_id, purpose, subject_id, question_key, pending_images, created_at, expires_at)
      VALUES (${token}, ${user.id}, ${purpose}, ${subjectId}, ${questionKey}, '[]', ${now}, ${phoneUploadSessionExpiry()})
    `);
    return c.json({ token });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

app.post("/api/written/upload/:token", async (c: any) => {
  try {
    const db = c.get("db");
    await ensurePhoneUploadSessionsTable(db);
    const token = cleanText(c.req.param("token"), 80);
    if (!token) return c.json({ error: "Invalid upload link." }, 400);

    const rows = await db.execute(sql`
      SELECT user_id, pending_images, expires_at
      FROM phone_upload_sessions
      WHERE token = ${token}
      LIMIT 1
    `);
    const row = (rows.rows as Record<string, unknown>[])[0];
    if (!row) return c.json({ error: "Upload link not found or expired." }, 404);
    if (new Date(String(row.expires_at)) < new Date()) {
      await db.execute(sql`DELETE FROM phone_upload_sessions WHERE token = ${token}`);
      return c.json({ error: "Upload link expired. Generate a new QR on your computer." }, 410);
    }

    const body = await c.req.json().catch(() => ({}));
    const incoming = parseImageUrlList(body?.imageUrls);
    if (!incoming.length) return c.json({ error: "No valid images provided." }, 400);
    const sizeErr = validateStorableImageUrls(incoming);
    if (sizeErr) return c.json({ error: sizeErr }, 400);

    const existing = parseImageUrlList(safeJsonParse(String(row.pending_images ?? "[]")));
    const merged = [...existing, ...incoming].slice(-24);
    await db.execute(sql`
      UPDATE phone_upload_sessions
      SET pending_images = ${JSON.stringify(merged)}
      WHERE token = ${token}
    `);
    return c.json({ ok: true, count: incoming.length });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

app.get("/api/written/upload-session/:token", authMiddleware, async (c: any) => {
  try {
    const user = c.get("user");
    const db = c.get("db");
    await ensurePhoneUploadSessionsTable(db);
    const token = cleanText(c.req.param("token"), 80);
    if (!token) return c.json({ error: "Invalid session." }, 400);

    const rows = await db.execute(sql`
      SELECT pending_images, expires_at
      FROM phone_upload_sessions
      WHERE token = ${token} AND user_id = ${user.id}
      LIMIT 1
    `);
    const row = (rows.rows as Record<string, unknown>[])[0];
    if (!row) return c.json({ error: "Upload session not found." }, 404);
    if (new Date(String(row.expires_at)) < new Date()) {
      await db.execute(sql`DELETE FROM phone_upload_sessions WHERE token = ${token}`);
      return c.json({ imageUrls: [] });
    }

    const imageUrls = parseImageUrlList(safeJsonParse(String(row.pending_images ?? "[]")));
    if (imageUrls.length) {
      await db.execute(sql`
        UPDATE phone_upload_sessions SET pending_images = '[]' WHERE token = ${token}
      `);
    }
    return c.json({ imageUrls });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

// ---- Practice exams ----
app.get("/api/practice-exams/:subjectId", authMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    await ensurePracticeExamTables(db);
    const user = c.get("user");
    if (!isPremiumAccount(user)) {
      return c.json(
        { ...premiumRequiredResponse(), error: "Past practice exams require Premium." },
        403,
      );
    }
    const subjectId = canonicalSubjectId(c.req.param("subjectId"));
    const rows = await db.execute(sql`
      SELECT pe.year, pe.exam_number, pe.published,
        (SELECT COUNT(*)::integer FROM practice_exam_pages pep WHERE pep.exam_id = pe.id) AS page_count
      FROM practice_exams pe
      WHERE pe.subject_id = ${subjectId}
      ORDER BY pe.year DESC, pe.exam_number ASC
    `);
    const exams = (rows.rows as Record<string, unknown>[]).map((r) => ({
      year: Number(r.year),
      examNumber: Number(r.exam_number ?? 1) === 2 ? 2 : 1,
      published: Number(r.published) === 1,
      hasPages: Number(r.page_count ?? 0) > 0,
    }));
    return c.json({ exams });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

app.get("/api/practice-exams/:subjectId/:year/:examNumber", authMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    await ensurePracticeExamTables(db);
    const user = c.get("user");
    const subjectId = canonicalSubjectId(c.req.param("subjectId"));
    const year = Math.round(Number(c.req.param("year")));
    const examNumber = Math.round(Number(c.req.param("examNumber"))) === 2 ? 2 : 1;
    if (!year || year < 2000 || year > 2100) return c.json({ error: "Invalid year." }, 400);

    if (!isPremiumAccount(user)) {
      return c.json(
        { ...premiumRequiredResponse(), error: "Past practice exams require Premium." },
        403,
      );
    }

    const rows = await db.execute(sql`
      SELECT id, slots_json, published, transparent_inputs, layout, mcq_count, mcq_json
      FROM practice_exams
      WHERE subject_id = ${subjectId} AND year = ${year} AND exam_number = ${examNumber}
      LIMIT 1
    `);
    const row = (rows.rows as Record<string, unknown>[])[0];
    if (!row) return c.json({ error: "Exam not found." }, 404);
    const published = Number(row.published) === 1;
    const isAdmin = String(user.email ?? "").toLowerCase() === ADMIN_EMAIL_LC;
    if (!published && !isAdmin) return c.json({ error: "Exam not available." }, 404);

    const pageRows = await db.execute(sql`
      SELECT page_number FROM practice_exam_pages
      WHERE exam_id = ${Number(row.id)}
      ORDER BY page_number ASC
    `);
    const legacyTransparent = Number(row.transparent_inputs ?? 0) === 1;
    const layout = parsePracticeExamLayout(row.layout);
    const mcqCount = parsePracticeExamMcqCount(row.mcq_count, layout);
    const mcqItems = parsePracticeExamMcqItems(safeJsonParse(String(row.mcq_json ?? "[]")));
    const slots = parsePracticeExamSlots(safeJsonParse(String(row.slots_json ?? "[]"))).map(
      (slot) => ({
        ...slot,
        transparentInput: slot.transparentInput ?? (legacyTransparent ? true : undefined),
      }),
    );
    return c.json({
      subjectId,
      year,
      examNumber,
      published,
      layout,
      mcqCount,
      mcqItems,
      slots,
      pages: (pageRows.rows as Record<string, unknown>[]).map((p) => ({
        pageNumber: Number(p.page_number),
      })),
    });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

app.get("/api/practice-exams/:subjectId/:year/:examNumber/pages/:pageNumber", authMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    await ensurePracticeExamTables(db);
    const user = c.get("user");
    const subjectId = canonicalSubjectId(c.req.param("subjectId"));
    const year = Math.round(Number(c.req.param("year")));
    const examNumber = Math.round(Number(c.req.param("examNumber"))) === 2 ? 2 : 1;
    const pageNumber = Math.round(Number(c.req.param("pageNumber")));
    if (!year || !pageNumber || pageNumber < 1) return c.json({ error: "Invalid request." }, 400);

    if (!isPremiumAccount(user)) {
      return c.json(
        { ...premiumRequiredResponse(), error: "Past practice exams require Premium." },
        403,
      );
    }

    const examRows = await db.execute(sql`
      SELECT id, published FROM practice_exams
      WHERE subject_id = ${subjectId} AND year = ${year} AND exam_number = ${examNumber}
      LIMIT 1
    `);
    const exam = (examRows.rows as Record<string, unknown>[])[0];
    if (!exam) return c.json({ error: "Exam not found." }, 404);
    const published = Number(exam.published) === 1;
    const isAdmin = String(user.email ?? "").toLowerCase() === ADMIN_EMAIL_LC;
    if (!published && !isAdmin) return c.json({ error: "Exam not available." }, 404);

    const pageRows = await db.execute(sql`
      SELECT image_data_url FROM practice_exam_pages
      WHERE exam_id = ${Number(exam.id)} AND page_number = ${pageNumber}
      LIMIT 1
    `);
    const page = (pageRows.rows as Record<string, unknown>[])[0];
    if (!page) return c.json({ error: "Page not found." }, 404);
    return c.json({ pageNumber, imageDataUrl: String(page.image_data_url ?? "") });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

app.get("/api/admin/practice-exams/:subjectId/:year/:examNumber", adminAccessMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    await ensurePracticeExamTables(db);
    const subjectId = canonicalSubjectId(c.req.param("subjectId"));
    const year = Math.round(Number(c.req.param("year")));
    const examNumber = Math.round(Number(c.req.param("examNumber"))) === 2 ? 2 : 1;
    if (!year) return c.json({ error: "Invalid year." }, 400);

    const rows = await db.execute(sql`
      SELECT id, slots_json, published, transparent_inputs, layout, mcq_count, mcq_json
      FROM practice_exams
      WHERE subject_id = ${subjectId} AND year = ${year} AND exam_number = ${examNumber}
      LIMIT 1
    `);
    const row = (rows.rows as Record<string, unknown>[])[0];
    if (!row) {
      const layout = examNumber === 2 && subjectId === "methods" ? "mcq_then_written" : "written";
      const mcqCount = layout === "mcq_then_written" ? 20 : 0;
      return c.json({
        subjectId,
        year,
        examNumber,
        published: false,
        layout,
        mcqCount,
        mcqItems: [],
        slots: [],
        pages: [],
      });
    }

    const pageRows = await db.execute(sql`
      SELECT page_number FROM practice_exam_pages
      WHERE exam_id = ${Number(row.id)}
      ORDER BY page_number ASC
    `);
    const legacyTransparent = Number(row.transparent_inputs ?? 0) === 1;
    const layout = parsePracticeExamLayout(row.layout);
    const mcqCount = parsePracticeExamMcqCount(row.mcq_count, layout);
    const mcqItems = parsePracticeExamMcqItems(safeJsonParse(String(row.mcq_json ?? "[]")));
    const slots = parsePracticeExamSlots(safeJsonParse(String(row.slots_json ?? "[]"))).map(
      (slot) => ({
        ...slot,
        transparentInput: slot.transparentInput ?? (legacyTransparent ? true : undefined),
      }),
    );
    return c.json({
      subjectId,
      year,
      examNumber,
      published: Number(row.published) === 1,
      layout,
      mcqCount,
      mcqItems,
      slots,
      pages: (pageRows.rows as Record<string, unknown>[]).map((p) => ({
        pageNumber: Number(p.page_number),
      })),
    });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

app.get("/api/admin/practice-exams/:subjectId/:year/:examNumber/pages/:pageNumber", adminAccessMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    await ensurePracticeExamTables(db);
    const subjectId = canonicalSubjectId(c.req.param("subjectId"));
    const year = Math.round(Number(c.req.param("year")));
    const examNumber = Math.round(Number(c.req.param("examNumber"))) === 2 ? 2 : 1;
    const pageNumber = Math.round(Number(c.req.param("pageNumber")));
    if (!year || !pageNumber || pageNumber < 1) return c.json({ error: "Invalid request." }, 400);

    const examRows = await db.execute(sql`
      SELECT id FROM practice_exams
      WHERE subject_id = ${subjectId} AND year = ${year} AND exam_number = ${examNumber}
      LIMIT 1
    `);
    const exam = (examRows.rows as Record<string, unknown>[])[0];
    if (!exam) return c.json({ error: "Exam not found." }, 404);

    const pageRows = await db.execute(sql`
      SELECT image_data_url FROM practice_exam_pages
      WHERE exam_id = ${Number(exam.id)} AND page_number = ${pageNumber}
      LIMIT 1
    `);
    const page = (pageRows.rows as Record<string, unknown>[])[0];
    if (!page) return c.json({ error: "Page not found." }, 404);
    return c.json({ pageNumber, imageDataUrl: String(page.image_data_url ?? "") });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

app.put("/api/admin/practice-exams/:subjectId/:year/:examNumber", adminAccessMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    await ensurePracticeExamTables(db);
    const subjectId = canonicalSubjectId(c.req.param("subjectId"));
    const year = Math.round(Number(c.req.param("year")));
    const examNumber = Math.round(Number(c.req.param("examNumber"))) === 2 ? 2 : 1;
    if (!year) return c.json({ error: "Invalid year." }, 400);
    const body = await c.req.json().catch(() => ({}));
    const layout = parsePracticeExamLayout(body?.layout);
    const mcqCount = parsePracticeExamMcqCount(body?.mcqCount, layout);
    const mcqItems = parsePracticeExamMcqItems(body?.mcqItems);
    const slots = parsePracticeExamSlots(body?.slots);
    const published =
      body?.published === true ||
      body?.published === 1 ||
      String(body?.published ?? "").toLowerCase() === "true"
        ? 1
        : 0;
    const examId = await upsertPracticeExamRow(db, subjectId, year, examNumber);
    const now = nowIso();
    await db.execute(sql`
      UPDATE practice_exams
      SET slots_json = ${JSON.stringify(slots)},
        layout = ${layout},
        mcq_count = ${mcqCount},
        mcq_json = ${JSON.stringify(mcqItems)},
        published = ${published},
        updated_at = ${now}
      WHERE id = ${examId}
    `);
    return c.json({
      ok: true,
      examId,
      slotCount: slots.length,
      mcqCount: mcqItems.length,
      published: published === 1,
    });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

app.put("/api/admin/practice-exams/:subjectId/:year/:examNumber/pages/:pageNumber", adminAccessMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    await ensurePracticeExamTables(db);
    const subjectId = canonicalSubjectId(c.req.param("subjectId"));
    const year = Math.round(Number(c.req.param("year")));
    const examNumber = Math.round(Number(c.req.param("examNumber"))) === 2 ? 2 : 1;
    const pageNumber = Math.round(Number(c.req.param("pageNumber")));
    if (!year || !pageNumber || pageNumber < 1) return c.json({ error: "Invalid request." }, 400);

    const body = await c.req.json().catch(() => ({}));
    const imageDataUrl = String(body?.imageDataUrl ?? "").trim();
    if (!imageDataUrl.startsWith("data:image/")) {
      return c.json({ error: "imageDataUrl is required." }, 400);
    }
    const sizeErr = validatePracticeExamPageImageUrl(imageDataUrl);
    if (sizeErr) return c.json({ error: sizeErr }, 400);

    const examId = await upsertPracticeExamRow(db, subjectId, year, examNumber);
    await db.execute(sql`
      INSERT INTO practice_exam_pages (exam_id, page_number, image_data_url)
      VALUES (${examId}, ${pageNumber}, ${imageDataUrl})
      ON CONFLICT (exam_id, page_number)
      DO UPDATE SET image_data_url = EXCLUDED.image_data_url
    `);
    return c.json({ ok: true, pageNumber });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

app.delete("/api/admin/practice-exams/:subjectId/:year/:examNumber", adminAccessMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    await ensurePracticeExamTables(db);
    const subjectId = canonicalSubjectId(c.req.param("subjectId"));
    const year = Math.round(Number(c.req.param("year")));
    const examNumber = Math.round(Number(c.req.param("examNumber"))) === 2 ? 2 : 1;
    if (!year) return c.json({ error: "Invalid year." }, 400);
    await db.execute(sql`
      DELETE FROM practice_exams
      WHERE subject_id = ${subjectId} AND year = ${year} AND exam_number = ${examNumber}
    `);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

// ---- Written ----
app.get("/api/written/:subjectId/:questionKey", authMiddleware, async (c: any) => {
  const user = c.get("user"); const db = c.get("db");
  const rows = await db.execute(sql`
    SELECT response_text, updated_at, ai_correct, ai_score_percent, ai_feedback, ai_marked_at
    FROM written_responses
    WHERE user_id = ${user.id}
      AND subject_id = ${c.req.param("subjectId")}
      AND question_key = ${c.req.param("questionKey")}
    LIMIT 1
  `);
  const row = (rows.rows as any[])[0];
  return c.json({
    response: row
      ? {
          text: String(row.response_text ?? ""),
          updatedAt: String(row.updated_at ?? ""),
        }
      : null,
    aiMark: row?.ai_marked_at
      ? {
          correct: Number(row.ai_correct) === 1,
          scorePercent: row.ai_score_percent != null ? Number(row.ai_score_percent) : null,
          feedback: String(row.ai_feedback ?? ""),
          markedAt: String(row.ai_marked_at ?? ""),
        }
      : null,
  });
});

app.put("/api/written/:subjectId/:questionKey", authMiddleware, async (c: any) => {
  const user = c.get("user"); const db = c.get("db"); const body = await c.req.json();
  const responseText = cleanText(body.responseText, 12000);
  if (!responseText) return c.json({ error: "Response cannot be empty." }, 400);
  await db.execute(sql`INSERT INTO written_responses (user_id, subject_id, question_key, response_text, updated_at) VALUES (${user.id}, ${c.req.param("subjectId")}, ${c.req.param("questionKey")}, ${responseText}, ${nowIso()}) ON CONFLICT(user_id, subject_id, question_key) DO UPDATE SET response_text = EXCLUDED.response_text, updated_at = EXCLUDED.updated_at`);
  return c.json({ ok: true });
});

app.post("/api/written/:subjectId/:questionKey/mark", authMiddleware, async (c: any) => {
  let isHandwritingMark = false;
  let aiReservation: Awaited<ReturnType<typeof beginAiRequest>> | null = null;
  let reservedUsageId: number | null = null;
  let aiStartedAt = 0;
  try {
    const env = c.env as Env;
    if (!openAiConfigured(env)) {
      return c.json({ error: "AI marking is not available right now." }, 503);
    }
    const user = c.get("user");
    const db = c.get("db");
    const body = await c.req.json();
    const subjectId = c.req.param("subjectId");
    const questionKey = c.req.param("questionKey");
    const handwritingImages = collectHandwritingImages(body ?? {});
    isHandwritingMark = handwritingImages.length > 0;

    const q = (body?.question ?? {}) as Record<string, unknown>;
    const questionText = cleanText(String(q.question ?? q.questionText ?? ""), 4000);
    if (!questionText) return c.json({ error: "question.question is required." }, 400);

    const questionType = cleanText(String(q.type ?? "long_answer"), 40) || "long_answer";
    const qt = questionType.toLowerCase();
    const isShortType = qt === "short" || qt === "short_answer";
    const isLongType = qt === "long" || qt === "long_answer";

    if (qt === "mcq") {
      return c.json({ error: "MCQ questions do not use AI marking." }, 400);
    }

    /** Free: no long-answer (typed or drawn). Premium: LA allowed. */
    if (!isPremiumAccount(user) && isLongType) {
      return c.json(
        {
          ...premiumRequiredResponse(),
          error: "Long-answer questions require Premium.",
        },
        403,
      );
    }

    const marksParsed = Math.round(Number(q.marks ?? 2));
    const marks = Number.isFinite(marksParsed) ? Math.max(1, marksParsed) : 2;
    const guidance = q.guidance ? cleanText(String(q.guidance), 2000) : undefined;
    let acceptedAnswers = Array.isArray(q.acceptedAnswers)
      ? q.acceptedAnswers.map((a: unknown) => String(a ?? "").trim()).filter(Boolean).slice(0, 20)
      : undefined;
    const answerParts = Array.isArray(q.answerParts)
      ? (q.answerParts as Record<string, unknown>[]).map((p) => ({
          label: String(p.label ?? "").trim(),
          marks: Number.isFinite(Number(p.marks)) ? Math.round(Number(p.marks)) : undefined,
          acceptedAnswer:
            p.acceptedAnswer != null
              ? String(p.acceptedAnswer).trim()
              : p.accepted_answer != null
                ? String(p.accepted_answer).trim()
                : undefined,
        })).filter((p) => p.label)
      : undefined;
    const partLabels = answerParts?.map((p) => p.label) ?? [];
    const partAccepted = (answerParts ?? [])
      .map((p) => String(p.acceptedAnswer ?? "").trim())
      .filter(Boolean);
    if ((!acceptedAnswers || acceptedAnswers.length === 0) && partAccepted.length) {
      acceptedAnswers = partAccepted;
    } else if (acceptedAnswers && partAccepted.length) {
      acceptedAnswers = [...new Set([...acceptedAnswers, ...partAccepted])];
    }
    const forceAiMarking = q.useAiMarking === true || q.useAiMarking === 1;
    const openAiGate = {
      questionText,
      questionType,
      partLabels,
      acceptedAnswers,
    };

    const subjectContext = await loadSubjectMarkingContext(db, subjectId);
    const markBreakdownRaw = body?.markBreakdown ?? q.markBreakdown;
    const markBreakdown =
      markBreakdownRaw && typeof markBreakdownRaw === "object"
        ? markBreakdownRaw
        : typeof markBreakdownRaw === "string"
          ? safeJsonParse(markBreakdownRaw)
          : undefined;
    const studentSteps = Array.isArray(body?.studentSteps)
      ? body.studentSteps.map((s: unknown) => String(s ?? "").trim()).slice(0, 24)
      : undefined;
    const breakdownMark = Boolean(
      studentSteps?.length &&
        markBreakdown &&
        typeof markBreakdown === "object" &&
        Array.isArray((markBreakdown as { steps?: unknown }).steps) &&
        ((markBreakdown as { steps: unknown[] }).steps.length ?? 0) > 0,
    );

    if (!isPremiumAccount(user)) {
      if (breakdownMark || (handwritingImages.length > 0 && !isShortType)) {
        return c.json(
          {
            ...premiumRequiredResponse(),
            error: "Drawn and mark-breakdown AI require Premium.",
          },
          403,
        );
      }
      if (isShortType) {
        const check = await canRunAiResponse(db, user.id, aiProviderPoolSize(env));
        if (!check.allowed) {
          return c.json(
            {
              ...quotaExceededResponse(check.reason ?? ""),
              error: check.reason,
              code: "ai_response_quota",
            },
            403,
          );
        }
      } else {
        return c.json(
          {
            ...premiumRequiredResponse(),
            error: "Long-answer AI marking requires Premium.",
          },
          403,
        );
      }
    }

    const requestHash = await sha256Key([
      user.id, subjectId, questionKey, body, Math.floor(Date.now() / 30_000),
    ]);
    aiReservation = await beginAiRequest({
      db,
      env,
      requestKey: `written-mark:${requestHash}`,
      userId: user.id,
      route: "/api/written/:subjectId/:questionKey/mark",
      feature: isHandwritingMark ? "handwriting_marking" : "written_marking",
      provider: "model_pool",
      model: isHandwritingMark ? (env.GEMINI_VISION_MODEL || "gemini-2.5-flash") : openAiModel(env),
    });
    aiStartedAt = Date.now();
    if (!isPremiumAccount(user) && isShortType) {
      reservedUsageId = await reserveUsageSlot(
        db,
        user.id,
        USAGE_KIND_AI_RESPONSE,
        `${subjectId}:${questionKey}`,
        startOfUtcDayIso(),
        FREE_DAILY_AI_RESPONSE_LIMIT,
      );
      if (!reservedUsageId) {
        await finishAiRequest({ db, reservation: aiReservation, success: false, errorCode: "free_quota" });
        aiReservation = null;
        return c.json({
          error: `Free accounts get ${FREE_DAILY_AI_RESPONSE_LIMIT} detailed AI responses per day. Type answers for unlimited instant matching and basic feedback, or upgrade to Pro.`,
          code: "ai_response_quota",
        }, 403);
      }
    }

    let result;
    let storedResponseText: string;

    if (breakdownMark) {
      result = await markLongAnswer(env, {
        questionText,
        questionType,
        topic: q.topic ? cleanText(String(q.topic), 240) : undefined,
        marks,
        guidance,
        acceptedAnswers,
        answerParts,
        studentResponse: studentSteps!.join("\n"),
        studentSteps,
        markBreakdown: markBreakdown as { steps: { marks: number; label: string; model?: string }[] },
        subjectContext,
        breakdownMode: true,
      });
      storedResponseText = studentSteps!.join("\n");
    } else if (handwritingImages.length > 0) {
      const imageError = validateMarkingImageUrls(handwritingImages);
      if (imageError) return c.json({ error: imageError }, 400);

      result = await markHandwritingAnswer(env, {
        questionText,
        questionType,
        topic: q.topic ? cleanText(String(q.topic), 240) : undefined,
        marks,
        guidance,
        acceptedAnswers,
        answerParts,
        images: handwritingImages,
        subjectContext,
      });
      storedResponseText = `[handwritten answer — ${handwritingImages.length} image(s)]`;
    } else {
      const responseText = cleanText(body?.responseText, 12000);
      if (!responseText) return c.json({ error: "responseText is required." }, 400);
      const qtMark = questionType.toLowerCase();
      const shortTextAi =
        qtMark === "short" || qtMark === "short_answer";
      const longTextAi = qtMark === "long_answer" || qtMark === "long";
      if (!shortTextAi && !longTextAi) {
        return c.json(
          { error: "AI text marking is only available for short-answer and long-answer questions." },
          400,
        );
      }
      if (longTextAi && !forceAiMarking && !qualifiesForOpenAiMarking(openAiGate)) {
        return c.json(
          {
            error:
              "AI marking is only available for explain, discuss, prove, and similar worded questions.",
          },
          400,
        );
      }
      const studentParts = Array.isArray(body?.studentParts)
        ? body.studentParts.map((p: unknown) => String(p ?? "").trim()).slice(0, 12)
        : undefined;

      result = await markLongAnswer(env, {
        questionText,
        questionType,
        topic: q.topic ? cleanText(String(q.topic), 240) : undefined,
        marks,
        guidance,
        acceptedAnswers,
        answerParts,
        studentResponse: responseText,
        studentParts,
        subjectContext,
      });
      storedResponseText = responseText;
    }

    const now = nowIso();
    await db.execute(sql`
      INSERT INTO written_responses (user_id, subject_id, question_key, response_text, updated_at, ai_correct, ai_score_percent, ai_feedback, ai_marked_at)
      VALUES (${user.id}, ${subjectId}, ${questionKey}, ${storedResponseText}, ${now}, ${result.correct ? 1 : 0}, ${result.scorePercent}, ${result.feedback}, ${now})
      ON CONFLICT(user_id, subject_id, question_key) DO UPDATE SET
        response_text = EXCLUDED.response_text,
        updated_at = EXCLUDED.updated_at,
        ai_correct = EXCLUDED.ai_correct,
        ai_score_percent = EXCLUDED.ai_score_percent,
        ai_feedback = EXCLUDED.ai_feedback,
        ai_marked_at = EXCLUDED.ai_marked_at
    `);

    await finishAiRequest({
      db,
      reservation: aiReservation,
      success: true,
      latencyMs: Date.now() - aiStartedAt,
    });
    aiReservation = null;

    return c.json({
      ok: true,
      mark: {
        correct: result.correct,
        scorePercent: result.scorePercent,
        marksAwarded: result.marksAwarded,
        maxMarks: result.maxMarks,
        feedback: result.feedback,
        correctAnswers: result.correctAnswers,
        partResults: result.partResults,
        stepResults: result.stepResults,
      },
    });
  } catch (e) {
    const db = c.get("db");
    await rollbackUsageSlot(db, reservedUsageId).catch(() => undefined);
    if (aiReservation) {
      await finishAiRequest({
        db,
        reservation: aiReservation,
        success: false,
        latencyMs: aiStartedAt ? Date.now() - aiStartedAt : 0,
        errorCode: e instanceof AiSafetyError ? e.code : "mark_failed",
      }).catch(() => undefined);
    }
    console.error("[written/mark]", errorChain(e));
    if (e instanceof AiSafetyError) {
      return c.json({ error: e.message, code: e.code }, aiSafetyStatus(e) as any);
    }
    return c.json({ error: userFacingMarkError(e, isHandwritingMark) }, 500);
  }
});

app.post("/api/written/:subjectId/:questionKey/solution", authMiddleware, async (c: any) => {
  let aiReservation: Awaited<ReturnType<typeof beginAiRequest>> | null = null;
  let aiStartedAt = 0;
  try {
    const limited = rateLimitResponse(c, "worked-solution", 60);
    if (limited) return limited;
    const env = c.env as Env;
    const user = c.get("user");
    const db = c.get("db");
    const subjectId = c.req.param("subjectId");
    const questionKey = c.req.param("questionKey");
    if (
      !isPremiumAccount(user) &&
      !(await hasAiResponseUsageForRef(db, user.id, `${subjectId}:${questionKey}`))
    ) {
      return c.json(
        {
          error: "Detailed worked steps are included only with an AI-marked response. Continue with instant matching or upgrade to Pro.",
          code: "ai_response_required",
        },
        403,
      );
    }
    if (!openAiConfigured(env)) {
      return c.json({ error: "Worked solutions are not available right now." }, 503);
    }

    const body = await c.req.json();
    const q = (body?.question ?? {}) as Record<string, unknown>;
    const stem = cleanText(String(q.question ?? q.questionText ?? ""), 4000);
    if (!stem) return c.json({ error: "question.question is required." }, 400);

    const passage = q.passage ? cleanText(String(q.passage), 3000) : "";
    const options = Array.isArray(q.options)
      ? q.options.map((option) => cleanText(String(option ?? ""), 500)).filter(Boolean).slice(0, 12)
      : [];
    const optionsBlock = options.length
      ? `\nOptions:\n${options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join("\n")}`
      : "";
    const questionText = `${passage ? `${passage}\n\n` : ""}${stem}${optionsBlock}`;
    const marksParsed = Math.round(Number(q.marks ?? 1));
    const marks = Number.isFinite(marksParsed) ? Math.max(1, marksParsed) : 1;
    const guidance = q.guidance ? cleanText(String(q.guidance), 2000) : undefined;
    const acceptedAnswers = [
      ...(Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : []),
      ...(q.answer != null ? [q.answer] : []),
      ...(Array.isArray(q.answerParts)
        ? (q.answerParts as Record<string, unknown>[]).map((part) =>
            part.acceptedAnswer ?? part.accepted_answer ?? "",
          )
        : []),
    ]
      .map((answer) => cleanText(String(answer ?? ""), 1000))
      .filter(Boolean)
      .slice(0, 20);
    if (!acceptedAnswers.length) {
      return c.json({ error: "A correct answer is required to generate worked steps." }, 400);
    }

    const requestKey = `worked-solution:${await sha256Key([
      subjectId, questionKey, questionText, marks, guidance, acceptedAnswers,
    ])}`;
    const cached = await readCachedAiResult<{ markBreakdown: { steps: unknown[]; source: string } }>(
      db,
      requestKey,
    );
    if (cached) return c.json(cached);
    aiReservation = await beginAiRequest({
      db,
      env,
      requestKey,
      userId: user.id,
      route: "/api/written/:subjectId/:questionKey/solution",
      feature: "worked_solution",
      provider: "model_pool",
      model: openAiModel(env),
    });
    aiStartedAt = Date.now();

    const subjectContext = await loadSubjectMarkingContext(c.get("db"), subjectId);
    const generated = await generateMarkBreakdown(env, {
      questionText,
      topic: q.topic ? cleanText(String(q.topic), 240) : undefined,
      marks,
      guidance,
      acceptedAnswers,
      subjectContext,
    });
    const response = {
      markBreakdown: { steps: generated.steps, source: "ai" },
    };
    await finishAiRequest({
      db,
      reservation: aiReservation,
      success: true,
      result: response,
      latencyMs: Date.now() - aiStartedAt,
    });
    aiReservation = null;
    return c.json(response);
  } catch (e) {
    if (aiReservation) {
      await finishAiRequest({
        db: c.get("db"), reservation: aiReservation, success: false,
        latencyMs: aiStartedAt ? Date.now() - aiStartedAt : 0,
        errorCode: e instanceof AiSafetyError ? e.code : "solution_failed",
      }).catch(() => undefined);
    }
    console.error("[written/solution]", errorChain(e));
    if (e instanceof AiSafetyError) {
      return c.json({ error: e.message, code: e.code }, aiSafetyStatus(e) as any);
    }
    return c.json({ error: userFacingMarkError(e) }, 500);
  }
});

function sanitizeQuestionForHelp(q: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {
    type: q.type != null ? String(q.type).trim() : undefined,
    question: q.question ?? q.questionText,
    topic: q.topic != null ? String(q.topic).trim() : undefined,
    marks: Number.isFinite(Number(q.marks)) ? Math.round(Number(q.marks)) : undefined,
    guidance: q.guidance != null ? String(q.guidance).trim() : undefined,
    passage: q.passage != null ? String(q.passage).trim() : undefined,
  };
  if (Array.isArray(q.options)) {
    out.options = q.options.map((o) => String(o ?? "").trim()).filter(Boolean).slice(0, 12);
  }
  if (Array.isArray(q.answerParts)) {
    out.answerParts = (q.answerParts as Record<string, unknown>[])
      .map((p) => ({
        label: String(p.label ?? "").trim(),
        marks: Number.isFinite(Number(p.marks)) ? Math.round(Number(p.marks)) : undefined,
        placeholder: p.placeholder != null ? String(p.placeholder).trim() : undefined,
      }))
      .filter((p) => p.label);
  }
  const markBreakdownRaw = q.markBreakdown;
  if (markBreakdownRaw && typeof markBreakdownRaw === "object") {
    const mb = markBreakdownRaw as { steps?: unknown[]; source?: string };
    out.markBreakdown = {
      source: mb.source != null ? String(mb.source).trim() : undefined,
      steps: Array.isArray(mb.steps)
        ? mb.steps
            .map((s) => {
              const step = s as Record<string, unknown>;
              return {
                marks: Number.isFinite(Number(step.marks)) ? Math.round(Number(step.marks)) : 1,
                label: String(step.label ?? "").trim(),
              };
            })
            .filter((s) => s.label)
        : undefined,
    };
  }
  return out;
}

app.post("/api/written/:subjectId/:questionKey/help", authMiddleware, async (c: any) => {
  let aiReservation: Awaited<ReturnType<typeof beginAiRequest>> | null = null;
  let aiStartedAt = 0;
  try {
    const limited = rateLimitResponse(c, "question-help", 40);
    if (limited) return limited;
    const env = c.env as Env;
    if (!openAiConfigured(env)) {
      return c.json(
        { error: "Question help is not configured (GEMINI_API_KEY missing)." },
        503,
      );
    }
    const user = c.get("user");
    const db = c.get("db");
    if (!isPremiumAccount(user)) {
      return c.json(premiumRequiredResponse(), 403);
    }
    const body = await c.req.json();
    const q = (body?.question ?? {}) as Record<string, unknown>;
    const questionText = cleanText(String(q.question ?? q.questionText ?? ""), 4000);
    if (!questionText) return c.json({ error: "question.question is required." }, 400);

    const messagesRaw = Array.isArray(body?.messages) ? body.messages : [];
    const messages = messagesRaw
      .filter((m: unknown) => m && typeof m === "object")
      .map((m: Record<string, unknown>) => ({
        role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
        content: cleanText(String(m.content ?? ""), 600),
      }))
      .filter((m: { content: string }) => m.content)
      .slice(-6);

    const subjectId = c.req.param("subjectId");
    const requestKey = `question-help:${await sha256Key([
      user.id, subjectId, c.req.param("questionKey"), sanitizeQuestionForHelp({ ...q, question: questionText }),
      messages, Math.floor(Date.now() / 30_000),
    ])}`;
    aiReservation = await beginAiRequest({
      db,
      env,
      requestKey,
      userId: user.id,
      route: "/api/written/:subjectId/:questionKey/help",
      feature: "question_help",
      provider: "model_pool",
      model: openAiModel(env),
    });
    aiStartedAt = Date.now();
    const subjectContext = await loadSubjectMarkingContext(c.get("db"), subjectId);
    const result = await questionHelpChat(env, {
      subjectId,
      question: sanitizeQuestionForHelp({ ...q, question: questionText }),
      messages,
      subjectContext,
    });
    await finishAiRequest({
      db, reservation: aiReservation, success: true,
      latencyMs: Date.now() - aiStartedAt,
    });
    aiReservation = null;
    return c.json(result);
  } catch (e) {
    if (aiReservation) {
      await finishAiRequest({
        db: c.get("db"), reservation: aiReservation, success: false,
        latencyMs: aiStartedAt ? Date.now() - aiStartedAt : 0,
        errorCode: e instanceof AiSafetyError ? e.code : "help_failed",
      }).catch(() => undefined);
    }
    console.error("[written/help]", errorChain(e));
    if (e instanceof AiSafetyError) {
      return c.json({ error: e.message, code: e.code }, aiSafetyStatus(e) as any);
    }
    const msg = userFacingHelpError(e);
    const status = /\b429\b/.test(errorChain(e).toLowerCase()) ? 429 : 500;
    return c.json({ error: msg }, status);
  }
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
const SMOKE_TEST_EMAIL_SUFFIX = "@nodent-smoke.test";
const notSmokeTestUser = notIlike(users.email, `%${SMOKE_TEST_EMAIL_SUFFIX}`);
const DEMO_TEST_EMAIL_SUFFIXES = ["@nodent-demo.test"] as const;
const notDemoTestUser = and(
  ...DEMO_TEST_EMAIL_SUFFIXES.map((suf) => notIlike(users.email, `%${suf}`)),
  notIlike(users.username, "demo%"),
  notIlike(users.username, "test%"),
);

const PSEUDONYM_FIRST_NAMES = [
  "Ava",
  "Noah",
  "Mia",
  "Leo",
  "Zoe",
  "Aria",
  "Ethan",
  "Liam",
  "Sofia",
  "Lucas",
  "Isla",
  "Oliver",
  "Amelia",
  "Jack",
  "Ella",
  "James",
  "Grace",
  "Henry",
  "Chloe",
  "Sam",
] as const;

const PSEUDONYM_LAST_NAMES = [
  "Nguyen",
  "Smith",
  "Patel",
  "Wong",
  "Taylor",
  "Brown",
  "Wilson",
  "Singh",
  "Khan",
  "Chen",
  "Martin",
  "Harris",
  "Walker",
  "Young",
  "Scott",
  "King",
  "Lee",
  "White",
  "Clark",
  "Wright",
] as const;

function isDemoLikeEmail(email: unknown): boolean {
  const e = String(email ?? "").toLowerCase().trim();
  if (!e) return false;
  if (e.endsWith(SMOKE_TEST_EMAIL_SUFFIX)) return true;
  for (const suf of DEMO_TEST_EMAIL_SUFFIXES) {
    if (e.endsWith(String(suf).toLowerCase())) return true;
  }
  return false;
}

function realisticPseudonym(userId: unknown): string {
  const id = Math.abs(Math.trunc(Number(userId) || 0));
  const first = PSEUDONYM_FIRST_NAMES[id % PSEUDONYM_FIRST_NAMES.length] ?? "Student";
  const last = PSEUDONYM_LAST_NAMES[Math.floor(id / 7) % PSEUDONYM_LAST_NAMES.length] ?? "User";
  return `${first} ${last}`;
}

function publicLeaderboardUsername(userId: unknown, email: unknown, username: unknown): string {
  const raw = String(username ?? "").trim();
  if (isDemoLikeEmail(email) || /^demo\b/i.test(raw) || /^test\b/i.test(raw)) {
    return realisticPseudonym(userId);
  }
  return raw || realisticPseudonym(userId);
}

app.get("/api/admin/users", adminAccessMiddleware, async (c: any) => {
  const db = c.get("db");
  const result = await db.execute(sql`
    SELECT
      u.id,
      u.username,
      u.email,
      u.created_at,
      COUNT(qa.id)::int AS questions_completed
    FROM users AS u
    LEFT JOIN question_attempts AS qa ON qa.user_id = u.id
    WHERE LOWER(COALESCE(u.email, '')) NOT LIKE ${`%${SMOKE_TEST_EMAIL_SUFFIX}`}
      AND LOWER(COALESCE(u.email, '')) NOT LIKE '%@nodent-demo.test'
      AND LOWER(COALESCE(u.username, '')) NOT LIKE 'demo%'
      AND LOWER(COALESCE(u.username, '')) NOT LIKE 'test%'
    GROUP BY u.id, u.username, u.email, u.created_at
    ORDER BY u.created_at DESC, u.id DESC
  `);
  const rows = (result.rows as Array<Record<string, unknown>>).map((row) => ({
    id: Number(row.id),
    username: String(row.username ?? ""),
    email: String(row.email ?? ""),
    createdAt: String(row.created_at ?? ""),
    questionsCompleted: Number(row.questions_completed ?? 0),
  }));
  return c.json({ users: rows, total: rows.length });
});

app.get("/api/admin/feedback", adminAccessMiddleware, async (c: any) => {
  const db = c.get("db");
  const limitRaw = Number(c.req.query("limit") ?? 50);
  const offsetRaw = Number(c.req.query("offset") ?? 0);
  const limit = Number.isFinite(limitRaw)
    ? Math.min(Math.max(Math.trunc(limitRaw), 1), 200)
    : 50;
  const offset = Number.isFinite(offsetRaw) ? Math.max(Math.trunc(offsetRaw), 0) : 0;

  const rows = await db
    .select({
      id: userFeedback.id,
      userId: userFeedback.userId,
      authorName: userFeedback.authorName,
      authorEmail: userFeedback.authorEmail,
      message: userFeedback.message,
      rating: userFeedback.rating,
      vceStudent: userFeedback.vceStudent,
      featuresStandOut: userFeedback.featuresStandOut,
      createdAt: userFeedback.createdAt,
    })
    .from(userFeedback)
    .orderBy(desc(userFeedback.createdAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db.execute(
    sql`SELECT COUNT(*)::int AS count FROM user_feedback`,
  );
  const total = Number((countResult.rows?.[0] as { count?: number })?.count ?? 0);

  return c.json({
    feedback: rows.map((row) => ({
      id: Number(row.id),
      userId: row.userId != null ? Number(row.userId) : null,
      authorName: String(row.authorName ?? "").trim() || "Anonymous",
      authorEmail: row.authorEmail != null ? String(row.authorEmail) : null,
      message: String(row.message ?? ""),
      rating: row.rating != null ? Number(row.rating) : null,
      vceStudent: row.vceStudent != null ? String(row.vceStudent) : null,
      featuresStandOut:
        row.featuresStandOut != null ? String(row.featuresStandOut) : null,
      createdAt: String(row.createdAt ?? ""),
    })),
    total,
    limit,
    offset,
  });
});

app.get("/api/admin/stats", adminAccessMiddleware, async (c: any) => {
  const db = c.get("db");
  const countResult = await db.execute(
    sql`SELECT COUNT(*)::int AS count FROM users WHERE LOWER(email) NOT LIKE ${`%${SMOKE_TEST_EMAIL_SUFFIX}`}`,
  );
  const totalUsers = Number((countResult.rows?.[0] as { count?: number })?.count ?? 0);
  return c.json({ totalUsers });
});

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
    const answerImgs = safeJsonParse(
      (row as { answerImageUrls?: string | null }).answerImageUrls ?? null,
    ) as string[] | undefined;
    const parts = safeJsonParse(row.answerPartsJson) as unknown[] | undefined;
    const aiRaw = (row as { aiMarkingEnabled?: number | null }).aiMarkingEnabled;
    const useAiMarking =
      aiRaw === 0 ? false : aiRaw === 1 ? true : undefined;
    return {
      id: String(row.id),
      subjectId: row.subjectId,
      subjectName: row.subjectId,
      type: row.type,
      topic: row.topic ?? "General",
      question: row.question,
      imageUrls: imgs,
      answerImageUrls: answerImgs,
      options: opts,
      correctAnswer: row.answer || undefined,
      acceptedAnswers: normalizedAcc,
      answerParts: Array.isArray(parts) ? parts : undefined,
      marks: typeof row.marks === "number" ? row.marks : 1,
      guidance: row.guidance || undefined,
      passage: row.passage || undefined,
      useAiMarking,
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
    await db.execute(sql`DELETE FROM english_prompts WHERE id IN (${sqlIntInList(ids)})`);
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
    const promptIdLookup = Number(c.req.query("promptId"));
    if (Number.isFinite(promptIdLookup) && promptIdLookup > 0) {
      const one = await db.execute(sql`
        SELECT p.id, p.prompt_text, p.section, b.id AS book_id, b.title AS book_title
        FROM english_prompts p
        JOIN english_books b ON b.id = p.book_id
        WHERE p.id = ${promptIdLookup}
        LIMIT 1
      `);
      const row = (one.rows as any[])[0];
      if (!row) {
        return c.json({ prompts: [] });
      }
      return c.json({
        prompts: [
          {
            id: Number(row.id),
            bookId: Number(row.book_id),
            bookTitle: String(row.book_title || ""),
            prompt: String(row.prompt_text || ""),
            section: normalizeEnglishSection(row.section),
          },
        ],
      });
    }
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
    const customPrompt = cleanText(body?.customPrompt ?? body?.promptText, 6000);
    const responseTypeRaw = cleanText(body?.responseType, 40).toLowerCase();
    const responseType = responseTypeRaw === "paragraph" ? "paragraph" : "essay";
    const responseText = cleanText(body?.responseText, 20000);
    const isPublic = Boolean(body?.isPublic);
    const imageUrls = Array.isArray(body?.imageUrls)
      ? body.imageUrls.map((u: unknown) => String(u ?? "").trim()).filter(Boolean).slice(0, 8)
      : [];

    if (!responseText && imageUrls.length === 0) {
      return c.json({ error: "Provide your essay text or upload a file." }, 400);
    }

    let resolvedPromptId: number | null = null;
    if (Number.isFinite(promptId) && promptId > 0) {
      const exists = await db
        .select({ id: englishPrompts.id })
        .from(englishPrompts)
        .where(eq(englishPrompts.id, promptId))
        .limit(1);
      if (!exists.length) return c.json({ error: "Prompt not found." }, 404);
      resolvedPromptId = promptId;
    }

    const imageUrlsJson = imageUrls.length ? JSON.stringify(imageUrls) : null;
    const now = nowIso();
    const inserted = await db.execute(sql`
      INSERT INTO english_responses (
        prompt_id, user_id, response_type, response_text, image_urls,
        custom_prompt_text, is_public, created_at, updated_at
      )
      VALUES (
        ${resolvedPromptId}, ${user.id}, ${responseType}, ${responseText || ""}, ${imageUrlsJson},
        ${customPrompt || null}, ${isPublic ? 1 : 0}, ${now}, ${now}
      )
      RETURNING id
    `);
    const responseId = Number((inserted.rows as any[])[0]?.id ?? 0);

    const env = c.env as Env;
    const aiConfigured = englishAiConfigured(env);
    let aiScore: Awaited<ReturnType<typeof runEnglishAiScore>> = null;
    let aiScoringPending = false;
    let aiScoringError: string | null = null;
    let premiumBlocked = false;
    let premiumMessage: string | null = null;
    let canAiScore = false;
    let englishUsageId: number | null = null;
    if (responseId > 0 && responseText.length >= 20 && aiConfigured) {
      if (isPremiumAccount(user)) {
        canAiScore = true;
      } else {
        const check = await canRunEnglishAiMark(db, user.id);
        canAiScore = check.allowed;
        if (canAiScore) {
          englishUsageId = await reserveUsageSlot(
            db,
            user.id,
            USAGE_KIND_ENGLISH_ESSAY_AI,
            String(responseId),
            new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
            FREE_ENGLISH_ESSAY_LIMIT,
          );
          canAiScore = Boolean(englishUsageId);
          if (!canAiScore) {
            premiumBlocked = true;
            premiumMessage = "Free accounts get 1 AI-marked English essay every 3 days.";
          }
        }
        if (!check.allowed) {
          premiumBlocked = true;
          premiumMessage =
            check.reason ??
            "Free accounts get 1 AI-marked English essay every 3 days.";
        }
      }
    }
    if (canAiScore) {
      const afterScore = async () => {
        try {
          const result = await runEnglishAiScore(db, env, responseId, user.id);
          if (!result) await rollbackUsageSlot(db, englishUsageId);
          return result;
        } catch (error) {
          await rollbackUsageSlot(db, englishUsageId);
          throw error;
        }
      };
      try {
        aiScore = await afterScore();
      } catch (err) {
        aiScoringError = err instanceof AiSafetyError
          ? err.message
          : englishAiUserMessage(err);
        console.error("[english/responses POST ai-score]", errorChain(err));
      }
    }

    return c.json({
      ok: true,
      id: responseId || undefined,
      aiScore,
      aiScoringPending,
      aiScoringError,
      aiConfigured,
      premiumBlocked,
      premiumMessage,
    });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

app.get("/api/english/responses/:id", authMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    const user = c.get("user");
    const responseId = Number(c.req.param("id"));
    if (!Number.isFinite(responseId) || responseId <= 0) {
      return c.json({ error: "response id is required." }, 400);
    }

    const rows = await db.execute(sql`
      SELECT r.id, r.prompt_id, r.user_id, r.response_type, r.response_text, r.image_urls,
             r.custom_prompt_text, r.updated_at, r.ai_score, r.ai_feedback, r.ai_criteria_json,
             r.ai_highlights_json, r.ai_scored_at, r.ai_scoring_status,
             r.ai_scoring_error, r.ai_scoring_started_at,
             p.prompt_text, p.section, u.username
      FROM english_responses r
      LEFT JOIN english_prompts p ON p.id = r.prompt_id
      JOIN users u ON u.id = r.user_id
      WHERE r.id = ${responseId}
      LIMIT 1
    `);
    const row = (rows.rows as Record<string, unknown>[])[0];
    if (!row) return c.json({ error: "Response not found." }, 404);

    const isOwner = Number(row.user_id) === Number(user.id);
    const isAdmin = String(user.email ?? "").toLowerCase() === ADMIN_EMAIL_LC;
    if (!isOwner && !isAdmin) {
      return c.json({ error: "Not allowed to view this response." }, 403);
    }

    return c.json({ response: mapEnglishResponseRow(row) });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

app.get("/api/english/responses", authMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    const user = c.get("user");
    const mineOnly = String(c.req.query("mine") ?? "").trim() === "1";

    if (mineOnly) {
      const rows = await db.execute(sql`
        SELECT r.id, r.prompt_id, r.user_id, r.response_type, r.response_text, r.image_urls,
               r.custom_prompt_text, r.updated_at, r.ai_score, r.ai_feedback, r.ai_criteria_json,
               r.ai_highlights_json, r.ai_scored_at,
               p.prompt_text, p.section, u.username
        FROM english_responses r
        LEFT JOIN english_prompts p ON p.id = r.prompt_id
        JOIN users u ON u.id = r.user_id
        WHERE r.user_id = ${user.id}
        ORDER BY r.updated_at DESC
        LIMIT 100
      `);
      return c.json({
        responses: (rows.rows as Record<string, unknown>[]).map(mapEnglishResponseRow),
      });
    }

    const promptIdFilter = Number(c.req.query("promptId"));
    let section = normalizeEnglishSection(c.req.query("section"));
    let bookId = Number(c.req.query("bookId"));
    let matchingPromptIds: number[] | null = null;
    let promptMeta: {
      id: number;
      prompt: string;
      section: "A" | "B" | "C";
      bookId: number | null;
    } | null = null;

    if (Number.isFinite(promptIdFilter) && promptIdFilter > 0) {
      const anchorRes = await db.execute(sql`
        SELECT p.id, p.prompt_text, p.section, p.book_id
        FROM english_prompts p
        WHERE p.id = ${promptIdFilter}
        LIMIT 1
      `);
      const anchor = (anchorRes.rows as any[])[0];
      if (!anchor) {
        return c.json({ responses: [], prompt: null });
      }
      section = normalizeEnglishSection(anchor.section);
      bookId = Number(anchor.book_id);
      promptMeta = {
        id: promptIdFilter,
        prompt: String(anchor.prompt_text ?? ""),
        section,
        bookId: Number.isFinite(bookId) && bookId > 0 ? bookId : null,
      };
      const anchorKey = normalizeEnglishPromptKey(anchor.prompt_text);
      const scopePrompts =
        section === "A"
          ? Number.isFinite(bookId) && bookId > 0
            ? await db.execute(sql`
                SELECT p.id, p.prompt_text
                FROM english_prompts p
                WHERE p.book_id = ${bookId}
                  AND LEFT(UPPER(TRIM(REGEXP_REPLACE(COALESCE(p.section, ''), '^SECTION\\s*', '', 'i'))), 1) = 'A'
              `)
            : await db.execute(sql`
                SELECT p.id, p.prompt_text
                FROM english_prompts p
                WHERE LEFT(UPPER(TRIM(REGEXP_REPLACE(COALESCE(p.section, ''), '^SECTION\\s*', '', 'i'))), 1) = 'A'
              `)
          : await db.execute(sql`
              SELECT p.id, p.prompt_text
              FROM english_prompts p
              WHERE LEFT(UPPER(TRIM(REGEXP_REPLACE(COALESCE(p.section, ''), '^SECTION\\s*', '', 'i'))), 1) = UPPER(${section})
            `);
      matchingPromptIds = (scopePrompts.rows as any[])
        .filter((row) => normalizeEnglishPromptKey(row.prompt_text) === anchorKey)
        .map((row) => Number(row.id))
        .filter((id) => Number.isFinite(id) && id > 0);
      if (!matchingPromptIds.length) {
        matchingPromptIds = [promptIdFilter];
      }
    }

    const promptIdClause =
      matchingPromptIds?.length
        ? sql`AND r.prompt_id IN (${sql.join(
            matchingPromptIds.map((id) => sql`${id}`),
            sql`, `,
          )})`
        : sql``;

    const rows =
      section === "A"
        ? Number.isFinite(bookId) && bookId > 0
          ? await db.execute(sql`
              SELECT r.id, r.prompt_id, r.user_id, r.response_type, r.response_text, r.image_urls, r.updated_at,
                     r.ai_score, r.ai_feedback, r.ai_scored_at,
                     p.prompt_text, p.section, u.username
              FROM english_responses r
              JOIN english_prompts p ON p.id = r.prompt_id
              JOIN english_books b ON b.id = p.book_id
              JOIN users u ON u.id = r.user_id
              WHERE b.id = ${bookId} AND LEFT(UPPER(TRIM(REGEXP_REPLACE(COALESCE(p.section, ''), '^SECTION\\s*', '', 'i'))), 1) = 'A'
              ${promptIdClause}
              ORDER BY r.updated_at DESC
            `)
          : await db.execute(sql`
              SELECT r.id, r.prompt_id, r.user_id, r.response_type, r.response_text, r.image_urls, r.updated_at,
                     r.ai_score, r.ai_feedback, r.ai_scored_at,
                     p.prompt_text, p.section, u.username
              FROM english_responses r
              JOIN english_prompts p ON p.id = r.prompt_id
              JOIN users u ON u.id = r.user_id
              WHERE LEFT(UPPER(TRIM(REGEXP_REPLACE(COALESCE(p.section, ''), '^SECTION\\s*', '', 'i'))), 1) = 'A'
              ${promptIdClause}
              ORDER BY r.updated_at DESC
            `)
        : await db.execute(sql`
            SELECT r.id, r.prompt_id, r.user_id, r.response_type, r.response_text, r.image_urls, r.updated_at,
                   r.ai_score, r.ai_feedback, r.ai_scored_at,
                   p.prompt_text, p.section, u.username
            FROM english_responses r
            JOIN english_prompts p ON p.id = r.prompt_id
            JOIN users u ON u.id = r.user_id
            WHERE LEFT(UPPER(TRIM(REGEXP_REPLACE(COALESCE(p.section, ''), '^SECTION\\s*', '', 'i'))), 1) = UPPER(${section})
            ${promptIdClause}
            ORDER BY r.updated_at DESC
          `);

    return c.json({
      prompt: promptMeta,
      responses: (rows.rows as any[]).map((r) => mapEnglishResponseRow(r)),
    });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

app.post("/api/english/responses/:id/ai-score", authMiddleware, async (c: any) => {
  try {
    const env = c.env as Env;
    if (!englishAiConfigured(env)) {
      return c.json({ error: "AI scoring is not configured (GEMINI_API_KEY or OPENAI_API_KEY missing)." }, 503);
    }
    const db = c.get("db");
    const user = c.get("user");
    const responseId = Number(c.req.param("id"));
    if (!Number.isFinite(responseId) || responseId <= 0) {
      return c.json({ error: "response id is required." }, 400);
    }

    const target = await db
      .select({ userId: englishResponses.userId, aiScoredAt: englishResponses.aiScoredAt })
      .from(englishResponses)
      .where(eq(englishResponses.id, responseId))
      .limit(1);
    if (!target.length) return c.json({ error: "Response not found." }, 404);

    const isOwner = Number(target[0].userId) === Number(user.id);
    const isAdmin = String(user.email ?? "").toLowerCase() === ADMIN_EMAIL_LC;
    if (!isOwner && !isAdmin) {
      return c.json({ error: "Not allowed to score this response." }, 403);
    }
    if (target[0].aiScoredAt) {
      return c.json({ ok: true, alreadyScored: true, aiScoringPending: false });
    }

    let englishUsageId: number | null = null;
    let ownsUsageReservation = false;
    if (!isPremiumAccount(user)) {
      const usageSince = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const existingReservation = await hasUsageForRefSince(
        db, user.id, USAGE_KIND_ENGLISH_ESSAY_AI, String(responseId), usageSince,
      );
      if (!existingReservation) {
        const check = await canRunEnglishAiMark(db, user.id);
        if (!check.allowed) {
          return c.json({ ...premiumRequiredResponse(), error: check.reason ?? premiumRequiredResponse().error }, 403);
        }
        englishUsageId = await reserveUsageSlot(
          db,
          user.id,
          USAGE_KIND_ENGLISH_ESSAY_AI,
          String(responseId),
          usageSince,
          FREE_ENGLISH_ESSAY_LIMIT,
        );
        ownsUsageReservation = Boolean(englishUsageId);
        if (!englishUsageId) {
          return c.json({ error: "Free English AI marking limit reached.", code: "ai_response_quota" }, 429);
        }
      }
    }

    const afterScore = async () => {
      try {
        const result = await runEnglishAiScore(db, env, responseId, user.id);
        if (!result && ownsUsageReservation) await rollbackUsageSlot(db, englishUsageId);
        return result;
      } catch (error) {
        if (ownsUsageReservation) await rollbackUsageSlot(db, englishUsageId);
        throw error;
      }
    };
    const result = await afterScore();
    if (!result) return c.json({ error: "Could not score response (text too short or missing)." }, 400);
    return c.json({ ok: true, aiScore: result });
  } catch (e) {
    console.error("[english/responses ai-score]", errorChain(e));
    if (e instanceof AiSafetyError) {
      return c.json({ error: e.message, code: e.code }, aiSafetyStatus(e) as any);
    }
    return c.json({ error: englishAiUserMessage(e) }, 500);
  }
});

/** Shared essays: anonymous feed of public, AI-scored responses. */
app.get("/api/english/shared", authMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    const user = c.get("user");
    const limitRaw = Number(c.req.query("limit") ?? 30);
    const offsetRaw = Number(c.req.query("offset") ?? 0);
    const limit = Number.isFinite(limitRaw) ? Math.min(60, Math.max(1, Math.floor(limitRaw))) : 30;
    const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0;

    const rows = await db.execute(sql`
      SELECT r.id, r.prompt_id, r.user_id, r.response_type, r.response_text, r.image_urls,
             r.custom_prompt_text, r.updated_at, r.ai_score, r.ai_feedback, r.ai_criteria_json,
             r.ai_highlights_json, r.ai_scored_at, r.is_public,
             p.prompt_text, p.section
      FROM english_responses r
      LEFT JOIN english_prompts p ON p.id = r.prompt_id
      WHERE r.is_public = 1
        AND r.ai_scored_at IS NOT NULL
        AND r.ai_score IS NOT NULL
        AND r.user_id <> ${user.id}
      ORDER BY r.updated_at DESC
      LIMIT ${limit}
      OFFSET ${offset}
    `);

    // Anonymous: do not include usernames/userIds for others.
    const responses = (rows.rows as Record<string, unknown>[])
      .map((r) => {
        const mapped = mapEnglishResponseRow(r);
        return {
          ...mapped,
          userId: 0,
          username: "Student",
        };
      });
    return c.json({ responses, limit, offset });
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
  const topic = cleanText(String(body.topic || "General"), 240);
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

  let answerImageUrlsJson: string | null = null;
  if (Array.isArray(body.answerImageUrls)) {
    const urls = body.answerImageUrls
      .map((u: unknown) => String(u ?? "").trim())
      .filter(Boolean)
      .slice(0, 6);
    if (urls.length) answerImageUrlsJson = JSON.stringify(urls);
  } else if (body.answer_image_urls_json != null) {
    const imgs = parseFlexibleStringArray(body.answer_image_urls_json);
    if (imgs?.length) answerImageUrlsJson = JSON.stringify(imgs.slice(0, 6));
  }

  const answerRaw = body.correctAnswer ?? body.answer;
  const answer = answerRaw ? cleanText(String(answerRaw), 500) : null;
  const marksDefault = type === "mcq" ? 1 : 2;
  const marksParsed = Math.round(Number(body.marks ?? marksDefault));
  let marks = Number.isFinite(marksParsed)
    ? Math.max(1, marksParsed)
    : marksDefault;

  let aiMarkingEnabled: number | null = null;
  if (body.useAiMarking != null) {
    aiMarkingEnabled = body.useAiMarking === false || body.useAiMarking === 0 ? 0 : 1;
  } else if (body.ai_marking_enabled != null) {
    const n = Number(body.ai_marking_enabled);
    aiMarkingEnabled = n === 0 ? 0 : 1;
  }

  let answerPartsJson: string | null = null;
  if (Array.isArray(body.answerParts)) {
    answerPartsJson = JSON.stringify(body.answerParts);
  } else if (body.answer_parts_json != null) {
    const raw = body.answer_parts_json;
    if (typeof raw === "string" && raw.trim()) answerPartsJson = raw.trim();
    else if (Array.isArray(raw)) answerPartsJson = JSON.stringify(raw);
  }

  let markBreakdownJson: string | null = null;
  if (body.markBreakdown != null) {
    markBreakdownJson =
      typeof body.markBreakdown === "string"
        ? body.markBreakdown.trim()
        : JSON.stringify(body.markBreakdown);
  } else if (body.mark_breakdown_json != null) {
    const raw = body.mark_breakdown_json;
    if (typeof raw === "string" && raw.trim()) markBreakdownJson = raw.trim();
    else if (raw && typeof raw === "object") markBreakdownJson = JSON.stringify(raw);
  }

  if (answerPartsJson) {
    try {
      const parts = JSON.parse(answerPartsJson) as Array<{ marks?: unknown }>;
      if (Array.isArray(parts) && parts.length >= 2) {
        const partSum = parts.reduce((sum, p) => {
          const n = Math.round(Number(p?.marks));
          return sum + (Number.isFinite(n) && n > 0 ? n : 1);
        }, 0);
        if (partSum > 0) marks = Math.max(marks, partSum);
      }
    } catch {
      /* keep marks from body */
    }
  }

  return {
    subjectId,
    type,
    question,
    topic,
    passage,
    guidance,
    optionsJson,
    acceptedAnswersJson,
    answerPartsJson,
    markBreakdownJson,
    imageUrlsJson,
    answerImageUrlsJson,
    answer,
    marks,
    aiMarkingEnabled,
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
  const existingId = await findExistingQuestionByStem(db, p.subjectId, p.question);
  if (existingId) throw new DuplicateQuestionError();

  try {
    const result = await db
      .insert(customQuestions)
      .values({
        subjectId: p.subjectId,
        type: p.type,
        topic: p.topic,
        question: p.question,
        imageUrls: p.imageUrlsJson,
        answerImageUrls: p.answerImageUrlsJson,
        options: p.optionsJson,
        answer: p.answer,
        acceptedAnswers: p.acceptedAnswersJson,
        answerPartsJson: p.answerPartsJson,
        markBreakdownJson: p.markBreakdownJson,
        guidance: p.guidance,
        passage: p.passage,
        marks: p.marks,
        aiMarkingEnabled: p.aiMarkingEnabled,
        createdAt: nowIso(),
      })
      .returning({ id: customQuestions.id });
    return Number(result[0].id);
  } catch (e: unknown) {
    if (isDuplicateQuestionDbError(e)) throw new DuplicateQuestionError();
    throw e;
  }
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
    const p = parseCustomQuestionPayload(body);
    const existingId = await findExistingQuestionByStem(db, p.subjectId, p.question);
    if (existingId) {
      return c.json({ error: "A question with this text already exists for this subject." }, 409);
    }
    const id = await insertCustomQuestionRow(db, body);
    return c.json({ ok: true, id });
  } catch (e: unknown) {
    if (isDuplicateQuestionDbError(e)) {
      return c.json({ error: "A question with this text already exists for this subject." }, 409);
    }
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
  if (body.passage !== undefined) {
    updates.passage = body.passage ? cleanText(body.passage, 3000) : null;
  }
  if (body.guidance != null) {
    updates.guidance = body.guidance ? cleanText(body.guidance, 500) : null;
  }
  if (body.marks != null) {
    updates.marks = Math.max(1, Math.round(Number(body.marks ?? 1)));
  }
  if (body.useAiMarking != null) {
    updates.aiMarkingEnabled = body.useAiMarking === false || body.useAiMarking === 0 ? 0 : 1;
  } else if (body.ai_marking_enabled != null) {
    const n = Number(body.ai_marking_enabled);
    updates.aiMarkingEnabled = n === 0 ? 0 : 1;
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
    if (urls.length) {
      const imageError = validateStorableImageUrls(urls);
      if (imageError) {
        return c.json({ error: imageError }, 400);
      }
      updates.imageUrls = JSON.stringify(urls);
    } else {
      updates.imageUrls = null;
    }
  } else if (body.image_urls_json != null) {
    const imgs = parseFlexibleStringArray(body.image_urls_json);
    updates.imageUrls = imgs?.length ? JSON.stringify(imgs.slice(0, 6)) : null;
  }
  if (Array.isArray(body.answerImageUrls)) {
    const urls = body.answerImageUrls
      .map((u: unknown) => String(u ?? "").trim())
      .filter(Boolean)
      .slice(0, 6);
    if (urls.length) {
      const imageError = validateStorableImageUrls(urls);
      if (imageError) {
        return c.json({ error: imageError }, 400);
      }
      updates.answerImageUrls = JSON.stringify(urls);
    } else {
      updates.answerImageUrls = null;
    }
  } else if (body.answer_image_urls_json != null) {
    const imgs = parseFlexibleStringArray(body.answer_image_urls_json);
    updates.answerImageUrls = imgs?.length ? JSON.stringify(imgs.slice(0, 6)) : null;
  }
  if (body.answerParts === null) {
    updates.answerPartsJson = null;
  } else if (Array.isArray(body.answerParts)) {
    updates.answerPartsJson = JSON.stringify(body.answerParts);
  } else if (body.answer_parts_json != null) {
    const raw = body.answer_parts_json;
    if (typeof raw === "string" && raw.trim()) updates.answerPartsJson = raw.trim();
    else if (Array.isArray(raw)) updates.answerPartsJson = JSON.stringify(raw);
  }
  if (!Object.keys(updates).length) {
    return c.json({ error: "No updatable fields provided." }, 400);
  }

  const db = c.get("db");
  const questionId = Number(c.req.param("id"));
  if (!Number.isFinite(questionId) || questionId <= 0) {
    return c.json({ error: "Invalid question id." }, 400);
  }

  try {
    await db
      .update(customQuestions)
      .set(updates)
      .where(eq(customQuestions.id, questionId));
    return c.json({ ok: true });
  } catch (e: unknown) {
    const msg = errorChain(e);
    console.error("[admin/questions PUT]", questionId, msg);
    if (/payload too large|query too large|statement too large/i.test(msg)) {
      return c.json(
        {
          error:
            "Image data is too large. Crop the figure tighter or use a smaller screenshot.",
        },
        400,
      );
    }
    return c.json({ error: msg || "Failed to update question." }, 500);
  }
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
  let skipped = 0;
  const errors: { index: number; message: string }[] = [];
  const stemKeys = await loadCustomQuestionStemKeys(db);
  for (let i = 0; i < rows.length; i++) {
    try {
      const p = parseCustomQuestionPayload(rows[i] as Record<string, unknown>);
      const stemKey = customQuestionImportKey(
        p.subjectId,
        p.question,
        rows[i] as Record<string, unknown>,
      );
      if (stemKey && stemKeys.has(stemKey)) {
        skipped++;
        continue;
      }
      await insertCustomQuestionRow(db, rows[i] as Record<string, unknown>);
      if (stemKey) stemKeys.add(stemKey);
      imported++;
    } catch (e: unknown) {
      if (e instanceof DuplicateQuestionError || isDuplicateQuestionDbError(e)) {
        skipped++;
        continue;
      }
      errors.push({
        index: i,
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }
  return c.json({ ok: true, imported, skipped, errors });
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
        const imageError = validateStorableImageUrls(imgs);
        if (imageError) throw new Error(imageError);
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

app.post("/api/admin/questions/reassign-subject", adminAccessMiddleware, async (c: any) => {
  const db = c.get("db");
  const body = await c.req.json();
  const subjectId = canonicalSubjectId(
    cleanText(String(body.subjectId ?? body.subject_id ?? ""), 80),
  );
  if (!subjectId) {
    return c.json({ error: "subjectId is required." }, 400);
  }
  const idsRaw = Array.isArray(body?.questionIds)
    ? body.questionIds
    : Array.isArray(body?.ids)
      ? body.ids
      : [];
  const ids = idsRaw
    .map((x: unknown) => Number(x))
    .filter((n: number) => Number.isFinite(n) && n > 0);
  if (!ids.length) {
    return c.json({ error: "questionIds array is required." }, 400);
  }
  let updated = 0;
  let skipped = 0;
  for (const id of ids) {
    const rows = await db
      .select({
        id: customQuestions.id,
        question: customQuestions.question,
      })
      .from(customQuestions)
      .where(eq(customQuestions.id, id))
      .limit(1);
    if (!rows.length) continue;
    const dupeId = await findExistingQuestionByStem(
      db,
      subjectId,
      String(rows[0].question ?? ""),
      id,
    );
    if (dupeId) {
      skipped++;
      continue;
    }
    await db
      .update(customQuestions)
      .set({ subjectId })
      .where(eq(customQuestions.id, id));
    updated++;
  }
  return c.json({ ok: true, updated, skipped, subjectId });
});

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
    await db.execute(sql`DELETE FROM custom_questions WHERE id IN (${sqlIntInList(ids)})`);
    return c.json({ ok: true, deleted: ids.length });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

app.post("/api/admin/questions/delete-by-subject", adminAccessMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    const body = await c.req.json();
    const subjectId = canonicalSubjectId(cleanText(String(body?.subjectId ?? body?.subject_id ?? ""), 80));
    if (!subjectId) return c.json({ error: "subjectId is required." }, 400);
    const result = await db.execute(sql`
      DELETE FROM custom_questions
      WHERE LOWER(TRIM(subject_id)) = LOWER(TRIM(${subjectId}))
      RETURNING id
    `);
    const deleted = Array.isArray(result.rows) ? result.rows.length : 0;
    return c.json({ ok: true, deleted, subjectId });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

const ADMIN_AI_DISABLED =
  "Admin AI features are disabled. Gemini is used only for English scoring and worded explain/discuss/prove-style marking.";

app.get("/api/admin/prompting", adminAccessMiddleware, async (c: any) => {
  const db = c.get("db");
  const rows = await db.execute(sql`
    SELECT subject_id, prompt_text, resources_json, updated_at
    FROM subject_marking_context
    ORDER BY subject_id ASC
  `);
  const contexts = (rows.rows as any[]).map((row) => {
    const resourcesRaw = safeJsonParse(row.resources_json);
    const resources = Array.isArray(resourcesRaw)
      ? resourcesRaw.map((r: unknown) => {
          if (typeof r === "string") return { name: "Resource", content: r };
          const o = (r ?? {}) as Record<string, unknown>;
          return {
            name: String(o.name ?? "Resource"),
            content: String(o.content ?? o.text ?? ""),
          };
        })
      : [];
    return {
      subjectId: String(row.subject_id ?? ""),
      promptText: String(row.prompt_text ?? ""),
      resources,
      updatedAt: String(row.updated_at ?? ""),
    };
  });
  return c.json({ contexts });
});

app.put("/api/admin/prompting/:subjectId", adminAccessMiddleware, async (c: any) => {
  try {
    const db = c.get("db");
    const subjectId = canonicalSubjectId(c.req.param("subjectId"));
    if (!subjectId) return c.json({ error: "subjectId is required." }, 400);
    const body = await c.req.json();
    const promptText = cleanText(String(body?.promptText ?? body?.prompt_text ?? ""), 50000);
    const resources = Array.isArray(body?.resources)
      ? body.resources
          .map((r: unknown) => {
            const o = (r ?? {}) as Record<string, unknown>;
            const name = cleanText(String(o.name ?? "Resource"), 240);
            const content = cleanText(String(o.content ?? o.text ?? ""), 50000);
            if (!name && !content) return null;
            return { name: name || "Resource", content };
          })
          .filter(Boolean)
          .slice(0, 20)
      : [];
    const now = nowIso();
    await db.execute(sql`
      INSERT INTO subject_marking_context (subject_id, prompt_text, resources_json, updated_at)
      VALUES (${subjectId}, ${promptText}, ${JSON.stringify(resources)}, ${now})
      ON CONFLICT(subject_id) DO UPDATE SET
        prompt_text = EXCLUDED.prompt_text,
        resources_json = EXCLUDED.resources_json,
        updated_at = EXCLUDED.updated_at
    `);
    return c.json({ ok: true, subjectId });
  } catch (e) {
    return c.json({ error: errorChain(e) }, 500);
  }
});

app.post("/api/admin/ai/generate-mark-breakdown", adminAccessMiddleware, async (c: any) => {
  let aiReservation: Awaited<ReturnType<typeof beginAiRequest>> | null = null;
  let aiStartedAt = 0;
  try {
    const env = c.env as Env;
    if (!openAiConfigured(env)) {
      return c.json({ error: "Gemini is not configured." }, 503);
    }
    const body = await c.req.json();
    const subjectId = canonicalSubjectId(cleanText(String(body?.subjectId ?? ""), 80));
    const questionText = cleanText(String(body?.questionText ?? body?.question ?? ""), 4000);
    if (!questionText) return c.json({ error: "questionText is required." }, 400);
    const marks = Math.max(1, Math.round(Number(body?.marks ?? 1) || 1));
    const db = c.get("db");
    const subjectContext = subjectId
      ? await loadSubjectMarkingContext(db, subjectId)
      : undefined;
    const requestKey = `admin-mark-breakdown:${await sha256Key([
      subjectId, questionText, marks, body?.topic, body?.guidance, body?.acceptedAnswers,
    ])}`;
    const cached = await readCachedAiResult<{ markBreakdown: { steps: unknown[]; source: string } }>(
      db,
      requestKey,
    );
    if (cached) return c.json(cached);
    const user = c.get("user");
    aiReservation = await beginAiRequest({
      db,
      env,
      requestKey,
      userId: Number(user?.id ?? 0),
      route: "/api/admin/ai/generate-mark-breakdown",
      feature: "admin_mark_breakdown",
      provider: "model_pool",
      model: openAiModel(env),
    });
    aiStartedAt = Date.now();
    const generated = await generateMarkBreakdown(env, {
      questionText,
      topic: body?.topic ? cleanText(String(body.topic), 240) : undefined,
      marks,
      guidance: body?.guidance ? cleanText(String(body.guidance), 2000) : undefined,
      acceptedAnswers: Array.isArray(body?.acceptedAnswers)
        ? body.acceptedAnswers.map((a: unknown) => String(a ?? "").trim()).filter(Boolean)
        : undefined,
      subjectContext,
    });
    const response = {
      markBreakdown: { steps: generated.steps, source: "ai" },
    };
    await finishAiRequest({
      db, reservation: aiReservation, success: true, result: response,
      latencyMs: Date.now() - aiStartedAt,
    });
    aiReservation = null;
    return c.json(response);
  } catch (e) {
    if (aiReservation) {
      await finishAiRequest({
        db: c.get("db"), reservation: aiReservation, success: false,
        latencyMs: aiStartedAt ? Date.now() - aiStartedAt : 0,
        errorCode: e instanceof AiSafetyError ? e.code : "admin_breakdown_failed",
      }).catch(() => undefined);
    }
    if (e instanceof AiSafetyError) {
      return c.json({ error: e.message, code: e.code }, aiSafetyStatus(e) as any);
    }
    return c.json({ error: errorChain(e) }, 500);
  }
});

app.get("/api/admin/ai/status", adminAccessMiddleware, async (c: any) => {
  const env = c.env as Env;
  return c.json({
    configured: openAiConfigured(env),
    model: openAiModel(env),
    adminFeaturesEnabled: false,
    studentMarkingEnabled: openAiConfigured(env),
  });
});

app.post("/api/admin/ai/fill-answers", adminAccessMiddleware, async (c: any) => {
  return c.json({ error: ADMIN_AI_DISABLED }, 503);
});

app.post("/api/admin/ai/parse-questions", adminAccessMiddleware, async (c: any) => {
  return c.json({ error: ADMIN_AI_DISABLED }, 503);
});

app.post("/api/admin/ai/question-chat", adminAccessMiddleware, async (c: any) => {
  return c.json({ error: ADMIN_AI_DISABLED }, 503);
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
    let skipped = 0;
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
        const questionText = cleanText(p.question, 1000);

        if (!Number.isFinite(databaseId)) {
          const dupeId = await findExistingQuestionByStem(db, subjectIdSheet, questionText);
          if (dupeId) {
            skipped++;
            continue;
          }
        }

        const insertRow = async () => {
          try {
            await insertCustomQuestionRow(db, {
              subjectId: subjectIdSheet,
              type: p.type,
              topic,
              question: questionText,
              image_urls_json: imageUrlsJson,
              options_json: optionsJson,
              answer,
              accepted_answers_json: acceptedRaw,
              guidance,
              passage,
              marks,
            });
            imported++;
          } catch (e: unknown) {
            if (e instanceof DuplicateQuestionError || isDuplicateQuestionDbError(e)) {
              skipped++;
              return;
            }
            throw e;
          }
        };

        if (Number.isFinite(databaseId)) {
          const exists = await db
            .select({ id: customQuestions.id })
            .from(customQuestions)
            .where(eq(customQuestions.id, databaseId))
            .limit(1);
          if (exists.length > 0) {
            const dupeId = await findExistingQuestionByStem(
              db,
              subjectIdSheet,
              questionText,
              databaseId,
            );
            if (dupeId) {
              skipped++;
              continue;
            }
            await db
              .update(customQuestions)
              .set({
                subjectId: subjectIdSheet,
                type: p.type,
                topic,
                question: questionText,
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
            await insertRow();
          }
        } else {
          await insertRow();
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
      skipped,
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
  return app.fetch(context.request, context.env, context);
};

// Module worker entry (used by `wrangler dev` when main points at this file)
export default app;
