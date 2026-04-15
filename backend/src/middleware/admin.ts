import { createMiddleware } from "hono/factory";
import { eq } from "drizzle-orm";
import { sessions, users } from "../db/schema";
import type { Bindings, Variables } from "../types";

export const adminMiddleware = createMiddleware<{
  Bindings: Bindings;
  Variables: Variables;
}>(async (c, next) => {
  const host = String(c.req.header("host") ?? "").toLowerCase();
  const isLocalDevHost = host.includes("127.0.0.1") || host.includes("localhost");
  const adminEmail = String(c.env.ADMIN_EMAIL ?? "nodent.app@gmail.com")
    .trim()
    .toLowerCase();
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
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

    if (result.length > 0) {
      const session = result[0]!;
      if (new Date(session.expiresAt) >= new Date()) {
        // Local dev convenience: allow any signed-in user through admin routes.
        // This avoids local testing dead-ends when ADMIN_EMAIL doesn't match test users.
        if (isLocalDevHost) {
          c.set("user", {
            id: session.userId,
            email: session.email,
            username: session.username,
            token,
          });
          await next();
          return;
        }
        if (String(session.email || "").toLowerCase() === adminEmail) {
          c.set("user", {
            id: session.userId,
            email: session.email,
            username: session.username,
            token,
          });
          await next();
          return;
        }
      }
    }
  }

  // Legacy fallback: allow x-admin-key if configured (optional).
  const adminKeyHeader = c.req.header("x-admin-key");
  if (adminKeyHeader && c.env.ADMIN_KEY && adminKeyHeader === c.env.ADMIN_KEY) {
    await next();
    return;
  }

  return c.json({ error: "Forbidden" }, 403);
});
