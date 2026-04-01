import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { questionAttempts } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { cleanText, nowIso } from "../lib/utils";
import type { Bindings, Variables } from "../types";

const competition = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Record a single question answer (upsert)
competition.post("/answer", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const body = await c.req.json();

  const subjectId = cleanText(body.subjectId, 80);
  const questionKey = cleanText(body.questionKey, 1000);
  const topic = cleanText(body.topic || "General", 100);
  const isCorrect = body.isCorrect ? 1 : 0;

  if (!subjectId || !questionKey) {
    return c.json({ error: "subjectId and questionKey required." }, 400);
  }

  await db.execute(sql`
    INSERT INTO question_attempts (user_id, subject_id, question_key, topic, is_correct, answered_at)
    VALUES (${user.id}, ${subjectId}, ${questionKey}, ${topic}, ${isCorrect}, ${nowIso()})
    ON CONFLICT(user_id, subject_id, question_key) DO NOTHING
  `);

  return c.json({ ok: true });
});

// Get full competition stats
competition.get("/:subjectId/stats", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const subjectId = c.req.param("subjectId");

  // Total distinct students
  const studentResult = await db.execute(sql`
    SELECT COUNT(DISTINCT user_id) as count FROM question_attempts WHERE subject_id = ${subjectId}
  `);
  const totalStudents = Number(studentResult.rows[0].count);

  if (totalStudents < 2) {
    return c.json({
      totalStudents,
      percentile: null,
      rank: null,
      leaderboard: [],
      questionStats: [],
      topicStats: [],
    });
  }

  // Per-user scores
  const allScores = await db.execute(sql`
    SELECT qa.user_id, u.username,
           SUM(qa.is_correct) as correct,
           COUNT(*) as total
    FROM question_attempts qa
    JOIN users u ON u.id = qa.user_id
    WHERE qa.subject_id = ${subjectId}
    GROUP BY qa.user_id, u.username
  `);

  const scores = allScores.rows as any[];
  const myRow = scores.find((r) => r.user_id === user.id);
  const myPercent =
    myRow && myRow.total > 0
      ? Math.round((Number(myRow.correct) / Number(myRow.total)) * 100)
      : 0;

  // Sort for leaderboard
  const sorted = [...scores].sort((a, b) => {
    const pa = a.total > 0 ? Number(a.correct) / Number(a.total) : 0;
    const pb = b.total > 0 ? Number(b.correct) / Number(b.total) : 0;
    return pb - pa;
  });

  const rank = sorted.findIndex((r) => r.user_id === user.id) + 1;
  const below = sorted.filter((r) => {
    const p =
      r.total > 0
        ? Math.round((Number(r.correct) / Number(r.total)) * 100)
        : 0;
    return p < myPercent;
  }).length;
  const percentile =
    totalStudents > 1
      ? Math.round((below / (totalStudents - 1)) * 100)
      : 100;

  const leaderboardData = sorted.slice(0, 10).map((r) => ({
    userId: r.user_id,
    username: r.username,
    correct: Number(r.correct),
    total: Number(r.total),
    percent:
      r.total > 0
        ? Math.round((Number(r.correct) / Number(r.total)) * 100)
        : 0,
  }));

  // Per-question class stats
  const qRows = await db.execute(sql`
    SELECT question_key, topic,
           SUM(is_correct) as correct_count,
           COUNT(*) as total_answered
    FROM question_attempts
    WHERE subject_id = ${subjectId}
    GROUP BY question_key, topic
  `);

  const questionStats = (qRows.rows as any[]).map((r) => ({
    questionKey: r.question_key,
    topic: r.topic,
    correctCount: Number(r.correct_count),
    totalAnswered: Number(r.total_answered),
  }));

  // Per-topic class stats
  const topicClassRows = await db.execute(sql`
    SELECT topic,
           SUM(is_correct) as correct_count,
           COUNT(*) as total_answered
    FROM question_attempts
    WHERE subject_id = ${subjectId}
    GROUP BY topic
  `);

  // Per-topic my stats
  const topicMyRows = await db.execute(sql`
    SELECT topic,
           SUM(is_correct) as my_correct,
           COUNT(*) as my_total
    FROM question_attempts
    WHERE subject_id = ${subjectId} AND user_id = ${user.id}
    GROUP BY topic
  `);

  const myTopicMap: Record<string, { myCorrect: number; myTotal: number }> = {};
  for (const r of topicMyRows.rows as any[]) {
    myTopicMap[r.topic] = {
      myCorrect: Number(r.my_correct),
      myTotal: Number(r.my_total),
    };
  }

  const topicStats = (topicClassRows.rows as any[]).map((r) => ({
    topic: r.topic,
    correctCount: Number(r.correct_count),
    totalAnswered: Number(r.total_answered),
    myCorrect: myTopicMap[r.topic]?.myCorrect ?? null,
    myTotal: myTopicMap[r.topic]?.myTotal ?? 0,
  }));

  return c.json({
    totalStudents,
    percentile,
    rank,
    leaderboard: leaderboardData,
    questionStats,
    topicStats,
  });
});

export { competition };
