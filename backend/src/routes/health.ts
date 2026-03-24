import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { Bindings, Variables } from "../types";

const health = new Hono<{ Bindings: Bindings; Variables: Variables }>();

health.get("/", async (c) => {
  const db = c.get("db");

  const [userCount, sessionCount, chatCount, commentCount] = await Promise.all([
    db.execute(sql`SELECT COUNT(*) as count FROM users`),
    db.execute(sql`SELECT COUNT(*) as count FROM sessions`),
    db.execute(sql`SELECT COUNT(*) as count FROM chat_messages`),
    db.execute(sql`SELECT COUNT(*) as count FROM quiz_comments`),
  ]);

  return c.json({
    ok: true,
    users: Number((userCount.rows[0] as any).count),
    sessions: Number((sessionCount.rows[0] as any).count),
    chats: Number((chatCount.rows[0] as any).count),
    comments: Number((commentCount.rows[0] as any).count),
  });
});

export { health };
