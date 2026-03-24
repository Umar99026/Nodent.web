import { Hono } from "hono";
import { eq, and, sql } from "drizzle-orm";
import { writtenResponses, users } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { cleanText, nowIso } from "../lib/utils";
import type { Bindings, Variables } from "../types";

const written = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Get user's own response
written.get("/:subjectId/:questionKey", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const subjectId = c.req.param("subjectId");
  const questionKey = c.req.param("questionKey");

  const rows = await db
    .select({
      responseText: writtenResponses.responseText,
      updatedAt: writtenResponses.updatedAt,
    })
    .from(writtenResponses)
    .where(
      and(
        eq(writtenResponses.userId, user.id),
        eq(writtenResponses.subjectId, subjectId),
        eq(writtenResponses.questionKey, questionKey)
      )
    )
    .limit(1);

  return c.json({
    response:
      rows.length > 0
        ? { text: rows[0].responseText, updatedAt: rows[0].updatedAt }
        : null,
  });
});

// Save (upsert) user's response
written.put("/:subjectId/:questionKey", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const subjectId = c.req.param("subjectId");
  const questionKey = c.req.param("questionKey");
  const body = await c.req.json();

  const responseText = cleanText(body.responseText, 12000);
  if (!responseText) {
    return c.json({ error: "Response cannot be empty." }, 400);
  }

  await db.execute(sql`
    INSERT INTO written_responses (user_id, subject_id, question_key, response_text, updated_at)
    VALUES (${user.id}, ${subjectId}, ${questionKey}, ${responseText}, ${nowIso()})
    ON CONFLICT(user_id, subject_id, question_key) DO UPDATE SET
      response_text = EXCLUDED.response_text,
      updated_at = EXCLUDED.updated_at
  `);

  return c.json({ ok: true });
});

// Get all responses for a question
written.get("/:subjectId/:questionKey/all", authMiddleware, async (c) => {
  const db = c.get("db");
  const subjectId = c.req.param("subjectId");
  const questionKey = c.req.param("questionKey");

  const rows = await db.execute(sql`
    SELECT wr.response_text, wr.updated_at, u.id AS user_id
    FROM written_responses wr
    JOIN users u ON u.id = wr.user_id
    WHERE wr.subject_id = ${subjectId} AND wr.question_key = ${questionKey}
    ORDER BY wr.updated_at DESC
  `);

  return c.json({
    responses: (rows.rows as any[]).map((row) => ({
      text: row.response_text,
      updatedAt: row.updated_at,
      userId: row.user_id,
    })),
  });
});

export { written };
