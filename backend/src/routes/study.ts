import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import type { Bindings, Variables } from "../types";

/**
 * Minimal Study API for local dev stability.
 * The Worker backend doesn't persist study sessions yet; frontend uses local storage anyway.
 */
const study = new Hono<{ Bindings: Bindings; Variables: Variables }>();

study.get("/history", authMiddleware, async (c) => {
  return c.json({ sessions: [] });
});

study.post("/sync", authMiddleware, async (c) => {
  // Accept payload and no-op.
  await c.req.json().catch(() => null);
  return c.json({ ok: true });
});

study.put("/daily", authMiddleware, async (c) => {
  await c.req.json().catch(() => null);
  return c.json({ ok: true });
});

// Legacy endpoint shape used by API_PATHS.studyMode (not currently relied on for question content)
study.get("/:subjectId", authMiddleware, async (c) => {
  return c.json({ ok: true, subjectId: c.req.param("subjectId") });
});

export { study };

