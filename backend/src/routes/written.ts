import { Hono } from "hono";
import { eq, and, sql, lt } from "drizzle-orm";
import {
  uploadTokens,
  writtenResponses,
  peerResponseRatings,
} from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { cleanText, nowIso } from "../lib/utils";
import type { Bindings, Variables } from "../types";

const written = new Hono<{ Bindings: Bindings; Variables: Variables }>();

// Static paths first (avoids any ambiguity with `/:subjectId/:questionKey`).
written.post("/upload-token", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const body = await c.req.json();
  const subjectId = cleanText(body.subjectId, 80);
  const questionKey = cleanText(body.questionKey, 1000);
  if (!subjectId || !questionKey) {
    return c.json({ error: "subjectId and questionKey required." }, 400);
  }

  const token =
    typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const createdAt = nowIso();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 20).toISOString(); // 20 minutes

  try {
    await db.insert(uploadTokens).values({
      token,
      userId: user.id,
      subjectId,
      questionKey,
      createdAt,
      expiresAt,
    });
  } catch (err) {
    console.error("upload_tokens insert failed:", err);
    return c.json(
      {
        error:
          "Could not create upload token. Run database migrations so `upload_tokens` exists.",
      },
      500,
    );
  }

  return c.json({ ok: true, token, expiresAt });
});

written.post("/upload/:token", async (c) => {
  const db = c.get("db");
  const token = c.req.param("token");
  const body = await c.req.json().catch(() => null);
  const imageUrls = Array.isArray((body as any)?.imageUrls)
    ? (body as any).imageUrls.map(String)
    : [];
  if (!token || imageUrls.length === 0) {
    return c.json({ error: "token and imageUrls required." }, 400);
  }

  await db.delete(uploadTokens).where(lt(uploadTokens.expiresAt, nowIso()));

  const tokRows = await db
    .select()
    .from(uploadTokens)
    .where(eq(uploadTokens.token, token))
    .limit(1);
  if (!tokRows.length) return c.json({ error: "Invalid or expired token." }, 403);
  const t = tokRows[0];
  if (String(t.expiresAt) < nowIso()) {
    await db.delete(uploadTokens).where(eq(uploadTokens.token, token));
    return c.json({ error: "Token expired." }, 403);
  }

  try {
    await db.execute(sql`
      INSERT INTO written_responses (user_id, subject_id, question_key, response_text, image_urls, updated_at)
      VALUES (${t.userId}, ${t.subjectId}, ${t.questionKey}, '', ${JSON.stringify(imageUrls)}, ${nowIso()})
      ON CONFLICT(user_id, subject_id, question_key) DO UPDATE SET
        image_urls = ${JSON.stringify(imageUrls)},
        updated_at = EXCLUDED.updated_at
    `);
  } catch (err) {
    console.error("written_responses upsert (upload) failed:", err);
    return c.json(
      {
        error:
          "Could not save images. Ensure migrations ran (written_responses.image_urls).",
      },
      500,
    );
  }

  await db.delete(uploadTokens).where(eq(uploadTokens.token, token));

  return c.json({ ok: true });
});

// Get all responses for a question (include images)
written.get("/:subjectId/:questionKey/all", authMiddleware, async (c) => {
  const db = c.get("db");
  const subjectId = c.req.param("subjectId");
  const questionKey = c.req.param("questionKey");

  const user = c.get("user");
  const me = user.id;

  const rows = await db.execute(sql`
    SELECT wr.response_text, wr.image_urls, wr.updated_at, wr.user_id
    FROM written_responses wr
    WHERE wr.subject_id = ${subjectId} AND wr.question_key = ${questionKey}
    ORDER BY wr.updated_at DESC
  `);

  const aggRows = await db.execute(sql`
    SELECT target_user_id::int AS target_user_id,
           AVG(score)::float AS peer_avg,
           COUNT(*)::int AS peer_cnt
    FROM peer_response_ratings
    WHERE subject_id = ${subjectId} AND question_key = ${questionKey}
    GROUP BY target_user_id
  `);

  const myRows = await db.execute(sql`
    SELECT target_user_id::int AS target_user_id, score
    FROM peer_response_ratings
    WHERE subject_id = ${subjectId}
      AND question_key = ${questionKey}
      AND rater_user_id = ${me}
  `);

  const aggMap = new Map<
    number,
    { peerAverage: number | null; peerRatingCount: number }
  >();
  for (const row of aggRows.rows as {
    target_user_id: number;
    peer_avg: string | number | null;
    peer_cnt: string | number | null;
  }[]) {
    const cnt = Number(row.peer_cnt ?? 0);
    const raw = row.peer_avg;
    const peerAverage =
      cnt > 0 && raw != null ? Math.round(Number(raw) * 10) / 10 : null;
    aggMap.set(row.target_user_id, {
      peerAverage,
      peerRatingCount: cnt,
    });
  }

  const myMap = new Map<number, number>();
  for (const row of myRows.rows as {
    target_user_id: number;
    score: number;
  }[]) {
    myMap.set(row.target_user_id, row.score);
  }

  return c.json({
    responses: (rows.rows as any[]).map((row) => {
      const uid = row.user_id as number;
      const agg = aggMap.get(uid);
      const cnt = agg?.peerRatingCount ?? 0;
      return {
        text: row.response_text,
        imageUrls: row.image_urls ? JSON.parse(row.image_urls) : [],
        updatedAt: row.updated_at,
        userId: uid,
        peerAverage: cnt > 0 ? (agg?.peerAverage ?? null) : null,
        peerRatingCount: cnt,
        myScore: myMap.get(uid) ?? null,
      };
    }),
  });
});

// Peer rate another student’s response (1–5). Upsert per (rater, question, target).
written.post("/:subjectId/:questionKey/rate", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const subjectId = c.req.param("subjectId");
  const questionKey = c.req.param("questionKey");
  const body = await c.req.json().catch(() => null);
  const targetUserId = Number((body as any)?.targetUserId);
  const score = Number((body as any)?.score);

  if (!Number.isFinite(targetUserId) || targetUserId < 1) {
    return c.json({ error: "targetUserId required." }, 400);
  }
  if (!Number.isFinite(score) || score < 1 || score > 5 || score !== Math.floor(score)) {
    return c.json({ error: "score must be an integer from 1 to 5." }, 400);
  }
  if (targetUserId === user.id) {
    return c.json({ error: "You cannot rate your own response." }, 400);
  }

  const targetRows = await db
    .select({
      responseText: writtenResponses.responseText,
      imageUrls: writtenResponses.imageUrls,
    })
    .from(writtenResponses)
    .where(
      and(
        eq(writtenResponses.userId, targetUserId),
        eq(writtenResponses.subjectId, subjectId),
        eq(writtenResponses.questionKey, questionKey),
      ),
    )
    .limit(1);

  if (!targetRows.length) {
    return c.json({ error: "That student has no saved answer for this question." }, 400);
  }

  const t = targetRows[0];
  const hasText = (t.responseText ?? "").trim().length > 0;
  const imgs = t.imageUrls ? (JSON.parse(t.imageUrls) as unknown[]) : [];
  const hasImages = Array.isArray(imgs) && imgs.length > 0;
  if (!hasText && !hasImages) {
    return c.json({ error: "Nothing to rate." }, 400);
  }

  try {
    await db
      .insert(peerResponseRatings)
      .values({
        raterUserId: user.id,
        subjectId,
        questionKey,
        targetUserId,
        score,
        createdAt: nowIso(),
      })
      .onConflictDoUpdate({
        target: [
          peerResponseRatings.raterUserId,
          peerResponseRatings.subjectId,
          peerResponseRatings.questionKey,
          peerResponseRatings.targetUserId,
        ],
        set: { score },
      });
  } catch (err) {
    console.error("peer_response_ratings upsert failed:", err);
    return c.json(
      {
        error:
          "Could not save rating. Run database migrations so `peer_response_ratings` exists.",
      },
      500,
    );
  }

  return c.json({ ok: true });
});

// Get user's own response
written.get("/:subjectId/:questionKey", authMiddleware, async (c) => {
  const user = c.get("user");
  const db = c.get("db");
  const subjectId = c.req.param("subjectId");
  const questionKey = c.req.param("questionKey");

  const rows = await db
    .select({
      responseText: writtenResponses.responseText,
      imageUrls: writtenResponses.imageUrls,
      updatedAt: writtenResponses.updatedAt,
    })
    .from(writtenResponses)
    .where(
      and(
        eq(writtenResponses.userId, user.id),
        eq(writtenResponses.subjectId, subjectId),
        eq(writtenResponses.questionKey, questionKey),
      ),
    )
    .limit(1);

  const ratingRows = await db.execute(sql`
    SELECT AVG(score)::float AS avg, COUNT(*)::int AS cnt
    FROM peer_response_ratings
    WHERE subject_id = ${subjectId}
      AND question_key = ${questionKey}
      AND target_user_id = ${user.id}
  `);
  const r0 = (ratingRows.rows as { avg: string | number | null; cnt: string | number | null }[])[0];
  const cnt = Number(r0?.cnt ?? 0);
  const rawAvg = r0?.avg;
  const yourPeerRating = {
    average:
      cnt > 0 && rawAvg != null ? Math.round(Number(rawAvg) * 10) / 10 : null,
    count: cnt,
  };

  return c.json({
    response:
      rows.length > 0
        ? {
            text: rows[0].responseText,
            imageUrls: rows[0].imageUrls ? JSON.parse(rows[0].imageUrls) : [],
            updatedAt: rows[0].updatedAt,
          }
        : null,
    yourPeerRating,
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
  const imageUrls = Array.isArray(body.imageUrls)
    ? JSON.stringify(body.imageUrls.map(String))
    : null;
  if (!responseText && !imageUrls) {
    return c.json({ error: "Response cannot be empty." }, 400);
  }

  await db.execute(sql`
    INSERT INTO written_responses (user_id, subject_id, question_key, response_text, image_urls, updated_at)
    VALUES (${user.id}, ${subjectId}, ${questionKey}, ${responseText || ""}, ${imageUrls}, ${nowIso()})
    ON CONFLICT(user_id, subject_id, question_key) DO UPDATE SET
      response_text = EXCLUDED.response_text,
      image_urls = COALESCE(EXCLUDED.image_urls, written_responses.image_urls),
      updated_at = EXCLUDED.updated_at
  `);

  return c.json({ ok: true });
});

export { written };
