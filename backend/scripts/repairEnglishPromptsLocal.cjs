const path = require("path");
const sqlite3 = require("sqlite3").verbose();

function openDb() {
  const dbPath = path.resolve(__dirname, "..", "..", "nodent.db");
  return new sqlite3.Database(dbPath);
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) return reject(err);
      resolve(this);
    });
  });
}

function normalizeSection(section) {
  const s = String(section ?? "")
    .toUpperCase()
    .replace(/^SECTION\s+/, "")
    .trim();
  return s[0] || "A";
}

function cleanPromptTextBase(text) {
  return String(text ?? "")
    .replace(/â€™|’/g, "'")
    .replace(/â€œ|â€|“|”/g, '"')
    .replace(/â€“|–/g, "-")
    .replace(/â€”|—/g, "-")
    .replace(/(\w)\?(\w)/g, "$1'$2")
    .replace(/\?([^?\n]*[.!][^?\n]*)\?/g, '"$1"')
    .replace(/\s+/g, " ")
    .replace(/\.\s*begin(?:ning)?\s+with\s*:\s*\.?\s*$/i, "")
    .replace(/\bbegin(?:ning)?\s+with\s*:\s*\.?\s*$/i, "")
    .trim();
}

function cleanSectionAPromptText(text) {
  return cleanPromptTextBase(text)
    .replace(/^\s*\(?[ivxlcdm]+\)?[.)\-:\s]+/i, "")
    .trim();
}

function isMalformedSectionBPrompt(text) {
  const t = String(text ?? "").trim();
  if (!t) return true;
  if (/\bbegin(?:ning)?\s+with\s*:\s*\.?\s*$/i.test(t)) return true;
  if (/^\s*title\s*:\s*creative writing\s*\.?\s*$/i.test(t)) return true;
  if (/^\s*creative writing\s*\.?\s*$/i.test(t)) return true;
  if (/^\s*title\s*:\s*[^.\n]{0,2}\s*$/i.test(t)) return true;
  if (t.length < 48) return true;
  return false;
}

function dedupeKey(section, bookId, text) {
  const normText = String(text ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .trim();
  return `${section}|${section === "A" ? Number(bookId) : 0}|${normText}`;
}

async function main() {
  const db = openDb();
  try {
    const rows = await all(
      db,
      `SELECT id, book_id, section, prompt_text
       FROM english_prompts
       ORDER BY id ASC`,
    );
    const existingResponses = await get(
      db,
      `SELECT COUNT(*) AS c FROM english_responses`,
    );
    console.log(`Loaded prompts=${rows.length}, responses=${Number(existingResponses?.c || 0)}`);

    await run(db, "BEGIN TRANSACTION");

    const seen = new Map();
    let updated = 0;
    let deduped = 0;
    let deletedMalformedB = 0;
    let remappedResponses = 0;

    for (const row of rows) {
      const id = Number(row.id);
      const section = normalizeSection(row.section);
      const bookId = Number(row.book_id || 0);
      const original = String(row.prompt_text || "");
      const cleaned =
        section === "A" ? cleanSectionAPromptText(original) : cleanPromptTextBase(original);

      if (section === "B" && isMalformedSectionBPrompt(cleaned)) {
        await run(
          db,
          `DELETE FROM english_prompts
           WHERE id = ?`,
          [id],
        );
        deletedMalformedB += 1;
        continue;
      }

      const key = dedupeKey(section, bookId, cleaned);
      const keepId = seen.get(key);
      if (keepId != null) {
        const move = await run(
          db,
          `UPDATE english_responses
           SET prompt_id = ?
           WHERE prompt_id = ?`,
          [keepId, id],
        );
        remappedResponses += Number(move?.changes || 0);

        await run(
          db,
          `DELETE FROM english_prompts
           WHERE id = ?`,
          [id],
        );
        deduped += 1;
        continue;
      }
      seen.set(key, id);

      if (cleaned && cleaned !== original) {
        await run(
          db,
          `UPDATE english_prompts
           SET prompt_text = ?
           WHERE id = ?`,
          [cleaned, id],
        );
        updated += 1;
      }
    }

    await run(db, "COMMIT");
    console.log(
      [
        `updated_text=${updated}`,
        `deduped=${deduped}`,
        `deleted_malformed_section_b=${deletedMalformedB}`,
        `responses_remapped=${remappedResponses}`,
      ].join(" "),
    );
  } catch (err) {
    try {
      await run(db, "ROLLBACK");
    } catch {}
    throw err;
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
