import { sql } from "drizzle-orm";

export const PREMIUM_REQUIRED = "premium_required";

export type PremiumUser = {
  id: number;
  email?: string | null;
  plan?: string | null;
  premiumUntil?: string | null;
};

const ADMIN_EMAIL_LC = "nodent.app@gmail.com";

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

const MS_DAY = 24 * 60 * 60 * 1000;
const PRACTICE_EXAM_WINDOW_MS = 7 * MS_DAY;
const ENGLISH_MARK_WINDOW_MS = 3 * MS_DAY;

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
  db: { execute: (q: ReturnType<typeof sql>) => Promise<{ rows?: unknown[] }> },
  userId: number,
  examRef: string,
): Promise<{ allowed: boolean; reason?: string }> {
  const since = new Date(Date.now() - PRACTICE_EXAM_WINDOW_MS).toISOString();
  const rows = await db.execute(sql`
    SELECT ref_key
    FROM user_usage_events
    WHERE user_id = ${userId}
      AND kind = 'practice_exam'
      AND created_at >= ${since}
    ORDER BY created_at DESC
    LIMIT 5
  `);
  const refs = (rows.rows as { ref_key?: string | null }[]).map((r) =>
    String(r.ref_key ?? ""),
  );
  if (refs.includes(examRef)) return { allowed: true };
  if (refs.length >= 1) {
    return {
      allowed: false,
      reason: "Free accounts get 1 practice exam per week. Upgrade for unlimited access.",
    };
  }
  return { allowed: true };
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

export async function canRunEnglishAiMark(
  db: { execute: (q: ReturnType<typeof sql>) => Promise<{ rows?: unknown[] }> },
  userId: number,
): Promise<{ allowed: boolean; reason?: string }> {
  const since = new Date(Date.now() - ENGLISH_MARK_WINDOW_MS).toISOString();
  const n = await countUsageSince(db, userId, "english_ai_mark", since);
  if (n >= 1) {
    return {
      allowed: false,
      reason: "Free accounts get 1 AI-marked English response every 3 days. Upgrade for unlimited marking.",
    };
  }
  return { allowed: true };
}

export async function getPremiumUsageSummary(
  db: { execute: (q: ReturnType<typeof sql>) => Promise<{ rows?: unknown[] }> },
  userId: number,
  isPremium: boolean,
) {
  const examSince = new Date(Date.now() - PRACTICE_EXAM_WINDOW_MS).toISOString();
  const englishSince = new Date(Date.now() - ENGLISH_MARK_WINDOW_MS).toISOString();
  const examsUsed = await countUsageSince(db, userId, "practice_exam", examSince);
  const englishUsed = await countUsageSince(db, userId, "english_ai_mark", englishSince);
  return {
    isPremium,
    practiceExams: {
      used: examsUsed,
      limit: isPremium ? null : 1,
      windowDays: 7,
    },
    englishAiMarks: {
      used: englishUsed,
      limit: isPremium ? null : 1,
      windowDays: 3,
    },
    aiMarking: { requiresPremium: !isPremium },
    questionHelp: { requiresPremium: !isPremium },
    markBreakdown: { requiresPremium: !isPremium },
  };
}
