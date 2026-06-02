/**
 * Merge duplicate English books (by/—/directed by variants) and dedupe prompts.
 *
 * Usage:
 *   node scripts/merge-english-books.mjs
 *   (reads DATABASE_URL from .dev.vars or env)
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { neon } from "@neondatabase/serverless";

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  const raw = readFileSync(resolve(".dev.vars"), "utf8");
  const m = raw.match(/^DATABASE_URL=(.+)$/m);
  if (!m) throw new Error("DATABASE_URL not found in .dev.vars");
  return m[1].trim();
}

/** Canonical Section A titles (em dash + author). */
const CANONICAL_TITLES = [
  "Born a Crime — Trevor Noah",
  "Bad Dreams and Other Stories — Tessa Hadley",
  "Chronicle of a Death Foretold — Gabriel García Márquez",
  "False Claims of Colonial Thieves — Charmaine Papertalk Green and John Kinsella",
  "Flames — Robbie Arnott",
  "Ghost Wall — Sarah Moss",
  "Go, Went, Gone — Jenny Erpenbeck",
  "High Ground — Stephen Johnson",
  "Jane Eyre — Charlotte Brontë",
  "My Brilliant Career — Miles Franklin",
  "New and Selected Poems, Volume One — Mary Oliver",
  "Oedipus the King — Sophocles",
  "Rainbow's End — Jane Harrison",
  "Requiem for a Beast — Matt Ottley",
  "Sunset Boulevard — Billy Wilder",
  "The Complete Stories — David Malouf",
  "The Erratics — Vicki Laveau-Harvie",
  "The Memory Police — Yoko Ogawa",
  "Twelfth Night — William Shakespeare",
  "We Have Always Lived in the Castle — Shirley Jackson",
];

const CANONICAL_BY_KEY = new Map(
  CANONICAL_TITLES.map((t) => [normalizeBookKey(t), t]),
);

const SECTION_B_C = new Set([
  "section b curated prompts",
  "section b framework prompts",
  "section c argument analysis",
  "section c framework prompts",
]);

function normalizeBookKey(title) {
  return String(title ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\(director\)/gi, "")
    .replace(/\bdirected by\b/gi, " ")
    .replace(/\s+by\s+/gi, " ")
    .replace(/[—–-]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function normalizePromptText(text) {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .trim()
    .toLowerCase();
}

const sql = neon(loadDatabaseUrl());

const books = await sql`SELECT id, title FROM english_books ORDER BY id`;
const prompts = await sql`
  SELECT p.id, p.book_id, p.prompt_text, p.section, b.title AS book_title
  FROM english_prompts p
  JOIN english_books b ON b.id = p.book_id
  ORDER BY p.id
`;

console.log(`Books: ${books.length}, prompts: ${prompts.length}`);

/** bookId -> canonical title (only Section A curated texts) */
const bookIdToCanonical = new Map();
const groups = new Map(); // canonicalTitle -> { bookIds: Set, promptIds: number[] }

for (const book of books) {
  const title = String(book.title);
  if (SECTION_B_C.has(normalizeBookKey(title))) continue;

  const key = normalizeBookKey(title);
  const canonical = CANONICAL_BY_KEY.get(key);
  if (!canonical) {
    console.warn(`  (skip unmapped book) ${title}`);
    continue;
  }

  bookIdToCanonical.set(Number(book.id), canonical);
  if (!groups.has(canonical)) {
    groups.set(canonical, { bookIds: new Set(), promptIds: [] });
  }
  groups.get(canonical).bookIds.add(Number(book.id));
}

for (const p of prompts) {
  const canonical = bookIdToCanonical.get(Number(p.book_id));
  if (!canonical) continue;
  groups.get(canonical).promptIds.push({
    id: Number(p.id),
    book_id: Number(p.book_id),
    section: String(p.section || "A"),
    prompt_text: String(p.prompt_text),
  });
}

let booksRenamed = 0;
let promptsMoved = 0;
let promptsDeduped = 0;
let booksRemoved = 0;

for (const [canonicalTitle, group] of groups) {
  const bookIds = [...group.bookIds];
  if (!bookIds.length) continue;

  // Pick keeper book: prefer id whose title already equals canonical, else lowest id
  let keeperId = bookIds.find(
    (id) =>
      String(books.find((b) => Number(b.id) === id)?.title) === canonicalTitle,
  );
  if (!keeperId) keeperId = Math.min(...bookIds);

  const keeper = books.find((b) => Number(b.id) === keeperId);
  if (keeper && keeper.title !== canonicalTitle) {
    await sql`UPDATE english_books SET title = ${canonicalTitle} WHERE id = ${keeperId}`;
    keeper.title = canonicalTitle;
    booksRenamed++;
  }

  // Move all prompts to keeper book
  for (const bid of bookIds) {
    if (bid === keeperId) continue;
    const moved = await sql`
      UPDATE english_prompts SET book_id = ${keeperId} WHERE book_id = ${bid}
      RETURNING id
    `;
    promptsMoved += moved.length;
  }

  // Dedupe prompts on keeper (same section + same text; keep lowest id)
  const rows = await sql`
    SELECT id, section, prompt_text
    FROM english_prompts
    WHERE book_id = ${keeperId}
    ORDER BY id
  `;
  const seen2 = new Map();
  const deleteIds = [];
  for (const row of rows) {
    const k = `${row.section}\0${normalizePromptText(row.prompt_text)}`;
    if (!seen2.has(k)) {
      seen2.set(k, Number(row.id));
      continue;
    }
    deleteIds.push(Number(row.id));
  }

  if (deleteIds.length) {
    await sql`DELETE FROM english_prompts WHERE id = ANY(${deleteIds})`;
    promptsDeduped += deleteIds.length;
  }
}

// Remove orphan duplicate books
const removed = await sql`
  DELETE FROM english_books b
  WHERE NOT EXISTS (SELECT 1 FROM english_prompts p WHERE p.book_id = b.id)
  RETURNING id, title
`;
booksRemoved = removed.length;

const booksAfter = await sql`SELECT COUNT(*)::int AS n FROM english_books`;
const promptsAfter = await sql`SELECT COUNT(*)::int AS n FROM english_prompts`;

console.log("\nDone:");
console.log(`  Books renamed to canonical title: ${booksRenamed}`);
console.log(`  Prompt rows moved to keeper book: ${promptsMoved}`);
console.log(`  Duplicate prompts removed: ${promptsDeduped}`);
console.log(`  Empty duplicate books removed: ${booksRemoved}`);
console.log(`  Totals now: ${booksAfter[0].n} books, ${promptsAfter[0].n} prompts`);

const dupCheck = await sql`
  SELECT b.title, COUNT(*)::int AS n
  FROM english_books b
  WHERE EXISTS (
    SELECT 1 FROM english_prompts p
    WHERE p.book_id = b.id
      AND LEFT(UPPER(TRIM(p.section)), 1) = 'A'
  )
  GROUP BY b.title
  HAVING COUNT(*) > 0
  ORDER BY b.title
`;
console.log(`\nSection A books with prompts: ${dupCheck.length}`);
