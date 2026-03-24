import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { chatMessages } from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { cleanText, nowIso } from "../lib/utils";
import type { Bindings, Variables } from "../types";

const chat = new Hono<{ Bindings: Bindings; Variables: Variables }>();

chat.get("/:subjectId", authMiddleware, async (c) => {
  const db = c.get("db");
  const subjectId = c.req.param("subjectId");

  const rows = await db.execute(sql`
    SELECT id, user_id, username, text, created_at
    FROM chat_messages
    WHERE subject_id = ${subjectId}
    ORDER BY created_at ASC, id ASC
    LIMIT 200
  `);

  return c.json({
    messages: (rows.rows as any[]).map((r) => ({
      id: r.id,
      userId: r.user_id,
      username: r.username,
      text: r.text,
      time: r.created_at,
    })),
  });
});

chat.post("/:subjectId", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const subjectId = c.req.param("subjectId");
  const body = await c.req.json();

  const text = cleanText(body.text, 1000);
  if (!text) {
    return c.json({ error: "Message cannot be empty." }, 400);
  }

  const createdAt = nowIso();
  const result = await db
    .insert(chatMessages)
    .values({
      subjectId,
      userId: user.id,
      username: user.username,
      text,
      createdAt,
    })
    .returning({ id: chatMessages.id });

  return c.json({
    message: {
      id: result[0].id,
      userId: user.id,
      username: user.username,
      text,
      time: createdAt,
    },
  });
});

export { chat };
