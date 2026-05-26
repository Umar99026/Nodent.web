/**
 * Add questions to the global bank via Admin API (same path as Admin UI).
 *
 * Usage:
 *   ADMIN_KEY=your-key node scripts/admin-add-questions.mjs questions.json
 *   ADMIN_KEY=your-key node scripts/admin-add-questions.mjs questions.json https://nodent.pages.dev
 *
 * questions.json shape:
 * {
 *   "questions": [
 *     {
 *       "subjectId": "methods",
 *       "type": "mcq",
 *       "topic": "Differential calculus",
 *       "question": "Find f'(x) for f(x)=x^2",
 *       "options": ["2x", "x", "x^2", "2"],
 *       "correctAnswer": "A",
 *       "marks": 1
 *     }
 *   ]
 * }
 */
import { readFileSync } from "node:fs";

const file = process.argv[2];
const base = (process.argv[3] || process.env.NODENT_API_URL || "http://127.0.0.1:8787").replace(
  /\/$/,
  "",
);
const adminKey = process.env.ADMIN_KEY || process.env.NODENT_ADMIN_KEY;

if (!file) {
  console.error("Usage: ADMIN_KEY=... node scripts/admin-add-questions.mjs <questions.json> [baseUrl]");
  process.exit(1);
}
if (!adminKey) {
  console.error("Set ADMIN_KEY (or NODENT_ADMIN_KEY) in the environment.");
  process.exit(1);
}

const payload = JSON.parse(readFileSync(file, "utf8"));
const questions = Array.isArray(payload) ? payload : payload.questions;
if (!Array.isArray(questions) || !questions.length) {
  console.error("JSON must be an array or { questions: [...] } with at least one row.");
  process.exit(1);
}

const res = await fetch(`${base}/api/admin/questions/bulk`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Admin-Key": adminKey,
  },
  body: JSON.stringify({ questions }),
});

const text = await res.text();
let json;
try {
  json = JSON.parse(text);
} catch {
  json = { _raw: text };
}

if (!res.ok) {
  console.error("Bulk import failed:", res.status, json);
  process.exit(1);
}

console.log(`Imported ${json.imported ?? 0} question(s).`);
if (json.errors?.length) {
  console.warn("Errors:", json.errors.slice(0, 10));
  process.exit(1);
}
