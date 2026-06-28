/**
 * Import questions from a nodent-pdf-import-*.json backup (Create → Download backup).
 * Usage: node scripts/import-pdf-draft-json.mjs path/to/backup.json
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

const file = process.argv[2];
if (!file) {
  console.error("Usage: node scripts/import-pdf-draft-json.mjs <backup.json>");
  process.exit(1);
}

const draft = JSON.parse(readFileSync(resolve(file), "utf8"));
const subjectId = String(draft.subjectId ?? "demo").trim();
const rows = Array.isArray(draft.rows) ? draft.rows : [];
if (!rows.length) {
  console.error("No rows in backup.");
  process.exit(1);
}

const raw = readFileSync(resolve(".dev.vars"), "utf8");
const sql = neon(raw.match(/^DATABASE_URL=(.+)$/m)[1].trim());

function buildQuestion(row) {
  const parts = (row.parts ?? []).filter((p) => p?.descriptor?.trim());
  if (parts.length) {
    return parts.map((p) => p.descriptor.trim()).join("\n\n");
  }
  return String(row.question ?? "").trim();
}

let imported = 0;
let skipped = 0;
for (const row of rows) {
  const question = buildQuestion(row);
  if (!question) continue;
  const type = row.type === "mcq" ? "mcq" : row.type === "long_answer" ? "long_answer" : "short_answer";
  const imageUrls = row.imageDataUrls?.length
    ? JSON.stringify(row.imageDataUrls.slice(0, 6))
    : row.imageDataUrl
      ? JSON.stringify([row.imageDataUrl])
      : null;
  const answerParts = row.parts?.length
    ? JSON.stringify(
        row.parts.map((p, i) => ({
          key: p.label || `part${i + 1}`,
          label: p.descriptor || "Answer",
          placeholder: p.placeholder || "Type your answer…",
          marks: p.marks || 1,
          ...(p.imageDataUrl ? { imageUrl: p.imageDataUrl } : {}),
        })),
      )
    : null;
  const accepted = (row.parts ?? [])
    .map((p) => String(p.acceptedAnswer ?? "").trim())
    .filter(Boolean);
  try {
    await sql`
      INSERT INTO custom_questions (
        subject_id, type, topic, question, image_urls, answer_parts_json,
        accepted_answers, marks, created_at
      ) VALUES (
        ${subjectId},
        ${type},
        ${String(row.topic ?? "General")},
        ${question},
        ${imageUrls},
        ${answerParts},
        ${accepted.length ? JSON.stringify(accepted) : null},
        ${Math.max(1, Number(row.marks) || 1)},
        ${new Date().toISOString()}
      )
    `;
    imported++;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/duplicate|unique/i.test(msg)) {
      skipped++;
    } else {
      console.error("Failed:", question.slice(0, 60), "—", msg);
    }
  }
}

console.log(`Done: imported ${imported}, skipped ${skipped} (duplicates), subject=${subjectId}`);
