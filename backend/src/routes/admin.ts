import { Hono } from "hono";
import { eq, asc } from "drizzle-orm";
import { customQuestions } from "../db/schema";
import { adminMiddleware } from "../middleware/admin";
import { canonicalSubjectId, cleanText, nowIso } from "../lib/utils";
import {
  isSheetsConfigured,
  sheetsGetTabNames,
  sheetsSubjectIdFromTabMode,
  sheetsReadDataRows,
  sheetsListSpreadsheetTabTitles,
  sheetsParseRow,
} from "../lib/googleSheets";
import type { Bindings, Variables } from "../types";

const admin = new Hono<{ Bindings: Bindings; Variables: Variables }>();

admin.get("/questions", adminMiddleware, async (c) => {
  const db = c.get("db");

  const rows = await db
    .select()
    .from(customQuestions)
    .orderBy(asc(customQuestions.subjectId), asc(customQuestions.createdAt));

  const grouped: Record<string, any[]> = {};
  for (const row of rows) {
    if (!grouped[row.subjectId]) grouped[row.subjectId] = [];
    grouped[row.subjectId].push({
      id: row.id,
      type: row.type,
      question: row.question,
      options: row.options ? JSON.parse(row.options) : undefined,
      answer: row.answer || undefined,
      acceptedAnswers: row.acceptedAnswers
        ? JSON.parse(row.acceptedAnswers)
        : undefined,
      guidance: row.guidance || undefined,
      passage: row.passage || undefined,
    });
  }

  return c.json({ customQuestions: grouped });
});

admin.post("/questions", adminMiddleware, async (c) => {
  const db = c.get("db");
  const body = await c.req.json();

  const subjectId = cleanText(body.subjectId, 80);
  const type = cleanText(body.type, 20);
  const question = cleanText(body.question, 1000);
  const options = body.options ? JSON.stringify(body.options) : null;
  const answer = body.answer ? cleanText(body.answer, 500) : null;
  const acceptedAnswers = body.acceptedAnswers
    ? JSON.stringify(body.acceptedAnswers)
    : null;
  const guidance = body.guidance ? cleanText(body.guidance, 500) : null;
  const passage = body.passage ? cleanText(body.passage, 3000) : null;

  if (!subjectId || !type || !question) {
    return c.json(
      { error: "subjectId, type, and question are required." },
      400
    );
  }

  const result = await db
    .insert(customQuestions)
    .values({
      subjectId,
      type,
      question,
      options,
      answer,
      acceptedAnswers,
      guidance,
      passage,
      createdAt: nowIso(),
    })
    .returning({ id: customQuestions.id });

  return c.json({ ok: true, id: result[0].id });
});

admin.delete("/questions/:id", adminMiddleware, async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));

  await db.delete(customQuestions).where(eq(customQuestions.id, id));
  return c.json({ ok: true });
});

admin.get("/google-sheet/status", adminMiddleware, async (c) => {
  const env = c.env;
  const enabled = isSheetsConfigured(env);
  return c.json({
    enabled,
    tabs: enabled ? sheetsGetTabNames(env) : [],
    subjectFromTab: enabled ? sheetsSubjectIdFromTabMode(env) : false,
  });
});

admin.get("/google-sheet/diagnose", adminMiddleware, async (c) => {
  const env = c.env;
  if (!isSheetsConfigured(env)) {
    return c.json(
      { error: "Google Sheets is not configured. Set GOOGLE_* vars / secrets on the Worker." },
      503,
    );
  }
  try {
    const configuredTabs = sheetsGetTabNames(env);
    const spreadsheetTabTitles = await sheetsListSpreadsheetTabTitles(env);
    const missingFromSpreadsheet = configuredTabs.filter(
      (t) => !spreadsheetTabTitles.includes(t),
    );
    return c.json({
      spreadsheetTabTitles,
      missingFromSpreadsheet,
      hint:
        missingFromSpreadsheet.length > 0
          ? "Create a tab for each missing name exactly as listed (same spelling/case), or change GOOGLE_SHEETS_TAB_NAME to match existing tab names."
          : null,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[google-sheet/diagnose]", msg);
    return c.json({ error: msg }, 500);
  }
});

admin.post("/questions/sync-from-sheet", adminMiddleware, async (c) => {
  const env = c.env;
  const db = c.get("db");
  if (!isSheetsConfigured(env)) {
    return c.json(
      {
        error:
          "Google Sheets is not configured. In Cloudflare → nodent-api Worker → Settings → Variables add GOOGLE_SHEETS_SPREADSHEET_ID and GOOGLE_SHEETS_TAB_NAME; add GOOGLE_SERVICE_ACCOUNT_JSON as Secret (full service account JSON).",
      },
      503,
    );
  }

  try {
    const { rows: rawRows, tabErrors } = await sheetsReadDataRows(env);
    let imported = 0;
    let updated = 0;
    let deleted = 0;
    const errors: { row: number; message: string }[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const item = rawRows[i]!;
      const row = item.row;
      const tabName = item.tabName;
      const p = sheetsParseRow(Array.isArray(row) ? row : []);
      if (sheetsSubjectIdFromTabMode(env) && tabName) {
        p.subject_id = tabName;
      }
      const action = (p.action || "").toUpperCase();
      const databaseId = p.database_id ? parseInt(p.database_id, 10) : NaN;

      try {
        if (action === "DELETE" && Number.isFinite(databaseId)) {
          await db
            .delete(customQuestions)
            .where(eq(customQuestions.id, databaseId));
          deleted++;
          continue;
        }

        if (!p.subject_id || !p.type || !p.question) {
          continue;
        }

        const subjectIdSheet = canonicalSubjectId(cleanText(p.subject_id, 80));
        const topic = p.topic || "General";
        const marks = Math.max(1, Math.round(Number(p.marks) || 1));
        const optionsJson = p.options_json || null;
        const acceptedRaw = p.accepted_answers_json || null;
        const imageUrlsJson = p.image_urls_json || null;
        const answer = p.answer || null;
        const guidance = p.guidance || null;
        const passage = p.passage || null;
        const createdAt = nowIso();

        if (Number.isFinite(databaseId)) {
          const exists = await db
            .select({ id: customQuestions.id })
            .from(customQuestions)
            .where(eq(customQuestions.id, databaseId))
            .limit(1);
          if (exists.length > 0) {
            await db
              .update(customQuestions)
              .set({
                subjectId: subjectIdSheet,
                type: p.type,
                topic,
                question: p.question,
                imageUrls: imageUrlsJson,
                options: optionsJson,
                answer,
                acceptedAnswers: acceptedRaw,
                guidance,
                passage,
                marks,
              })
              .where(eq(customQuestions.id, databaseId));
            updated++;
          } else {
            await db.insert(customQuestions).values({
              subjectId: subjectIdSheet,
              type: p.type,
              topic,
              question: p.question,
              imageUrls: imageUrlsJson,
              options: optionsJson,
              answer,
              acceptedAnswers: acceptedRaw,
              guidance,
              passage,
              marks,
              createdAt,
            });
            imported++;
          }
        } else {
          await db.insert(customQuestions).values({
            subjectId: subjectIdSheet,
            type: p.type,
            topic,
            question: p.question,
            imageUrls: imageUrlsJson,
            options: optionsJson,
            answer,
            acceptedAnswers: acceptedRaw,
            guidance,
            passage,
            marks,
            createdAt,
          });
          imported++;
        }
      } catch (e: unknown) {
        errors.push({
          row: i + 2,
          message: String(e instanceof Error ? e.message : e),
        });
      }
    }

    return c.json({
      ok: true,
      imported,
      updated,
      deleted,
      errors,
      tabErrors,
      rowsRead: rawRows.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[admin/questions/sync-from-sheet]", msg);
    return c.json({ error: `Could not sync from Google Sheet: ${msg}` }, 500);
  }
});

export { admin };
