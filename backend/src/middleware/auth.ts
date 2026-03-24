import { createMiddleware } from "hono/factory";
import { eq, and, sql } from "drizzle-orm";
import { sessions, users } from "../db/schema";
import type { Bindings, Variables } from "../types";

export const authMiddleware = createMiddleware<{
  Bindings: Bindings;
  Variables: Variables;
}>(async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Authentication required." }, 401);
  }

  const token = authHeader.slice(7);
  const db = c.get("db");

  const result = await db
    .select({
      userId: users.id,
      email: users.email,
      username: users.username,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(eq(sessions.token, token))
    .limit(1);

  if (result.length === 0) {
    return c.json({ error: "Invalid session. Please log in again." }, 401);
  }

  const session = result[0];

  if (new Date(session.expiresAt) < new Date()) {
    await db.delete(sessions).where(eq(sessions.token, token));
    return c.json({ error: "Session expired. Please log in again." }, 401);
  }

  c.set("user", {
    id: session.userId,
    email: session.email,
    username: session.username,
    token,
  });

  await next();
});
