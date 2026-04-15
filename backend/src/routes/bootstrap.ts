import { Hono } from "hono";
import { asc } from "drizzle-orm";
import { customQuestions } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import type { Bindings, Variables } from "../types";

const bootstrap = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function safeJsonParseArray(raw: string | null): string[] | undefined {
  if (!raw) return undefined;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String);
    return undefined;
  } catch {
    return undefined;
  }
}

bootstrap.get("/", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");

  const rows = await db
    .select({
      id: customQuestions.id,
      subjectId: customQuestions.subjectId,
      type: customQuestions.type,
      question: customQuestions.question,
      topic: customQuestions.topic,
      marks: customQuestions.marks,
      imageUrls: customQuestions.imageUrls,
      options: customQuestions.options,
      answer: customQuestions.answer,
      acceptedAnswers: customQuestions.acceptedAnswers,
      guidance: customQuestions.guidance,
      passage: customQuestions.passage,
    })
    .from(customQuestions)
    .orderBy(asc(customQuestions.subjectId), asc(customQuestions.createdAt));

  const grouped: Record<string, any[]> = {};
  for (const row of rows) {
    if (!grouped[row.subjectId]) grouped[row.subjectId] = [];
    grouped[row.subjectId].push({
      id: row.id,
      type: row.type,
      question: row.question,
      topic: row.topic || undefined,
      marks: row.marks || undefined,
      imageUrls: safeJsonParseArray(row.imageUrls),
      options: safeJsonParseArray(row.options),
      answer: row.answer || undefined,
      acceptedAnswers: safeJsonParseArray(row.acceptedAnswers),
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
