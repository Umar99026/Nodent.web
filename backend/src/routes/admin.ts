import { Hono } from "hono";
import { eq, asc, sql } from "drizzle-orm";
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
import { extractQuestionsFromPdf, extractQuestionsFromPdfFallback } from "../lib/pdfImport";
import type { Bindings, Variables } from "../types";

const admin = new Hono<{ Bindings: Bindings; Variables: Variables }>();

function normalizeTopicLabel(raw: unknown): string {
  const topic = cleanText(String(raw ?? ""), 120) || "General";
  // Prevent placeholder import labels from becoming visible to students.
  if (/^(?:test(?:\s*pdf)?|pdf\s*test)$/i.test(topic)) return "General";
  return topic;
}

admin.get("/questions", adminMiddleware, async (c) => {
  const db = c.get("db");

  const rows = await db
    .select({
      id: customQuestions.id,
      subjectId: customQuestions.subjectId,
      type: customQuestions.type,
      topic: customQuestions.topic,
      question: customQuestions.question,
      imageUrls: customQuestions.imageUrls,
      options: customQuestions.options,
      answer: customQuestions.answer,
      acceptedAnswers: customQuestions.acceptedAnswers,
      guidance: customQuestions.guidance,
      passage: customQuestions.passage,
      marks: customQuestions.marks,
      createdAt: customQuestions.createdAt,
    })
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
      imageUrls: row.imageUrls ? JSON.parse(row.imageUrls) : undefined,
      topic: row.topic || undefined,
      marks: row.marks || undefined,
    });
  }

  return c.json({ customQuestions: grouped });
});

admin.post("/questions", adminMiddleware, async (c) => {
  const db = c.get("db");
  const body = await c.req.json();

  const subjectId = cleanText(body.subjectId, 80);
  const type = cleanText(body.type, 20);
  const question = cleanText(body.question, 4000);
  const options = body.options ? JSON.stringify(body.options) : null;
  const answer = body.answer ? cleanText(body.answer, 500) : null;
  const acceptedAnswers = body.acceptedAnswers
    ? JSON.stringify(body.acceptedAnswers)
    : null;
  const guidance = body.guidance ? cleanText(body.guidance, 500) : null;
  const passage = body.passage ? cleanText(body.passage, 6000) : null;
  const topic = normalizeTopicLabel(body.topic);
  const marks = Math.max(1, Math.round(Number(body.marks) || 1));
  const imageUrls = body.imageUrls ? JSON.stringify(body.imageUrls) : null;
  const answerImageUrls = body.answerImageUrls
    ? JSON.stringify(body.answerImageUrls)
    : null;

  if (!subjectId || !type || !question) {
    return c.json(
      { error: "subjectId, type, and question are required." },
      400
    );
  }

  const createdAt = nowIso();
  const inserted = await db.execute(sql`
    INSERT INTO custom_questions
    (subject_id, type, topic, question, image_urls, options, answer, accepted_answers, guidance, passage, marks, created_at)
    VALUES
    (${subjectId}, ${type}, ${topic}, ${question}, ${imageUrls}, ${options}, ${answer}, ${acceptedAnswers}, ${guidance}, ${passage}, ${marks}, ${createdAt})
    RETURNING id
  `);

  const id = Number((inserted.rows as any[])[0]?.id ?? 0);
  return c.json({ ok: true, id });
});

admin.delete("/questions/:id", adminMiddleware, async (c) => {
  const db = c.get("db");
  const id = Number(c.req.param("id"));

  await db.delete(customQuestions).where(eq(customQuestions.id, id));
  return c.json({ ok: true });
});

function safeJsonParseArray(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;
  try {
    const parsed = JSON.parse(t) as unknown;
    if (Array.isArray(parsed)) return parsed.map(String);
    return null;
  } catch {
    return null;
  }
}

function parseFlexibleArray(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof raw !== "string") return null;
  const t = raw.trim();
  if (!t) return null;

  const json = safeJsonParseArray(t);
  if (json) return json.map((s) => String(s).trim()).filter(Boolean);

  // Accept common paste formats: pipe-separated or one-per-line
  const sep = t.includes("|") ? "|" : "\n";
  const parts = t
    .split(sep)
    .map((s) => s.trim())
    .filter(Boolean);
  return parts.length ? parts : null;
}

/**
 * Bulk insert custom questions.
 * Accepts pasted-sheet rows (already validated client-side), but re-validates server-side.
 */
admin.post("/questions/bulk", adminMiddleware, async (c) => {
  const db = c.get("db");
  const body = (await c.req.json().catch(() => null)) as
    | { questions?: unknown; dryRun?: unknown }
    | null;

  const dryRun = Boolean((body as any)?.dryRun);
  const list = (body as any)?.questions;
  if (!Array.isArray(list) || list.length === 0) {
    return c.json({ error: "questions must be a non-empty array." }, 400);
  }

  const createdAt = nowIso();
  let imported = 0;
  const errors: { index: number; message: string }[] = [];

  for (let i = 0; i < list.length; i++) {
    const raw = list[i];
    if (!raw || typeof raw !== "object") {
      errors.push({ index: i, message: "Row is not an object." });
      continue;
    }
    const q = raw as Record<string, unknown>;

    const subjectId = canonicalSubjectId(cleanText(q.subjectId, 80));
    const type = cleanText(q.type, 20).toLowerCase();
    const topic = normalizeTopicLabel(q.topic);
    const question = cleanText(q.question, 4000);
    const passage = q.passage ? cleanText(q.passage, 6000) : null;
    const guidance = q.guidance ? cleanText(q.guidance, 1000) : null;
    const marks = Math.max(1, Math.round(Number(q.marks) || (type === "mcq" ? 1 : 2)));

    const optionsArr =
      parseFlexibleArray(q.options_json) ??
      (Array.isArray(q.options) ? (q.options as any[]).map(String) : null);
    const acceptedArr =
      parseFlexibleArray(q.accepted_answers_json) ??
      (Array.isArray(q.acceptedAnswers) ? (q.acceptedAnswers as any[]).map(String) : null);
    const imageArr =
      parseFlexibleArray(q.image_urls_json) ??
      (Array.isArray(q.imageUrls) ? (q.imageUrls as any[]).map(String) : null);
    const answerImageArr =
      parseFlexibleArray((q as any).answer_image_urls_json) ??
      parseFlexibleArray((q as any).answer_image_urls) ??
      (Array.isArray((q as any).answerImageUrls)
        ? ((q as any).answerImageUrls as any[]).map(String)
        : null);

    const answer = q.answer != null ? cleanText(String(q.answer), 800) : null;

    if (!subjectId || !type || !question) {
      errors.push({ index: i, message: "subjectId, type, and question are required." });
      continue;
    }
    if (type !== "mcq" && type !== "short_answer" && type !== "long_answer") {
      errors.push({ index: i, message: `Invalid type: ${type}` });
      continue;
    }
    if (type === "mcq") {
      if (!optionsArr || optionsArr.length < 2) {
        errors.push({ index: i, message: "MCQ requires options_json (2+). JSON array, `A | B | C`, or one-per-line." });
        continue;
      }
      if (!answer) {
        // allow blank answers, but most users want it
      }
    }
    if (type === "short_answer") {
      if (!acceptedArr || acceptedArr.length === 0) {
        // allow, but it will behave like long
      }
    }

    if (dryRun) {
      imported++;
      continue;
    }

    await db.execute(sql`
      INSERT INTO custom_questions
      (subject_id, type, topic, question, image_urls, options, answer, accepted_answers, guidance, passage, marks, created_at)
      VALUES
      (${subjectId}, ${type}, ${topic}, ${question}, ${imageArr ? JSON.stringify(imageArr) : null}, ${optionsArr ? JSON.stringify(optionsArr) : null}, ${answer}, ${acceptedArr ? JSON.stringify(acceptedArr) : null}, ${guidance}, ${passage}, ${marks}, ${createdAt})
    `);
    imported++;
  }

  return c.json({ ok: errors.length === 0, imported, errors });
});

admin.post("/questions/reassign-subject", adminMiddleware, async (c) => {
  const db = c.get("db");
  const body = (await c.req.json().catch(() => null)) as
    | { fromSubjectId?: unknown; toSubjectId?: unknown }
    | null;

  const fromSubjectId = canonicalSubjectId(cleanText(body?.fromSubjectId, 80));
  const toSubjectId = canonicalSubjectId(cleanText(body?.toSubjectId, 80));

  if (!fromSubjectId || !toSubjectId) {
    return c.json({ error: "fromSubjectId and toSubjectId are required." }, 400);
  }
  if (fromSubjectId === toSubjectId) {
    return c.json({ error: "fromSubjectId and toSubjectId must be different." }, 400);
  }

  const result = await db
    .update(customQuestions)
    .set({ subjectId: toSubjectId })
    .where(eq(customQuestions.subjectId, fromSubjectId))
    .returning({ id: customQuestions.id });

  return c.json({ ok: true, moved: result.length });
});

admin.post("/pdf/preview", adminMiddleware, async (c) => {
  const form = await c.req.formData();
  const subjectId = cleanText(String(form.get("subjectId") ?? ""), 80);
  const topic = normalizeTopicLabel(form.get("topic"));
  const maxPages = Math.max(1, Math.min(200, Number(form.get("maxPages") ?? 50) || 50));

  const f = form.get("file") as File | null;
  if (!f || typeof (f as any).arrayBuffer !== "function") {
    return c.json({ error: "Missing PDF file (field name: file)." }, 400);
  }
  if (!subjectId) {
    return c.json({ error: "subjectId is required." }, 400);
  }
  if (!String(f.type || "").includes("pdf") && !String(f.name || "").toLowerCase().endsWith(".pdf")) {
    return c.json({ error: "File must be a PDF." }, 400);
  }

  const bytes = await f.arrayBuffer();
  // Keep payload sizes sane on Workers.
  if (bytes.byteLength > 50 * 1024 * 1024) {
    return c.json({ error: "PDF too large (max ~50MB). Split the exam or upload fewer pages." }, 413);
  }

  let extracted: { questions: any[]; pageCount: number };
  let usedFallback = false;
  let fallbackMode: "numbered" | "heading" | "loose" | null = null;
  try {
    extracted = await extractQuestionsFromPdf({
      pdfBytes: bytes,
      maxPages,
      maxImagesPerPage: 4,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[pdf/preview]", msg);
    const fb = extractQuestionsFromPdfFallback({
      pdfBytes: bytes,
      maxQuestions: maxPages * 2,
    });
    extracted = { questions: fb.questions, pageCount: fb.pageCount };
    usedFallback = true;
    fallbackMode = fb.mode;
  }
  const { questions, pageCount } = extracted;

  const preview = questions.map((q, i) => ({
    // client-side id for edits
    localId: `${Date.now()}_${i}`,
    subjectId,
    type: q.type,
    topic,
    question: q.question,
    passage: q.passage,
    options: q.options,
    answer: q.answer,
    acceptedAnswers: q.acceptedAnswers,
    guidance: q.guidance,
    marks: q.marks ?? (q.type === "mcq" ? 1 : 2),
    imageUrls: q.imageUrls,
    sourcePage: q.sourcePage,
  }));

  return c.json({
    ok: true,
    subjectId,
    topic,
    pageCount,
    extractedCount: preview.length,
    questions: preview,
    note:
      usedFallback
        ? fallbackMode === "loose"
          ? "Fallback extraction mode (low confidence). Review carefully before publishing."
          : "Fallback extraction mode used. Review and edit question text/options before publishing."
        : "This is an auto-extracted preview. Review formatting, question types, options, and images before publishing.",
  });
});

admin.post("/pdf/generate", adminMiddleware, async (c) => {
  const db = c.get("db");
  const form = await c.req.formData();
  const subjectId = cleanText(String(form.get("subjectId") ?? ""), 80);
  const topic = normalizeTopicLabel(form.get("topic"));
  const maxPages = Math.max(1, Math.min(200, Number(form.get("maxPages") ?? 50) || 50));

  const f = form.get("file") as File | null;
  if (!f || typeof (f as any).arrayBuffer !== "function") {
    return c.json({ error: "Missing PDF file (field name: file)." }, 400);
  }
  if (!subjectId) {
    return c.json({ error: "subjectId is required." }, 400);
  }
  if (!String(f.type || "").includes("pdf") && !String(f.name || "").toLowerCase().endsWith(".pdf")) {
    return c.json({ error: "File must be a PDF." }, 400);
  }

  const bytes = await f.arrayBuffer();
  if (bytes.byteLength > 50 * 1024 * 1024) {
    return c.json({ error: "PDF too large (max ~50MB). Split the exam or upload fewer pages." }, 413);
  }

  let extracted: { questions: any[]; pageCount: number };
  let usedFallback = false;
  let fallbackMode: "numbered" | "heading" | "loose" | null = null;
  try {
    extracted = await extractQuestionsFromPdf({
      pdfBytes: bytes,
      maxPages,
      maxImagesPerPage: 4,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[pdf/generate]", msg);
    const fb = extractQuestionsFromPdfFallback({
      pdfBytes: bytes,
      maxQuestions: maxPages * 2,
    });
    extracted = { questions: fb.questions, pageCount: fb.pageCount };
    usedFallback = true;
    fallbackMode = fb.mode;
  }

  if (usedFallback && fallbackMode === "loose") {
    return c.json(
      {
        error:
          "Low-confidence fallback extraction detected (no clear question numbering/headings). Use PDF Preview and edit manually, or export a cleaner digital PDF.",
        usedFallback,
        fallbackMode,
      },
      422,
    );
  }

  const createdAt = nowIso();
  let imported = 0;
  for (const raw of extracted.questions) {
    if (!raw || typeof raw !== "object") continue;
    const q = raw as Record<string, unknown>;

    const type = cleanText(String(q.type ?? ""), 20);
    const question = cleanText(String(q.question ?? ""), 4000);
    const passage = q.passage ? cleanText(String(q.passage), 6000) : null;
    const guidance = q.guidance ? cleanText(String(q.guidance), 1000) : null;
    const marks = Math.max(1, Math.round(Number(q.marks) || (type === "mcq" ? 1 : 2)));

    const optionsArr = Array.isArray(q.options) ? (q.options as unknown[]).map(String) : [];
    const options = optionsArr.length ? JSON.stringify(optionsArr) : null;
    const answer = q.answer ? cleanText(String(q.answer), 800) : null;
    const acceptedArr = Array.isArray(q.acceptedAnswers)
      ? (q.acceptedAnswers as unknown[]).map(String).filter(Boolean)
      : [];
    const acceptedAnswers = acceptedArr.length ? JSON.stringify(acceptedArr) : null;
    const imageArr = Array.isArray(q.imageUrls)
      ? (q.imageUrls as unknown[]).map(String).filter(Boolean)
      : [];
    const imageUrls = imageArr.length ? JSON.stringify(imageArr) : null;

    if (!type || !question) continue;

    await db.execute(sql`
      INSERT INTO custom_questions
      (subject_id, type, topic, question, image_urls, options, answer, accepted_answers, guidance, passage, marks, created_at)
      VALUES
      (${canonicalSubjectId(subjectId)}, ${type}, ${topic}, ${question}, ${imageUrls}, ${options}, ${answer}, ${acceptedAnswers}, ${guidance}, ${passage}, ${marks}, ${createdAt})
    `);
    imported++;
  }

  return c.json({
    ...(imported === 0
      ? {
          error:
            "Could not detect structured questions from this PDF. Try PDF Preview first, reduce max pages, or use a cleaner digital export.",
        }
      : {}),
    ok: true,
    imported,
    extractedCount: extracted.questions.length,
    pageCount: extracted.pageCount,
    usedFallback,
    fallbackMode,
  }, imported === 0 ? 422 : 200);
});

admin.post("/pdf/publish", adminMiddleware, async (c) => {
  const db = c.get("db");
  const body = (await c.req.json().catch(() => null)) as
    | {
        subjectId?: unknown;
        questions?: unknown;
      }
    | null;

  const subjectId = cleanText(String(body?.subjectId ?? ""), 80);
  const list = body?.questions;
  if (!subjectId) return c.json({ error: "subjectId is required." }, 400);
  if (!Array.isArray(list) || list.length === 0) {
    return c.json({ error: "questions must be a non-empty array." }, 400);
  }

  let imported = 0;
  const createdAt = nowIso();

  for (const raw of list) {
    if (!raw || typeof raw !== "object") continue;
    const q = raw as Record<string, unknown>;

    const type = cleanText(String(q.type ?? ""), 20);
    const question = cleanText(String(q.question ?? ""), 4000);
    const topic = normalizeTopicLabel(q.topic);
    const passage = q.passage ? cleanText(String(q.passage), 6000) : null;
    const guidance = q.guidance ? cleanText(String(q.guidance), 1000) : null;
    const marks = Math.max(1, Math.round(Number(q.marks) || (type === "mcq" ? 1 : 2)));

    const optionsArr = Array.isArray(q.options) ? (q.options as unknown[]).map(String) : [];
    const options = optionsArr.length ? JSON.stringify(optionsArr) : null;
    const answer = q.answer ? cleanText(String(q.answer), 800) : null;

    const acceptedArr = Array.isArray(q.acceptedAnswers)
      ? (q.acceptedAnswers as unknown[]).map(String).filter(Boolean)
      : [];
    const acceptedAnswers = acceptedArr.length ? JSON.stringify(acceptedArr) : null;

    const imageArr = Array.isArray(q.imageUrls)
      ? (q.imageUrls as unknown[]).map(String).filter(Boolean)
      : [];
    const imageUrls = imageArr.length ? JSON.stringify(imageArr) : null;

    if (!type || !question) continue;

    await db.execute(sql`
      INSERT INTO custom_questions
      (subject_id, type, topic, question, image_urls, options, answer, accepted_answers, guidance, passage, marks, created_at)
      VALUES
      (${canonicalSubjectId(subjectId)}, ${type}, ${topic}, ${question}, ${imageUrls}, ${options}, ${answer}, ${acceptedAnswers}, ${guidance}, ${passage}, ${marks}, ${createdAt})
    `);
    imported++;
  }

  return c.json({ ok: true, imported });
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
        const topic = normalizeTopicLabel(p.topic);
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
            await db.execute(sql`
              INSERT INTO custom_questions
              (subject_id, type, topic, question, image_urls, options, answer, accepted_answers, guidance, passage, marks, created_at)
              VALUES
              (${subjectIdSheet}, ${p.type}, ${topic}, ${p.question}, ${imageUrlsJson}, ${optionsJson}, ${answer}, ${acceptedRaw}, ${guidance}, ${passage}, ${marks}, ${createdAt})
            `);
            imported++;
          }
        } else {
          await db.execute(sql`
            INSERT INTO custom_questions
            (subject_id, type, topic, question, image_urls, options, answer, accepted_answers, guidance, passage, marks, created_at)
            VALUES
            (${subjectIdSheet}, ${p.type}, ${topic}, ${p.question}, ${imageUrlsJson}, ${optionsJson}, ${answer}, ${acceptedRaw}, ${guidance}, ${passage}, ${marks}, ${createdAt})
          `);
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
