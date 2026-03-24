import { Hono } from "hono";
import { asc } from "drizzle-orm";
import { customQuestions } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import type { Bindings, Variables } from "../types";

const bootstrap = new Hono<{ Bindings: Bindings; Variables: Variables }>();

bootstrap.get("/", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");

  const rows = await db
    .select()
    .from(customQuestions)
    .orderBy(asc(customQuestions.subjectId), asc(customQuestions.createdAt));

  const grouped: Record<string, any[]> = {};
  for (const row of rows) {
    if (!grouped[row.subjectId]) grouped[row.subjectId] = [];
    grouped[row.subjectId].push({
      id: row.id,
      type: row.type,
      question: row.question,
      options: row.options ? JSON.parse(row.options) : undefined,
      answer: row.answer || undefined,
      acceptedAnswers: row.acceptedAnswers
        ? JSON.parse(row.acceptedAnswers)
        : undefined,
      guidance: row.guidance || undefined,
      passage: row.passage || undefined,
    });
  }

  return c.json({
    user: { id: user.id, email: user.email, username: user.username },
    customQuestions: grouped,
  });
});

export { bootstrap };
