/**
 * Google Sheets API for Cloudflare Workers / Pages Functions.
 * Uses REST + service-account JWT (RS256) — no googleapis npm package.
 *
 * Env (Pages): mark GOOGLE_SERVICE_ACCOUNT_JSON as Secret; others can be vars or secrets.
 *   GOOGLE_SHEETS_SPREADSHEET_ID
 *   GOOGLE_SHEETS_TAB_NAME        e.g. "english,methods,general-maths"
 *   GOOGLE_SERVICE_ACCOUNT_JSON   full JSON; private_key may use \n escapes
 *   GOOGLE_SHEETS_SUBJECT_FROM_TAB optional "1" for single-tab subject-from-tab mode
 */

export type SheetsEnv = {
  GOOGLE_SHEETS_SPREADSHEET_ID?: string;
  GOOGLE_SHEETS_TAB_NAME?: string;
  GOOGLE_SERVICE_ACCOUNT_JSON?: string;
  GOOGLE_SHEETS_SUBJECT_FROM_TAB?: string;
};

const DEFAULT_TAB = "NodentQuestions";

export const SHEET_HEADERS = [
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
] as const;

function trimEnv(s: string | undefined): string {
  return String(s ?? "").trim();
}

export function sheetsGetTabNames(env: SheetsEnv): string[] {
  const raw = trimEnv(env.GOOGLE_SHEETS_TAB_NAME) || DEFAULT_TAB;
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** When true, each row's subject comes from the sheet tab name, not column B. */
export function sheetsSubjectIdFromTabMode(env: SheetsEnv): boolean {
  const tabs = sheetsGetTabNames(env);
  if (tabs.length > 1) return true;
  if (tabs.length === 1 && tabs[0] !== DEFAULT_TAB) return true;
  if (trimEnv(env.GOOGLE_SHEETS_SUBJECT_FROM_TAB) === "1") return true;
  return false;
}

function getSpreadsheetId(env: SheetsEnv): string {
  return trimEnv(env.GOOGLE_SHEETS_SPREADSHEET_ID);
}

function loadServiceAccount(env: SheetsEnv): {
  client_email: string;
  private_key: string;
} | null {
  const jsonRaw = env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!jsonRaw || !jsonRaw.trim()) return null;
  try {
    const c = JSON.parse(jsonRaw) as {
      client_email?: string;
      private_key?: string;
    };
    if (!c.client_email || !c.private_key) return null;
    let pk = String(c.private_key);
    if (pk.includes("\\n")) pk = pk.replace(/\\n/g, "\n");
    return { client_email: c.client_email, private_key: pk };
  } catch {
    return null;
  }
}

export function isSheetsConfigured(env: SheetsEnv): boolean {
  return Boolean(getSpreadsheetId(env) && loadServiceAccount(env));
}

function escapeTabName(tabName: string): string {
  const t = String(tabName).trim();
  if (!t) return "Sheet1";
  if (/[^A-Za-z0-9_]/.test(t) || /\s/.test(t)) {
    return `'${t.replace(/'/g, "''")}'`;
  }
  return t;
}

function tabA1Range(tabName: string, a1: string): string {
  return `${escapeTabName(tabName)}!${a1}`;
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeJson(obj: object): string {
  return base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(obj)));
}

function pemPkcs8ToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const raw = atob(b64);
  const buf = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) buf[i] = raw.charCodeAt(i);
  return buf.buffer;
}

async function importPkcs8PrivateKey(pem: string): Promise<CryptoKey> {
  const buf = pemPkcs8ToArrayBuffer(pem);
  return crypto.subtle.importKey(
    "pkcs8",
    buf,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

async function getAccessToken(env: SheetsEnv): Promise<string> {
  const sa = loadServiceAccount(env);
  if (!sa) throw new Error("Google Sheets credentials missing.");

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: sa.client_email,
    sub: sa.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encHeader = base64UrlEncodeJson(header);
  const encClaim = base64UrlEncodeJson(claim);
  const signingInput = `${encHeader}.${encClaim}`;

  const key = await importPkcs8PrivateKey(sa.private_key);
  const sigBuf = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(signingInput),
  );
  const jwt = `${signingInput}.${base64UrlEncodeBytes(new Uint8Array(sigBuf))}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(jwt)}`,
  });
  if (!tokenRes.ok) {
    const t = await tokenRes.text();
    throw new Error(`Google OAuth failed (${tokenRes.status}): ${t.slice(0, 500)}`);
  }
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) throw new Error("Google OAuth: no access_token");
  return tokenJson.access_token;
}

async function sheetsGetValues(
  accessToken: string,
  spreadsheetId: string,
  rangeA1: string,
): Promise<{ values?: string[][] }> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(rangeA1)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${res.status}: ${t.slice(0, 400)}`);
  }
  return res.json() as Promise<{ values?: string[][] }>;
}

async function sheetsPutValues(
  accessToken: string,
  spreadsheetId: string,
  rangeA1: string,
  values: string[][],
): Promise<void> {
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(rangeA1)}?valueInputOption=RAW`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values }),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${res.status}: ${t.slice(0, 400)}`);
  }
}

async function ensureHeaderRow(
  accessToken: string,
  spreadsheetId: string,
  tabName: string,
): Promise<void> {
  const r = tabA1Range(tabName, "A1:N1");
  const got = await sheetsGetValues(accessToken, spreadsheetId, r);
  const first = got.values?.[0]?.[0];
  if (!first) {
    await sheetsPutValues(accessToken, spreadsheetId, r, [
      [...SHEET_HEADERS],
    ]);
  }
}

export async function sheetsReadDataRows(env: SheetsEnv): Promise<{
  rows: { tabName: string; row: string[] }[];
  tabErrors: { tabName: string; message: string }[];
}> {
  if (!isSheetsConfigured(env)) {
    return { rows: [], tabErrors: [] };
  }
  const spreadsheetId = getSpreadsheetId(env);
  const tabNames = sheetsGetTabNames(env);
  const accessToken = await getAccessToken(env);
  const out: { tabName: string; row: string[] }[] = [];
  const tabErrors: { tabName: string; message: string }[] = [];

  for (const tabName of tabNames) {
    try {
      await ensureHeaderRow(accessToken, spreadsheetId, tabName);
      const range = tabA1Range(tabName, "A2:N5000");
      const res = await sheetsGetValues(accessToken, spreadsheetId, range);
      const values = res.values || [];
      for (const row of values) {
        out.push({ tabName, row: row.map((c) => (c == null ? "" : String(c))) });
      }
    } catch (err) {
      const message = String(err instanceof Error ? err.message : err);
      tabErrors.push({ tabName, message });
      console.warn(`[Sheets] tab "${tabName}":`, message);
    }
  }
  return { rows: out, tabErrors };
}

export async function sheetsListSpreadsheetTabTitles(
  env: SheetsEnv,
): Promise<string[]> {
  const spreadsheetId = getSpreadsheetId(env);
  if (!spreadsheetId) return [];
  const accessToken = await getAccessToken(env);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${res.status}: ${t.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    sheets?: { properties?: { title?: string } }[];
  };
  return (data.sheets || [])
    .map((s) => s.properties?.title)
    .filter((t): t is string => Boolean(t));
}

export function sheetsParseRow(row: string[]): Record<string, string> {
  const pad = [...row];
  while (pad.length < SHEET_HEADERS.length) pad.push("");
  const o: Record<string, string> = {};
  SHEET_HEADERS.forEach((h, i) => {
    o[h] = pad[i] != null ? String(pad[i]).trim() : "";
  });
  return o;
}
