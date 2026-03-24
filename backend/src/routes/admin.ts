import { Hono } from "hono";
import { eq, asc, sql } from "drizzle-orm";
import { customQuestions } from "../db/schema";
import { adminMiddleware } from "../middleware/admin";
import { cleanText, nowIso } from "../lib/utils";
import type { Bindings, Variables } from "../types";

const admin = new Hono<{ Bindings: Bindings; Variables: Variables }>();

admin.get("/questions", adminMiddleware, async (c) => {
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

  return c.json({ customQuestions: grouped });
});

admin.post("/questions", adminMiddleware, async (c) => {
  const db = c.get("db");
  const body = await c.req.json();

  const subjectId = cleanText(body.subjectId, 80);
  const type = cleanText(body.type, 20);
  const question = cleanText(body.question, 1000);
  const options = body.options ? JSON.stringify(body.options) : null;
  const answer = body.answer ? cleanText(body.answer, 500) : null;
  const acceptedAnswers = body.acceptedAnswers
    ? JSON.stringify(body.acceptedAnswers)
    : null;
  const guidance = body.guidance ? cleanText(body.guidance, 500) : null;
  const passage = body.passage ? cleanText(body.passage, 3000) : null;

  if (!subjectId || !type || !question) {
    return c.json(
      { error: "subjectId, type, and question are required." },
      400
    );
  }

  const result = await db
    .insert(customQuestions)
    .values({
      subjectId,
      type,
      question,
      options,
      answer,
      acceptedAnswers,
      guidance,
      passage,
      createdAt: nowIso(),
    })
    .returning({ id: customQuestions.id });

  return c.json({ ok: true, id: result[0].id });
});

admin.delete("/questions/:id", adminMiddleware, async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));

  await db.delete(customQuestions).where(eq(customQuestions.id, id));
  return c.json({ ok: true });
});

export { admin };
