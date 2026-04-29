const path = require("path");
const sqlite3 = require("sqlite3");

const SECTION_A_BOOKS = [
  { title: "Bad Dreams and Other Stories", author: "Tessa Hadley", prompts: ["How does Bad Dreams and Other Stories depict the consequences of crossing boundaries?", "Relationships act as catalysts for self-discovery in Bad Dreams and Other Stories. Discuss."] },
  { title: "Born a Crime", author: "Trevor Noah", prompts: ["In Born a Crime, women exert the most influence on Noah's life. To what extent do you agree?", "\"They're free, they've been taught how to fish, but no one will give them a fishing rod.\" How does Born a Crime demonstrate the difficulties of escaping inequality?"] },
  { title: "Chronicle of a Death Foretold", author: "Gabriel Garcia Marquez", prompts: ["\"Three people ... confirmed that the episode had taken place, but four others weren't sure.\" How is the idea of truth explored in Chronicle of a Death Foretold?", "Despite their lack of power, it is women who display the most courage in Chronicle of a Death Foretold. Do you agree?"] },
  { title: "False Claims of Colonial Thieves", author: "Charmaine Papertalk Green and John Kinsella", prompts: ["\"How can I but take up the call, Charmaine, and yarn right back at you - it's what we do when we connect ...\" How does False Claims of Colonial Thieves highlight the necessity of solidarity?", "\"Why are we still invisible?\" False Claims of Colonial Thieves is a cry for justice. To what extent do you agree?"] },
  { title: "Flames", author: "Robbie Arnott", prompts: ["Love and destruction are inseparable in Flames. Discuss.", "In Flames, Arnott condemns the isolation caused by modern society. Do you agree?"] },
  { title: "Ghost Wall", author: "Sarah Moss", prompts: ["Ghost Wall warns of the danger of glorifying the past. To what extent do you agree?", "In Ghost Wall, the natural world is a place of both freedom and control. Discuss."] },
  { title: "Go, Went, Gone", author: "Jenny Erpenbeck", prompts: ["\"... none stands above the other, rather each complements the other ...\" Go, Went, Gone demonstrates that there are more similarities than differences in human experiences. Do you agree?", "In Go, Went, Gone, language has the power to both connect and exclude. Discuss."] },
  { title: "High Ground", author: "Stephen Johnson (director)", prompts: ["High Ground celebrates the resilience of Indigenous cultures despite colonisation. Discuss.", "To what extent is revenge a form of justice in High Ground?"] },
  { title: "Jane Eyre", author: "Charlotte Bronte", prompts: ["How does Bronte highlight the danger of acting on emotion rather than reason in Jane Eyre?", "\"I am no bird; and no net ensnares me ...\" Jane Eyre is primarily a novel about the pursuit of personal freedom. Do you agree?"] },
  { title: "My Brilliant Career", author: "Miles Franklin", prompts: ["\"Hopeless, homeless, aimless, shameless souls ...\" The world of My Brilliant Career is harshly unforgiving. To what extent do you agree?", "In My Brilliant Career, choice is a privilege. Discuss."] },
  { title: "New and Selected Poems, Volume One", author: "Mary Oliver", prompts: ["Oliver's poems suggest that it is easy to overlook what is important. Discuss.", "\"Look, I want to love this world as though it's the last chance I'm ever going to get to be alive and know it.\" Oliver's poems are a celebration of life. Do you agree?"] },
  { title: "Oedipus the King", author: "Sophocles", prompts: ["In Oedipus the King, Sophocles suggests that seeking the truth is dangerous. Discuss.", "In Oedipus the King, there are no right choices. Do you agree?"] },
  { title: "Rainbow's End", author: "Jane Harrison", prompts: ["\"Knowledge is power, ladies.\" Harrison demonstrates this is true for the women in Rainbow's End. Do you agree?", "Rainbow's End shows that lasting change requires more than individual effort. Discuss."] },
  { title: "Requiem for a Beast", author: "Matt Ottley", prompts: ["\"For there is another darkness coming.\" Requiem for a Beast suggests it is possible to escape the cycle of history repeating itself. Do you agree?", "How does Ottley challenge traditional notions of masculinity in Requiem for a Beast?"] },
  { title: "Sunset Boulevard", author: "Billy Wilder (director)", prompts: ["To what extent is Sunset Boulevard about the loss of control?", "In Sunset Boulevard, Wilder suggests that individuals can be both victims and villains. Discuss."] },
  { title: "The Complete Stories", author: "David Malouf", prompts: ["In The Complete Stories, Malouf suggests that everyday life can be significant. Discuss.", "The Complete Stories demonstrates that it is harder to understand yourself than it is to understand others. Do you agree?"] },
  { title: "The Erratics", author: "Vicki Laveau-Harvie", prompts: ["The Erratics suggests that betrayal is the most destructive force of all. Do you agree?", "\"Blood calls to blood.\" In The Erratics, Laveau-Harvie highlights the tension between family obligation and self-preservation. Discuss."] },
  { title: "The Memory Police", author: "Yoko Ogawa", prompts: ["How does The Memory Police suggest that memories are essential to give life meaning?", "In The Memory Police, silence is both a tool of oppression and a tool of resistance. Discuss."] },
  { title: "Twelfth Night", author: "William Shakespeare", prompts: ["To what extent does Shakespeare mock social expectations in Twelfth Night?", "Twelfth Night suggests that truth leads to happiness. Do you agree?"] },
  { title: "We Have Always Lived in the Castle", author: "Shirley Jackson", prompts: ["\"I shall be forced to invent, to fictionalize, to imagine.\" In the world of We Have Always Lived in the Castle, truth is of little importance. Do you agree?", "Change is unwelcome in We Have Always Lived in the Castle. Discuss."] },
];

const SECTION_B_PROMPTS = [
  { title: "Origins", framework: "Writing about country", instructions: ["Write a text that explores ideas about country.", "You must use the title provided.", "You must use at least one of the following stimuli."], stimuli: ["\"My body might go, but my heart can never leave.\"", "\"... there is no separation between people, animals, plants, land, sea and sky. It is all Country. It is all family. And everyone is part of the story.\""] },
  { title: "Small Acts, Big Wins", framework: "Writing about protest", instructions: ["Write a text that explores ideas about protest.", "You must use the title provided.", "You must use at least one of the following stimuli."], stimuli: ["\"I want to change the world,\" said Tiny Dragon. \"Start with the next person who needs your help,\" replied Big Panda.", "\"And now my voice is louder than ever. Louder because people have joined me and together we make a chorus, standing up for what we believe.\""] },
  { title: "Changing Direction", framework: "Writing about personal journeys", instructions: ["Write a text that explores ideas about personal journeys.", "You must use the title provided.", "You must use at least one of the following stimuli."], stimuli: ["\"You were looking for the key for years but the door was always open!\"", "\"In the midst of my journey through life I found myself in a dark forest, where the clear way forward was lost.\""] },
];

const SECTION_C_PROMPTS = [
  { title: "Life is a Game", framework: "Writing about play", instructions: ["Write a text that explores ideas about play.", "You must use the title provided.", "You must use at least one of the following stimuli."], stimuli: ["\"We are only truly ourselves when we play.\"", "\"You follow every rule, respect every whistle blown, but the ones who cheat seem to always succeed.\""] },
];

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
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

async function ensureBookId(db, title) {
  const existing = await get(
    db,
    "SELECT id FROM english_books WHERE LOWER(TRIM(title)) = LOWER(TRIM(?)) LIMIT 1",
    [title],
  );
  if (existing?.id) return Number(existing.id);
  const now = new Date().toISOString();
  const inserted = await run(
    db,
    "INSERT INTO english_books (title, created_at) VALUES (?, ?)",
    [title, now],
  );
  return Number(inserted.lastID);
}

async function insertPromptIfMissing(db, bookId, section, promptText) {
  const prompt = String(promptText || "").trim();
  if (!prompt) return 0;
  const exists = await get(
    db,
    "SELECT id FROM english_prompts WHERE book_id = ? AND UPPER(TRIM(section)) = UPPER(TRIM(?)) AND prompt_text = ? LIMIT 1",
    [bookId, section, prompt],
  );
  if (exists?.id) return 0;
  const now = new Date().toISOString();
  await run(
    db,
    "INSERT INTO english_prompts (book_id, prompt_text, section, created_at) VALUES (?, ?, ?, ?)",
    [bookId, prompt, section, now],
  );
  return 1;
}

async function main() {
  const dbPath = path.resolve(__dirname, "..", "..", "nodent.db");
  const db = new sqlite3.Database(dbPath);
  let added = 0;
  try {
    for (const entry of SECTION_A_BOOKS) {
      const bookId = await ensureBookId(db, `${entry.title} by ${entry.author}`);
      for (let i = 0; i < entry.prompts.length; i += 1) {
        const label = i === 0 ? "i." : "ii.";
        added += await insertPromptIfMissing(db, bookId, "A", `${label} ${entry.prompts[i]}`);
      }
    }

    const sectionBBookId = await ensureBookId(db, "Section B Framework Prompts");
    for (const framework of SECTION_B_PROMPTS) {
      const promptText = [
        `Framework: ${framework.framework}`,
        ...framework.instructions.map((line) => `- ${line}`),
        `Title: ${framework.title}`,
        ...framework.stimuli.map((line, idx) => `Stimulus ${idx + 1}: ${line}`),
      ].join("\n");
      added += await insertPromptIfMissing(db, sectionBBookId, "B", promptText);
    }

    const sectionCBookId = await ensureBookId(db, "Section C Framework Prompts");
    for (const framework of SECTION_C_PROMPTS) {
      const promptText = [
        `Framework: ${framework.framework}`,
        ...framework.instructions.map((line) => `- ${line}`),
        `Title: ${framework.title}`,
        ...framework.stimuli.map((line, idx) => `Stimulus ${idx + 1}: ${line}`),
      ].join("\n");
      added += await insertPromptIfMissing(db, sectionCBookId, "C", promptText);
    }

    const sectionCounts = await new Promise((resolve, reject) => {
      db.all(
        "SELECT section, COUNT(*) AS c FROM english_prompts GROUP BY section ORDER BY section",
        (err, rows) => (err ? reject(err) : resolve(rows || [])),
      );
    });
    console.log(`Local English seed complete. promptsAdded=${added}`);
    console.log("Section counts:", sectionCounts);
  } finally {
    db.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

