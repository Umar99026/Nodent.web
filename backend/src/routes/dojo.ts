import { Hono } from "hono";
import { authMiddleware } from "../middleware/auth";
import type { Bindings, Variables } from "../types";

/**
 * Minimal Dojo API for local dev stability.
 * (The full Dojo feature set lives in the legacy Express server right now.)
 */
const dojo = new Hono<{ Bindings: Bindings; Variables: Variables }>();

dojo.get("/unread-count", authMiddleware, async (c) => {
  return c.json({ count: 0 });
});

dojo.get("/challenges", authMiddleware, async (c) => {
  return c.json({ challenges: [] });
});

dojo.post("/challenges/read", authMiddleware, async (c) => {
  return c.json({ ok: true });
});

dojo.get("/users", authMiddleware, async (c) => {
  const q = c.req.query("search") ?? "";
  // Keep shape compatible with frontend. Return empty list for now.
  return c.json({ users: [], query: q });
});

dojo.post("/challenges", authMiddleware, async (c) => {
  // Accept but do nothing — feature not implemented in Worker backend yet.
  return c.json({ ok: true, challengeId: String(Date.now()) });
});

dojo.post("/challenges/:challengeId/accept", authMiddleware, async (c) => {
  return c.json({ ok: true });
});

dojo.get("/battles/:battleId", authMiddleware, async (c) => {
  // Shape is app-specific; return a safe stub.
  return c.json({ ok: false, error: "Dojo battles are not available in local Worker API." }, 501);
});

dojo.post("/battles/:battleId/answer", authMiddleware, async (c) => {
  return c.json({ ok: false, error: "Dojo battles are not available in local Worker API." }, 501);
});

export { dojo };

