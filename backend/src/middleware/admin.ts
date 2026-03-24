import { createMiddleware } from "hono/factory";
import type { Bindings, Variables } from "../types";

export const adminMiddleware = createMiddleware<{
  Bindings: Bindings;
  Variables: Variables;
}>(async (c, next) => {
  const adminKey = c.req.header("x-admin-key");
  if (!adminKey || adminKey !== c.env.ADMIN_KEY) {
    return c.json({ error: "Forbidden" }, 403);
  }
  await next();
});
