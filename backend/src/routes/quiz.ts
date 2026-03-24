import { Hono } from "hono";
import { quizAttempts } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { cleanText, nowIso } from "../lib/utils";
import type { Bindings, Variables } from "../types";

const quiz = new Hono<{ Bindings: Bindings; Variables: Variables }>();

quiz.post("/submit", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const body = await c.req.json();

  const subjectId = cleanText(body.subjectId, 80);
  const score = Math.max(0, Number(body.score || 0));
  const totalQuestions = Math.max(1, Number(body.totalQuestions || 0));

  if (!subjectId || totalQuestions <= 0) {
    return c.json({ error: "Invalid quiz submission." }, 400);
  }

  const percent = Math.round((score / totalQuestions) * 100);

  await db.insert(quizAttempts).values({
    userId: user.id,
    subjectId,
    score,
    totalQuestions,
    percent,
    createdAt: nowIso(),
  });

  return c.json({ ok: true, percent });
});

export { quiz };
