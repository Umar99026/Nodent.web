const path = require("path");
const sqlite3 = require("sqlite3");

const NEW_SECTION_B = [
  {
    title: "Last Light on Platform 9",
    framework: "Writing about change",
    instructions: [
      "Write a text that explores ideas about turning points.",
      "Use the title provided.",
      "Use at least one stimulus.",
    ],
    stimuli: [
      "\"You thought you had more time, until the doors began to close.\"",
      "\"Every ending is a decision dressed as circumstance.\"",
    ],
  },
  {
    title: "Borrowed Silence",
    framework: "Writing about identity",
    instructions: [
      "Write a text that explores ideas about voice and identity.",
      "Use the title provided.",
      "Use at least one stimulus.",
    ],
    stimuli: [
      "\"Sometimes the loudest story is the one never spoken.\"",
      "\"Who are you when no one is watching?\"",
    ],
  },
  {
    title: "Small Fires",
    framework: "Writing about protest",
    instructions: [
      "Write a text that explores ideas about resistance.",
      "Use the title provided.",
      "Use at least one stimulus.",
    ],
    stimuli: [
      "\"Big change begins with stubborn ordinary people.\"",
      "\"A whisper repeated enough times becomes a movement.\"",
    ],
  },
  {
    title: "After the Rain",
    framework: "Writing about hope",
    instructions: [
      "Write a text that explores ideas about recovery.",
      "Use the title provided.",
      "Use at least one stimulus.",
    ],
    stimuli: [
      "\"The storm did not end the story; it edited it.\"",
      "\"What grows back is never exactly what was lost.\"",
    ],
  },
  {
    title: "Unclaimed",
    framework: "Writing about belonging",
    instructions: [
      "Write a text that explores ideas about home and belonging.",
      "Use the title provided.",
      "Use at least one stimulus.",
    ],
    stimuli: [
      "\"A place can know your name before you know your own.\"",
      "\"Belonging is built, not found.\"",
    ],
  },
  {
    title: "The Distance Between",
    framework: "Writing about relationships",
    instructions: [
      "Write a text that explores ideas about connection and distance.",
      "Use the title provided.",
      "Use at least one stimulus.",
    ],
    stimuli: [
      "\"Two people can stand side by side and still be oceans apart.\"",
      "\"Misunderstanding is a language both sides think they are not speaking.\"",
    ],
  },
  {
    title: "Paper Boats",
    framework: "Writing about memory",
    instructions: [
      "Write a text that explores ideas about memory and loss.",
      "Use the title provided.",
      "Use at least one stimulus.",
    ],
    stimuli: [
      "\"Some memories float; others sink and wait.\"",
      "\"The past survives in fragments we keep pretending are complete.\"",
    ],
  },
  {
    title: "Midnight Inventory",
    framework: "Writing about identity",
    instructions: [
      "Write a text that explores ideas about identity and self-worth.",
      "Use the title provided.",
      "Use at least one stimulus.",
    ],
    stimuli: [
      "\"At midnight, everything you own starts to look like evidence.\"",
      "\"What we keep says as much as what we throw away.\"",
    ],
  },
  {
    title: "The Quiet Room",
    framework: "Writing about conflict",
    instructions: [
      "Write a text that explores ideas about conflict and reconciliation.",
      "Use the title provided.",
      "Use at least one stimulus.",
    ],
    stimuli: [
      "\"Silence can be a shield, a weapon, or an invitation.\"",
      "\"Sometimes peace arrives after the argument, not instead of it.\"",
    ],
  },
];

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function done(err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

async function ensureBook(db, title) {
  const existing = await get(
    db,
    "SELECT id FROM english_books WHERE LOWER(TRIM(title)) = LOWER(TRIM(?)) LIMIT 1",
    [title],
  );
  if (existing?.id) return Number(existing.id);
  const now = new Date().toISOString();
  const result = await run(
    db,
    "INSERT INTO english_books (title, created_at) VALUES (?, ?)",
    [title, now],
  );
  return Number(result.lastID);
}

async function main() {
  const dbPath = path.resolve(__dirname, "..", "..", "nodent.db");
  const db = new sqlite3.Database(dbPath);
  const now = new Date().toISOString();
  try {
    await run(
      db,
      `DELETE FROM english_prompts
       WHERE SUBSTR(UPPER(TRIM(COALESCE(section, ''))), 1, 1) = 'B'
         AND (
           LOWER(TRIM(prompt_text)) LIKE 'title: creative writing%'
           OR LOWER(TRIM(prompt_text)) LIKE 'title: creative writing.%'
           OR LOWER(TRIM(prompt_text)) LIKE '%title: creative writing%'
           OR LOWER(prompt_text) LIKE '%beginning with:%'
           OR LENGTH(TRIM(prompt_text)) < 48
         )`,
    );

    const bookId = await ensureBook(db, "Section B Curated Prompts");
    let inserted = 0;
    for (const p of NEW_SECTION_B) {
      const promptText = [
        `Framework: ${p.framework}`,
        ...p.instructions.map((x) => `- ${x}`),
        `Title: ${p.title}`,
        ...p.stimuli.map((x, i) => `Stimulus ${i + 1}: ${x}`),
      ].join("\n");
      const exists = await get(
        db,
        "SELECT id FROM english_prompts WHERE book_id = ? AND UPPER(TRIM(section)) = 'B' AND prompt_text = ? LIMIT 1",
        [bookId, promptText],
      );
      if (!exists?.id) {
        await run(
          db,
          "INSERT INTO english_prompts (book_id, prompt_text, section, created_at) VALUES (?, ?, 'B', ?)",
          [bookId, promptText, now],
        );
        inserted += 1;
      }
    }
    console.log(`Section B refreshed. added=${inserted}`);
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

