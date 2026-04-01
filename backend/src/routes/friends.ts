import { Hono } from "hono";
import { and, eq, sql } from "drizzle-orm";
import {
  friendAssignments,
  friendRequests,
  friendships,
  users,
} from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import type { Bindings, Variables } from "../types";
import { cleanText, nowIso } from "../lib/utils";

const friends = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function friendshipPair(a: number, b: number): { low: number; high: number } {
  const aa = Number(a);
  const bb = Number(b);
  return aa < bb ? { low: aa, high: bb } : { low: bb, high: aa };
}

function normalizeAnswer(text: unknown): string {
  return String(text ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function scoreAssignedQuestion(question: any, answerPayload: any): boolean {
  const q = question || {};
  const t = String(q.type || "").toLowerCase();
  if (t === "mcq") {
    const a = normalizeAnswer(answerPayload?.answer);
    const expected = normalizeAnswer(q.answer);
    return Boolean(a && expected && a === expected);
  }
  if (t === "short") {
    const a = normalizeAnswer(answerPayload?.answer);
    const accepted = Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [];
    return accepted.some((x: any) => normalizeAnswer(x) === a);
  }
  return false;
}

friends.get("/", authMiddleware, async (c) => {
  const me = c.get("user");
  const db = c.get("db");

  const rows = await db.execute(sql`
    SELECT
      CASE WHEN f.user_low = ${me.id} THEN f.user_high ELSE f.user_low END AS user_id,
      u.username,
      u.email
    FROM friendships f
    JOIN users u
      ON u.id = CASE WHEN f.user_low = ${me.id} THEN f.user_high ELSE f.user_low END
    WHERE f.user_low = ${me.id} OR f.user_high = ${me.id}
    ORDER BY LOWER(u.username) ASC
  `);

  return c.json({
    friends: (rows.rows as any[]).map((r) => ({
      userId: Number(r.user_id),
      username: String(r.username || ""),
      email: String(r.email || ""),
    })),
  });
});

friends.get("/requests", authMiddleware, async (c) => {
  const me = c.get("user");
  const db = c.get("db");

  const incoming = await db.execute(sql`
    SELECT fr.id AS request_id, fr.from_user_id, u.username
    FROM friend_requests fr
    JOIN users u ON u.id = fr.from_user_id
    WHERE fr.to_user_id = ${me.id} AND fr.status = 'pending'
    ORDER BY fr.created_at DESC, fr.id DESC
  `);

  const outgoing = await db.execute(sql`
    SELECT fr.id AS request_id, fr.to_user_id, u.username
    FROM friend_requests fr
    JOIN users u ON u.id = fr.to_user_id
    WHERE fr.from_user_id = ${me.id} AND fr.status = 'pending'
    ORDER BY fr.created_at DESC, fr.id DESC
  `);

  return c.json({
    incoming: (incoming.rows as any[]).map((r) => ({
      requestId: Number(r.request_id),
      userId: Number(r.from_user_id),
      username: String(r.username || ""),
    })),
    outgoing: (outgoing.rows as any[]).map((r) => ({
      requestId: Number(r.request_id),
      userId: Number(r.to_user_id),
      username: String(r.username || ""),
    })),
  });
});

friends.get("/unread-count", authMiddleware, async (c) => {
  const me = c.get("user");
  const db = c.get("db");
  const r = await db.execute(sql`
    SELECT COUNT(*)::integer AS cnt
    FROM friend_requests
    WHERE to_user_id = ${me.id} AND status = 'pending'
  `);
  return c.json({ count: Number((r.rows as any[])[0]?.cnt ?? 0) });
});

friends.get("/search", authMiddleware, async (c) => {
  const me = c.get("user");
  const db = c.get("db");
  const q = cleanText(c.req.query("search") || "", 120).toLowerCase();
  if (!q || q.length < 2) return c.json({ results: [] });

  const rows = await db.execute(sql`
    SELECT id, username, email
    FROM users
    WHERE id <> ${me.id}
      AND (LOWER(username) LIKE ${"%" + q + "%"} OR LOWER(email) LIKE ${"%" + q + "%"})
    ORDER BY (LOWER(username) = ${q}) DESC, LOWER(username) ASC
    LIMIT 20
  `);

  return c.json({
    results: (rows.rows as any[]).map((r) => ({
      userId: Number(r.id),
      username: String(r.username || ""),
      email: String(r.email || ""),
    })),
  });
});

friends.post("/requests", authMiddleware, async (c) => {
  const me = c.get("user");
  const db = c.get("db");
  const body = await c.req.json();
  const toUserId = Number(body?.toUserId);

  if (!Number.isFinite(toUserId) || toUserId <= 0) {
    return c.json({ error: "Invalid user." }, 400);
  }
  if (toUserId === Number(me.id)) {
    return c.json({ error: "Cannot add yourself." }, 400);
  }

  const { low, high } = friendshipPair(Number(me.id), toUserId);
  const existingFriend = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(and(eq(friendships.userLow, low), eq(friendships.userHigh, high)))
    .limit(1);
  if (existingFriend.length) return c.json({ ok: true, status: "friends" });

  const reverse = await db
    .select({ id: friendRequests.id })
    .from(friendRequests)
    .where(
      and(
        eq(friendRequests.fromUserId, toUserId),
        eq(friendRequests.toUserId, Number(me.id)),
        eq(friendRequests.status, "pending")
      )
    )
    .limit(1);

  if (reverse.length) {
    await db
      .update(friendRequests)
      .set({ status: "accepted" })
      .where(eq(friendRequests.id, reverse[0].id));
    await db
      .insert(friendships)
      .values({ userLow: low, userHigh: high, createdAt: nowIso() })
      .onConflictDoNothing();
    return c.json({ ok: true, status: "friends" });
  }

  const pending = await db
    .select({ id: friendRequests.id })
    .from(friendRequests)
    .where(
      and(
        eq(friendRequests.fromUserId, Number(me.id)),
        eq(friendRequests.toUserId, toUserId),
        eq(friendRequests.status, "pending")
      )
    )
    .limit(1);
  if (pending.length) return c.json({ ok: true, status: "requested" });

  await db.insert(friendRequests).values({
    fromUserId: Number(me.id),
    toUserId,
    status: "pending",
    createdAt: nowIso(),
  });

  return c.json({ ok: true, status: "requested" });
});

friends.post("/requests/:requestId/accept", authMiddleware, async (c) => {
  const me = c.get("user");
  const db = c.get("db");
  const requestId = Number(c.req.param("requestId"));

  const reqRow = await db
    .select()
    .from(friendRequests)
    .where(
      and(
        eq(friendRequests.id, requestId),
        eq(friendRequests.toUserId, Number(me.id)),
        eq(friendRequests.status, "pending")
      )
    )
    .limit(1);

  if (!reqRow.length) return c.json({ error: "Request not found." }, 404);

  const fromUserId = Number(reqRow[0].fromUserId);
  const { low, high } = friendshipPair(Number(me.id), fromUserId);

  await db
    .update(friendRequests)
    .set({ status: "accepted" })
    .where(eq(friendRequests.id, requestId));

  await db
    .insert(friendships)
    .values({ userLow: low, userHigh: high, createdAt: nowIso() })
    .onConflictDoNothing();

  return c.json({ ok: true });
});

friends.post("/requests/:requestId/reject", authMiddleware, async (c) => {
  const me = c.get("user");
  const db = c.get("db");
  const requestId = Number(c.req.param("requestId"));

  const reqRow = await db
    .select({ id: friendRequests.id })
    .from(friendRequests)
    .where(
      and(
        eq(friendRequests.id, requestId),
        eq(friendRequests.toUserId, Number(me.id)),
        eq(friendRequests.status, "pending")
      )
    )
    .limit(1);

  if (!reqRow.length) return c.json({ error: "Request not found." }, 404);

  await db
    .update(friendRequests)
    .set({ status: "rejected" })
    .where(eq(friendRequests.id, requestId));

  return c.json({ ok: true });
});

friends.get("/:friendId/thread", authMiddleware, async (c) => {
  const me = c.get("user");
  const db = c.get("db");
  const friendId = Number(c.req.param("friendId"));
  if (!Number.isFinite(friendId) || friendId <= 0) return c.json({ messages: [] });

  const rows = await db.execute(sql`
    SELECT
      id,
      from_user_id,
      to_user_id,
      subject_id,
      question_key,
      question_json,
      marks,
      answer_json,
      is_correct,
      created_at,
      answered_at
    FROM friend_assignments
    WHERE (from_user_id = ${me.id} AND to_user_id = ${friendId})
       OR (from_user_id = ${friendId} AND to_user_id = ${me.id})
    ORDER BY created_at ASC, id ASC
    LIMIT 500
  `);

  return c.json({
    messages: (rows.rows as any[]).map((r) => ({
      assignmentId: Number(r.id),
      fromUserId: Number(r.from_user_id),
      toUserId: Number(r.to_user_id),
      subjectId: String(r.subject_id || ""),
      questionKey: String(r.question_key || ""),
      question: (() => {
        try {
          return JSON.parse(String(r.question_json || "{}"));
        } catch {
          return {};
        }
      })(),
      marks: Number(r.marks || 1),
      answer: r.answer_json
        ? (() => {
            try {
              return JSON.parse(String(r.answer_json));
            } catch {
              return null;
            }
          })()
        : null,
      isCorrect: r.is_correct == null ? null : Boolean(Number(r.is_correct)),
      createdAt: String(r.created_at || ""),
      answeredAt: r.answered_at ? String(r.answered_at) : null,
    })),
  });
});

friends.post("/:friendId/assign", authMiddleware, async (c) => {
  const me = c.get("user");
  const db = c.get("db");
  const friendId = Number(c.req.param("friendId"));
  const body = await c.req.json();

  const subjectId = cleanText(body?.subjectId, 80);
  const question = body?.question ?? null;
  const questionKey =
    cleanText(body?.questionKey || "", 2000) ||
    cleanText(body?.question?.question || "", 2000);
  const marksNum = Number(body?.marks ?? body?.question?.marks ?? 1);
  const marks = Number.isFinite(marksNum) && marksNum > 0 ? Math.round(marksNum) : 1;

  if (!Number.isFinite(friendId) || friendId <= 0) return c.json({ error: "Invalid friend." }, 400);
  if (!subjectId) return c.json({ error: "Invalid subject." }, 400);
  if (!question || typeof question !== "object") return c.json({ error: "Invalid question." }, 400);
  if (!questionKey) return c.json({ error: "Invalid question key." }, 400);

  const { low, high } = friendshipPair(Number(me.id), friendId);
  const isFriend = await db
    .select({ id: friendships.id })
    .from(friendships)
    .where(and(eq(friendships.userLow, low), eq(friendships.userHigh, high)))
    .limit(1);
  if (!isFriend.length) return c.json({ error: "Not friends." }, 403);

  await db.insert(friendAssignments).values({
    fromUserId: Number(me.id),
    toUserId: friendId,
    subjectId,
    questionKey,
    questionJson: JSON.stringify(question),
    marks,
    createdAt: nowIso(),
  });

  return c.json({ ok: true });
});

friends.post("/assignments/:assignmentId/answer", authMiddleware, async (c) => {
  const me = c.get("user");
  const db = c.get("db");
  const assignmentId = Number(c.req.param("assignmentId"));
  const body = await c.req.json();

  const row = await db
    .select()
    .from(friendAssignments)
    .where(eq(friendAssignments.id, assignmentId))
    .limit(1);
  if (!row.length) return c.json({ error: "Not found." }, 404);
  if (Number(row[0].toUserId) !== Number(me.id)) return c.json({ error: "Forbidden." }, 403);

  let question: any = {};
  try {
    question = JSON.parse(String(row[0].questionJson || "{}"));
  } catch {
    question = {};
  }

  const isCorrect = scoreAssignedQuestion(question, body) ? 1 : 0;

  await db
    .update(friendAssignments)
    .set({
      answerJson: JSON.stringify(body ?? {}),
      isCorrect,
      answeredAt: nowIso(),
    })
    .where(eq(friendAssignments.id, assignmentId));

  return c.json({ ok: true, isCorrect: Boolean(isCorrect) });
});

friends.get("/:friendId/scorecard", authMiddleware, async (c) => {
  const db = c.get("db");
  const friendId = Number(c.req.param("friendId"));
  if (!Number.isFinite(friendId) || friendId <= 0) return c.json({ error: "Invalid user." }, 400);

  const assigned = await db.execute(sql`
    SELECT
      COUNT(*)::integer AS total_assigned,
      COUNT(*) FILTER (WHERE answered_at IS NOT NULL)::integer AS total_answered,
      COALESCE(SUM(CASE WHEN is_correct = 1 THEN marks ELSE 0 END), 0)::integer AS points
    FROM friend_assignments
    WHERE to_user_id = ${friendId}
  `);

  const r = (assigned.rows as any[])[0] || {};
  return c.json({
    userId: friendId,
    points: Number(r.points ?? 0),
    correct: null,
    attempts: Number(r.total_answered ?? 0),
    totalAssigned: Number(r.total_assigned ?? 0),
  });
});

export { friends };

