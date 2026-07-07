import { sql } from "drizzle-orm";

export const PREMIUM_REQUIRED = "premium_required";

export type PremiumUser = {
  id: number;
  email?: string | null;
  plan?: string | null;
  premiumUntil?: string | null;
};

const ADMIN_EMAIL_LC = "nodent.app@gmail.com";

/** Per API key — total free daily limit = this × configured provider count. */
export const FREE_DAILY_AI_MARKS_PER_PROVIDER = 3;

export function freeDailyProseAiLimit(providerCount: number): number {
  return FREE_DAILY_AI_MARKS_PER_PROVIDER * Math.max(1, providerCount);
}

export function freeDailyHandwritingAiLimit(providerCount: number): number {
  return FREE_DAILY_AI_MARKS_PER_PROVIDER * Math.max(1, providerCount);
}

export function isAdminEmail(email: unknown): boolean {
  return String(email ?? "").trim().toLowerCase() === ADMIN_EMAIL_LC;
}

export function isPremiumAccount(user: PremiumUser): boolean {
  if (isAdminEmail(user.email)) return true;
  const plan = String(user.plan ?? "free").trim().toLowerCase();
  if (plan === "premium" || plan === "paid") {
    const until = String(user.premiumUntil ?? "").trim();
    if (!until) return true;
    const t = Date.parse(until);
    if (!Number.isFinite(t)) return true;
    return t > Date.now();
  }
  return false;
}

export function premiumRequiredResponse() {
  return {
    error: "This feature requires Premium.",
    code: PREMIUM_REQUIRED,
  };
}

export function quotaExceededResponse(message: string) {
  return {
    error: message,
    code: PREMIUM_REQUIRED,
  };
}

const MS_DAY = 24 * 60 * 60 * 1000;
const PRACTICE_EXAM_WINDOW_MS = 7 * MS_DAY;

export const USAGE_KIND_PROSE_AI = "prose_ai_mark";
export const USAGE_KIND_HANDWRITING_AI = "handwriting_ai_mark";
export const USAGE_KIND_ENGLISH_ESSAY_AI = "english_essay_ai";

const ENGLISH_ESSAY_WINDOW_MS = 3 * MS_DAY;
export const FREE_ENGLISH_ESSAY_LIMIT = 1;

/** UTC midnight — same reset window for all users. */
export function startOfUtcDayIso(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())).toISOString();
}

export async function countUsageSince(
  db: { execute: (q: ReturnType<typeof sql>) => Promise<{ rows?: unknown[] }> },
  userId: number,
  kind: string,
  sinceIso: string,
): Promise<number> {
  const rows = await db.execute(sql`
    SELECT COUNT(*)::int AS n
    FROM user_usage_events
    WHERE user_id = ${userId}
      AND kind = ${kind}
      AND created_at >= ${sinceIso}
  `);
  return Number((rows.rows as { n?: number }[] | undefined)?.[0]?.n ?? 0);
}

export async function recordUsage(
  db: { execute: (q: ReturnType<typeof sql>) => Promise<unknown> },
  userId: number,
  kind: string,
  refKey?: string | null,
): Promise<void> {
  await db.execute(sql`
    INSERT INTO user_usage_events (user_id, kind, ref_key, created_at)
    VALUES (${userId}, ${kind}, ${refKey ?? null}, ${new Date().toISOString()})
  `);
}

export async function hasPracticeExamAccess(
  _db: { execute: (q: ReturnType<typeof sql>) => Promise<{ rows?: unknown[] }> },
  _userId: number,
  _examRef: string,
): Promise<{ allowed: boolean; reason?: string }> {
  return {
    allowed: false,
    reason: "Past practice exams require Premium.",
  };
}

export async function ensurePracticeExamUsage(
  db: { execute: (q: ReturnType<typeof sql>) => Promise<{ rows?: unknown[] }> },
  userId: number,
  examRef: string,
): Promise<void> {
  const since = new Date(Date.now() - PRACTICE_EXAM_WINDOW_MS).toISOString();
  const existing = await db.execute(sql`
    SELECT id FROM user_usage_events
    WHERE user_id = ${userId}
      AND kind = 'practice_exam'
      AND ref_key = ${examRef}
      AND created_at >= ${since}
    LIMIT 1
  `);
  if ((existing.rows as unknown[])?.length) return;
  await recordUsage(db, userId, "practice_exam", examRef);
}

/** Long-answer text AI on free accounts (maths etc. — not English essays). */
export async function canRunProseAiMark(
  db: { execute: (q: ReturnType<typeof sql>) => Promise<{ rows?: unknown[] }> },
  userId: number,
  providerCount = 1,
): Promise<{ allowed: boolean; reason?: string }> {
  const limit = freeDailyProseAiLimit(providerCount);
  const since = startOfUtcDayIso();
  const n = await countUsageSince(db, userId, USAGE_KIND_PROSE_AI, since);
  if (n >= limit) {
    return {
      allowed: false,
      reason: `Free accounts get ${limit} AI-marked long answers per day. Upgrade for unlimited marking.`,
    };
  }
  return { allowed: true };
}

/** Handwritten working / draw marking — separate daily bucket on free accounts. */
export async function canRunHandwritingAiMark(
  db: { execute: (q: ReturnType<typeof sql>) => Promise<{ rows?: unknown[] }> },
  userId: number,
  providerCount = 1,
): Promise<{ allowed: boolean; reason?: string }> {
  const limit = freeDailyHandwritingAiLimit(providerCount);
  const since = startOfUtcDayIso();
  const n = await countUsageSince(db, userId, USAGE_KIND_HANDWRITING_AI, since);
  if (n >= limit) {
    return {
      allowed: false,
      reason: `Free accounts get ${limit} handwritten working-out marks per day. Upgrade for unlimited marking.`,
    };
  }
  return { allowed: true };
}

/** English essay marking — separate 3-day bucket (uses paid OpenAI). */
export async function canRunEnglishAiMark(
  db: { execute: (q: ReturnType<typeof sql>) => Promise<{ rows?: unknown[] }> },
  userId: number,
): Promise<{ allowed: boolean; reason?: string }> {
  const since = new Date(Date.now() - ENGLISH_ESSAY_WINDOW_MS).toISOString();
  const n = await countUsageSince(db, userId, USAGE_KIND_ENGLISH_ESSAY_AI, since);
  if (n >= FREE_ENGLISH_ESSAY_LIMIT) {
    return {
      allowed: false,
      reason: `Free accounts get ${FREE_ENGLISH_ESSAY_LIMIT} AI-marked English essay every 3 days. Upgrade for unlimited marking.`,
    };
  }
  return { allowed: true };
}

export async function getPremiumUsageSummary(
  db: { execute: (q: ReturnType<typeof sql>) => Promise<{ rows?: unknown[] }> },
  userId: number,
  isPremium: boolean,
  providerCount = 1,
) {
  const examSince = new Date(Date.now() - PRACTICE_EXAM_WINDOW_MS).toISOString();
  const daySince = startOfUtcDayIso();
  const essaySince = new Date(Date.now() - ENGLISH_ESSAY_WINDOW_MS).toISOString();
  const examsUsed = await countUsageSince(db, userId, "practice_exam", examSince);
  const proseUsed = await countUsageSince(db, userId, USAGE_KIND_PROSE_AI, daySince);
  const handwritingUsed = await countUsageSince(
    db,
    userId,
    USAGE_KIND_HANDWRITING_AI,
    daySince,
  );
  const englishEssaysUsed = await countUsageSince(
    db,
    userId,
    USAGE_KIND_ENGLISH_ESSAY_AI,
    essaySince,
  );
  return {
    isPremium,
    practiceExams: {
      used: isPremium ? examsUsed : 0,
      limit: isPremium ? null : 0,
      windowDays: 7,
      requiresPremium: !isPremium,
    },
    proseAiMarks: {
      used: proseUsed,
      limit: isPremium ? null : freeDailyProseAiLimit(providerCount),
      windowDays: 1,
    },
    handwritingAiMarks: {
      used: handwritingUsed,
      limit: isPremium ? null : freeDailyHandwritingAiLimit(providerCount),
      windowDays: 1,
    },
    englishEssays: {
      used: englishEssaysUsed,
      limit: isPremium ? null : FREE_ENGLISH_ESSAY_LIMIT,
      windowDays: 3,
    },
    questionHelp: { requiresPremium: !isPremium },
  };
}
