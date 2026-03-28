"use strict";

/**
 * Optional Google Sheets mirror for custom questions.
 *
 * Env:
 *   GOOGLE_SHEETS_SPREADSHEET_ID  — spreadsheet ID (required)
 *   GOOGLE_SHEETS_TAB_NAME        — tab name, default NodentQuestions
 *   GOOGLE_SERVICE_ACCOUNT_JSON   — full service account JSON string (private_key newlines as \n)
 *   GOOGLE_SERVICE_ACCOUNT_FILE   — path to service account .json (relative to server.js or absolute)
 *
 * Share the spreadsheet with the service account email (Editor).
 */

const fs = require("fs");
const path = require("path");
const { google } = require("googleapis");

const DEFAULT_TAB = "NodentQuestions";

const HEADERS = [
  "database_id",
  "subject_id",
  "type",
  "topic",
  "question",
  "options_json",
  "answer",
  "accepted_answers_json",
  "marks",
  "guidance",
  "passage",
  "image_urls_json",
  "synced_at",
  "action",
];

function getConfig() {
  return {
    spreadsheetId: (process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "").trim(),
    tabName: (process.env.GOOGLE_SHEETS_TAB_NAME || DEFAULT_TAB).trim() || DEFAULT_TAB,
  };
}

function loadCredentials() {
  const jsonRaw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  const filePath = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
  if (jsonRaw) {
    try {
      const c = JSON.parse(jsonRaw);
      if (c.private_key && typeof c.private_key === "string") {
        c.private_key = c.private_key.replace(/\\n/g, "\n");
      }
      return c;
    } catch (e) {
      console.warn("[Sheets] GOOGLE_SERVICE_ACCOUNT_JSON parse error:", e.message);
    }
  }
  if (filePath) {
    try {
      const p = path.isAbsolute(filePath)
        ? filePath
        : path.join(__dirname, filePath);
      const c = JSON.parse(fs.readFileSync(p, "utf8"));
      if (c.private_key && typeof c.private_key === "string") {
        c.private_key = c.private_key.replace(/\\n/g, "\n");
      }
      return c;
    } catch (e) {
      console.warn("[Sheets] Could not read GOOGLE_SERVICE_ACCOUNT_FILE:", e.message);
    }
  }
  return null;
}

function isConfigured() {
  const { spreadsheetId } = getConfig();
  return Boolean(spreadsheetId && loadCredentials());
}

async function getClient() {
  const creds = loadCredentials();
  if (!creds) throw new Error("Google Sheets credentials missing.");
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth: await auth.getClient() });
}

function tabRange(cell) {
  const { tabName } = getConfig();
  const safe = tabName.includes(" ") ? `'${tabName.replace(/'/g, "''")}'` : tabName;
  return `${safe}!${cell}`;
}

async function ensureHeaderRow(sheets) {
  const { spreadsheetId } = getConfig();
  const r = tabRange("A1:N1");
  const got = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: r,
  });
  const first = got.data.values?.[0]?.[0];
  if (!first) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: r,
      valueInputOption: "RAW",
      requestBody: { values: [HEADERS] },
    });
  }
}

function cell(s) {
  if (s == null) return "";
  const t = String(s);
  return t.length > 45000 ? t.slice(0, 45000) : t;
}

function buildRow(payload) {
  const syncedAt = payload.syncedAt || new Date().toISOString();
  return [
    cell(payload.databaseId),
    cell(payload.subjectId),
    cell(payload.type),
    cell(payload.topic),
    cell(payload.question),
    cell(payload.optionsJson),
    cell(payload.answer),
    cell(payload.acceptedAnswersJson),
    cell(payload.marks),
    cell(payload.guidance),
    cell(payload.passage),
    cell(payload.imageUrlsJson),
    cell(syncedAt),
    cell(payload.action || "CREATE"),
  ];
}

/**
 * Append one row (create / delete / update audit).
 */
async function appendQuestionEvent(payload) {
  if (!isConfigured()) {
    return { skipped: true };
  }
  try {
    const { spreadsheetId } = getConfig();
    const sheets = await getClient();
    await ensureHeaderRow(sheets);
    const range = tabRange("A:N");
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [buildRow(payload)] },
    });
    return { ok: true };
  } catch (err) {
    console.error("[Sheets] appendQuestionEvent:", err.message || err);
    return { ok: false, error: String(err.message || err) };
  }
}

/**
 * Read data rows (skip header). Each row should align with HEADERS.
 */
async function readDataRows() {
  if (!isConfigured()) {
    return [];
  }
  const { spreadsheetId } = getConfig();
  const sheets = await getClient();
  const range = tabRange("A2:N5000");
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range,
  });
  return res.data.values || [];
}

function parseRow(row) {
  const pad = [...row];
  while (pad.length < HEADERS.length) pad.push("");
  const o = {};
  HEADERS.forEach((h, i) => {
    o[h] = pad[i] != null ? String(pad[i]).trim() : "";
  });
  return o;
}

module.exports = {
  isSheetsConfigured: isConfigured,
  appendQuestionEvent,
  readDataRows,
  parseRow,
  HEADERS,
};
