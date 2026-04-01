"use strict";

/**
 * Optional Google Sheets mirror for custom questions.
 *
 * Env:
 *   GOOGLE_SHEETS_SPREADSHEET_ID  — spreadsheet ID (required)
 *   GOOGLE_SHEETS_TAB_NAME        — see below
 *   GOOGLE_SERVICE_ACCOUNT_JSON   — full service account JSON string (private_key newlines as \n)
 *   GOOGLE_SERVICE_ACCOUNT_FILE   — path to service account .json (relative to server.js or absolute)
 *
 * GOOGLE_SHEETS_TAB_NAME:
 *   • One tab (legacy): "NodentQuestions" — column B (subject_id) must list the subject per row.
 *   • Several tabs: "english,methods,biology" — each tab’s name must match the app subject id
 *     (slug); column B is ignored for routing (you can leave it blank or duplicate for notes).
 *   • Single subject tab: set tab to e.g. "english" and set GOOGLE_SHEETS_SUBJECT_FROM_TAB=1
 *     so column B is not required.
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

function getTabNames() {
  const raw = (process.env.GOOGLE_SHEETS_TAB_NAME || DEFAULT_TAB).trim();
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** When true, each row’s subject comes from the sheet tab name, not column B. */
function subjectIdFromTabMode() {
  const tabs = getTabNames();
  if (tabs.length > 1) return true;
  if (tabs.length === 1 && tabs[0] !== DEFAULT_TAB) return true;
  if (process.env.GOOGLE_SHEETS_SUBJECT_FROM_TAB === "1") return true;
  return false;
}

function getConfig() {
  const tabs = getTabNames();
  return {
    spreadsheetId: (process.env.GOOGLE_SHEETS_SPREADSHEET_ID || "").trim(),
    tabNames: tabs,
    /** Tab used when append cannot match a subject tab. */
    defaultTabForAppend: tabs[0] || DEFAULT_TAB,
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

function escapeTabName(tabName) {
  const t = String(tabName).trim();
  if (!t) return "Sheet1";
  if (/[^A-Za-z0-9_]/.test(t) || /\s/.test(t)) {
    return `'${t.replace(/'/g, "''")}'`;
  }
  return t;
}

function tabA1Range(tabName, a1) {
  return `${escapeTabName(tabName)}!${a1}`;
}

async function ensureHeaderRow(sheets, spreadsheetId, tabName) {
  const r = tabA1Range(tabName, "A1:N1");
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

function pickTabForAppend(payload) {
  const { tabNames, defaultTabForAppend } = getConfig();
  const sid = String(payload.subjectId || "")
    .trim()
    .toLowerCase();
  const match = tabNames.find((t) => t.trim().toLowerCase() === sid);
  if (match) return match;
  return defaultTabForAppend || DEFAULT_TAB;
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
    const tabName = pickTabForAppend(payload);
    await ensureHeaderRow(sheets, spreadsheetId, tabName);
    const range = tabA1Range(tabName, "A:N");
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
 * Read data rows from all configured tabs.
 * Returns { rows: [{ tabName, row }], tabErrors: [{ tabName, message }] }.
 */
async function readDataRows() {
  if (!isConfigured()) {
    return { rows: [], tabErrors: [] };
  }
  const { spreadsheetId, tabNames } = getConfig();
  const sheets = await getClient();
  const out = [];
  const tabErrors = [];

  for (const tabName of tabNames) {
    try {
      await ensureHeaderRow(sheets, spreadsheetId, tabName);
      const range = tabA1Range(tabName, "A2:N5000");
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      const values = res.data.values || [];
      for (const row of values) {
        out.push({ tabName, row });
      }
    } catch (err) {
      const message = String(err.message || err);
      tabErrors.push({ tabName, message });
      console.warn(
        `[Sheets] Could not read tab "${tabName}" (create the tab in the spreadsheet or fix GOOGLE_SHEETS_TAB_NAME):`,
        message,
      );
    }
  }
  return { rows: out, tabErrors };
}

/** Tab titles as they appear in Google Sheets (bottom bar). */
async function listSpreadsheetSheetTitles() {
  const { spreadsheetId } = getConfig();
  if (!spreadsheetId) return [];
  const sheets = await getClient();
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  return (res.data.sheets || [])
    .map((s) => s.properties?.title)
    .filter(Boolean);
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
  subjectIdFromTabMode,
  getTabNames,
  listSpreadsheetSheetTitles,
  HEADERS,
};
