import { Hono } from "hono";
import { sql } from "drizzle-orm";
import type { Bindings, Variables } from "../types";

const leaderboard = new Hono<{ Bindings: Bindings; Variables: Variables }>();

leaderboard.get("/:subjectId", async (c) => {
  const db = c.get("db");
  const subjectId = c.req.param("subjectId");

  const rows = await db.execute(sql`
    SELECT u.username,
           MAX(qa.percent) AS best_percent,
           MAX(qa.score) AS best_score,
           MAX(qa.total_questions) AS best_total,
           COUNT(qa.id) AS attempts
    FROM quiz_attempts qa
    JOIN users u ON u.id = qa.user_id
    WHERE qa.subject_id = ${subjectId}
    GROUP BY qa.user_id, u.username
    ORDER BY best_percent DESC, best_score DESC, attempts ASC, u.username ASC
    LIMIT 10
  `);

  return c.json({ leaderboard: rows.rows });
});

export { leaderboard };
