import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import { cleanText, nowIso } from "../lib/utils";
import type { Bindings, Variables } from "../types";

const competition = new Hono<{ Bindings: Bindings; Variables: Variables }>();

const MIN_RANKED_ATTEMPTS = 10;

function isMissingMarksColumn(err: unknown): boolean {
  // Neon/Drizzle typically reports missing columns with code 42703.
  // We keep this loose to avoid tight coupling to a specific error shape.
  const anyErr = err as any;
  const code = anyErr?.cause?.code ?? anyErr?.code;
  const msg = String(anyErr?.cause?.message ?? anyErr?.message ?? "");
  return String(code) === "42703" && msg.toLowerCase().includes("marks");
}

async function ensureQuestionAttemptMarksColumn(db: any) {
  await db.execute(sql`
    ALTER TABLE question_attempts
    ADD COLUMN IF NOT EXISTS marks integer NOT NULL DEFAULT 1
  `);
}

// Record a single question answer (upsert)
competition.post("/answer", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const body = await c.req.json();

  const subjectId = cleanText(body.subjectId, 80);
  const questionKey = cleanText(body.questionKey, 1000);
  const topic = cleanText(body.topic || "General", 100);
  const marks = Math.max(1, Math.round(Number(body.marks ?? 1)));
  const isCorrectRaw = body.isCorrect ?? body.correct;
  const isCorrect = isCorrectRaw ? 1 : 0;

  if (!subjectId || !questionKey) {
    return c.json({ error: "subjectId and questionKey required." }, 400);
  }

  try {
    await db.execute(sql`
      INSERT INTO question_attempts (user_id, subject_id, question_key, topic, marks, is_correct, answered_at)
      VALUES (${user.id}, ${subjectId}, ${questionKey}, ${topic}, ${marks}, ${isCorrect}, ${nowIso()})
      ON CONFLICT(user_id, subject_id, question_key) DO UPDATE SET
        topic = EXCLUDED.topic,
        marks = EXCLUDED.marks,
        is_correct = EXCLUDED.is_correct,
        answered_at = EXCLUDED.answered_at
    `);
  } catch (err) {
    // Some existing DBs were created before `marks` was added.
    if (!isMissingMarksColumn(err)) throw err;
    await ensureQuestionAttemptMarksColumn(db);
    await db.execute(sql`
      INSERT INTO question_attempts (user_id, subject_id, question_key, topic, marks, is_correct, answered_at)
      VALUES (${user.id}, ${subjectId}, ${questionKey}, ${topic}, ${marks}, ${isCorrect}, ${nowIso()})
      ON CONFLICT(user_id, subject_id, question_key) DO UPDATE SET
        topic = EXCLUDED.topic,
        marks = EXCLUDED.marks,
        is_correct = EXCLUDED.is_correct,
        answered_at = EXCLUDED.answered_at
    `);
  }

  return c.json({ ok: true });
});

// Get full competition stats
competition.get("/:subjectId/stats", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const subjectId = c.req.param("subjectId");
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

  const studentResult = await db.execute(sql`
    SELECT COUNT(DISTINCT user_id) as count FROM question_attempts
    WHERE subject_id = ${subjectId} ${timeFilter}
  `);
  const totalStudents = Number((studentResult.rows[0] as { count: string }).count);

  let allScoresRows: any;
  try {
    allScoresRows = await db.execute(sql`
      SELECT qa.user_id, u.username,
             SUM(CASE WHEN qa.is_correct = 1 THEN qa.marks ELSE 0 END) AS marks_correct,
             SUM(qa.marks) AS marks_attempted,
             COUNT(*)::int AS attempt_count
      FROM question_attempts qa
      JOIN users u ON u.id = qa.user_id
      WHERE qa.subject_id = ${subjectId} ${timeFilter}
      GROUP BY qa.user_id, u.username
    `);
  } catch (err) {
    if (!isMissingMarksColumn(err)) throw err;
    await ensureQuestionAttemptMarksColumn(db);
    allScoresRows = await db.execute(sql`
      SELECT qa.user_id, u.username,
             SUM(CASE WHEN qa.is_correct = 1 THEN qa.marks ELSE 0 END) AS marks_correct,
             SUM(qa.marks) AS marks_attempted,
             COUNT(*)::int AS attempt_count
      FROM question_attempts qa
      JOIN users u ON u.id = qa.user_id
      WHERE qa.subject_id = ${subjectId} ${timeFilter}
      GROUP BY qa.user_id, u.username
    `);
  }
  const allScores = allScoresRows.rows as {
    user_id: number;
    username: string;
    marks_correct: string;
    marks_attempted: string;
    attempt_count: number;
  }[];

  const pctRounded = (r: (typeof allScores)[0]) => {
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
      percentile =
        sortedEligible.length > 1
          ? Math.round((below / (sortedEligible.length - 1)) * 100)
          : 100;
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

  const questionStats = (qRows.rows as Record<string, unknown>[]).map((r) => {
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

  let topicClassRows: any;
  let topicMyRows: any;
  try {
    topicClassRows = await db.execute(sql`
      SELECT topic,
             SUM(CASE WHEN is_correct = 1 THEN marks ELSE 0 END) AS class_marks_correct,
             SUM(marks) AS class_marks_attempted
      FROM question_attempts
      WHERE subject_id = ${subjectId} ${timeFilter}
      GROUP BY topic
    `);
    topicMyRows = await db.execute(sql`
      SELECT topic,
             SUM(CASE WHEN is_correct = 1 THEN marks ELSE 0 END) AS my_marks_correct,
             SUM(marks) AS my_marks_attempted
      FROM question_attempts
      WHERE subject_id = ${subjectId} AND user_id = ${user.id} ${timeFilter}
      GROUP BY topic
    `);
  } catch (err) {
    if (!isMissingMarksColumn(err)) throw err;
    await ensureQuestionAttemptMarksColumn(db);
    topicClassRows = await db.execute(sql`
      SELECT topic,
             SUM(CASE WHEN is_correct = 1 THEN marks ELSE 0 END) AS class_marks_correct,
             SUM(marks) AS class_marks_attempted
      FROM question_attempts
      WHERE subject_id = ${subjectId} ${timeFilter}
      GROUP BY topic
    `);
    topicMyRows = await db.execute(sql`
      SELECT topic,
             SUM(CASE WHEN is_correct = 1 THEN marks ELSE 0 END) AS my_marks_correct,
             SUM(marks) AS my_marks_attempted
      FROM question_attempts
      WHERE subject_id = ${subjectId} AND user_id = ${user.id} ${timeFilter}
      GROUP BY topic
    `);
  }

  const myTopicMap: Record<string, { myCorrect: number; myTotal: number }> = {};
  for (const r of topicMyRows.rows as { topic: string; my_marks_correct: string; my_marks_attempted: string }[]) {
    myTopicMap[r.topic] = {
      myCorrect: Number(r.my_marks_correct),
      myTotal: Number(r.my_marks_attempted),
    };
  }

  let topicUserRows: any;
  try {
    topicUserRows = await db.execute(sql`
      SELECT user_id, topic,
             SUM(CASE WHEN is_correct = 1 THEN marks ELSE 0 END) AS marks_correct,
             SUM(marks) AS marks_attempted
      FROM question_attempts
      WHERE subject_id = ${subjectId} ${timeFilter}
      GROUP BY user_id, topic
    `);
  } catch (err) {
    if (!isMissingMarksColumn(err)) throw err;
    await ensureQuestionAttemptMarksColumn(db);
    topicUserRows = await db.execute(sql`
      SELECT user_id, topic,
             SUM(CASE WHEN is_correct = 1 THEN marks ELSE 0 END) AS marks_correct,
             SUM(marks) AS marks_attempted
      FROM question_attempts
      WHERE subject_id = ${subjectId} ${timeFilter}
      GROUP BY user_id, topic
    `);
  }

  const byTopicUsers = new Map<string, { userId: number; pctRounded: number }[]>();
  for (const row of topicUserRows.rows as {
    user_id: number;
    topic: string;
    marks_correct: string;
    marks_attempted: string;
  }[]) {
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

  const topicStats = (topicClassRows.rows as { topic: string; class_marks_correct: string; class_marks_attempted: string }[]).map((r) => ({
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

export { competition };
