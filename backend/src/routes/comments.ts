import { Hono } from "hono";
import { eq, and, asc, sql } from "drizzle-orm";
import { quizComments, users } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { cleanText, nowIso } from "../lib/utils";
import type { Bindings, Variables } from "../types";

const comments = new Hono<{ Bindings: Bindings; Variables: Variables }>();

comments.get("/:subjectId/:questionKey", authMiddleware, async (c) => {
  const db = c.get("db");
  const subjectId = c.req.param("subjectId");
  const questionKey = c.req.param("questionKey");

  const rows = await db.execute(sql`
    SELECT qc.id, qc.parent_comment_id, qc.text, qc.image_urls, qc.created_at,
           u.username, u.id AS user_id
    FROM quiz_comments qc
    JOIN users u ON u.id = qc.user_id
    WHERE qc.subject_id = ${subjectId} AND qc.question_key = ${questionKey}
    ORDER BY qc.created_at ASC, qc.id ASC
  `);

  return c.json({
    comments: (rows.rows as any[]).map((row) => ({
      id: row.id,
      parentCommentId: row.parent_comment_id,
      text: row.text,
      imageUrls: row.image_urls ? JSON.parse(String(row.image_urls)) : [],
      time: row.created_at,
      username: row.username,
      userId: row.user_id,
    })),
  });
});

comments.post("/:subjectId/:questionKey", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const subjectId = c.req.param("subjectId");
  const questionKey = c.req.param("questionKey");
  const body = await c.req.json();

  const text = cleanText(body.text, 1000);
  const imageUrls = Array.isArray((body as any)?.imageUrls)
    ? (body as any).imageUrls.map(String).map((s: string) => s.trim()).filter(Boolean)
    : [];
  const rawParent = body.parentCommentId;
  const parentCommentId =
    rawParent === null || rawParent === undefined || rawParent === ""
      ? null
      : Number(rawParent);

  if (!text && imageUrls.length === 0) {
    return c.json({ error: "Comment cannot be empty." }, 400);
  }

  if (parentCommentId !== null) {
    const parent = await db
      .select({ id: quizComments.id })
      .from(quizComments)
      .where(
        and(
          eq(quizComments.id, parentCommentId),
          eq(quizComments.subjectId, subjectId),
          eq(quizComments.questionKey, questionKey)
        )
      )
      .limit(1);

    if (parent.length === 0) {
      return c.json({ error: "Reply target not found." }, 400);
    }
  }

  const createdAt = nowIso();
  const result = await db
    .insert(quizComments)
    .values({
      subjectId,
      questionKey,
      userId: user.id,
      parentCommentId,
      text: text || "",
      imageUrls: imageUrls.length ? JSON.stringify(imageUrls) : null,
      createdAt,
    })
    .returning({ id: quizComments.id });

  return c.json({
    comment: {
      id: result[0].id,
      parentCommentId,
      text,
      imageUrls,
      time: createdAt,
      username: user.username,
      userId: user.id,
    },
  });
});

export { comments };
