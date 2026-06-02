/**
 * Seed English Section A text-response prompts (books + discuss prompts).
 * Usage: ADMIN_KEY=localdev node scripts/seed-english-prompts.mjs [baseUrl]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";

const base = (process.argv[2] || "http://127.0.0.1:8787").replace(/\/$/, "");
const adminKey = process.env.ADMIN_KEY || process.env.NODENT_ADMIN_KEY;

/** @type {Array<{ book: string; prompts: string[] }>} */
const BOOKS = [
  {
    book: "Born a Crime — Trevor Noah",
    prompts: [
      "Born a Crime shows that identity is shaped by both personal choice and social forces. Discuss.",
      "“Trevor survives not because the world is fair, but because he learns how to adapt.” Discuss.",
      "How does Noah use humour to expose the cruelty of apartheid?",
      "Born a Crime is ultimately a tribute to Patricia Noah. To what extent do you agree?",
      "“Language gives Trevor access to worlds that would otherwise reject him.” Discuss.",
      "How does the memoir explore the relationship between fear and resilience?",
      "“In Born a Crime, family is both a source of protection and pain.” Discuss.",
      "To what extent does Noah present childhood as a time of innocence?",
    ],
  },
  {
    book: "Bad Dreams and Other Stories — Tessa Hadley",
    prompts: [
      "Hadley’s stories reveal the quiet tensions beneath ordinary life. Discuss.",
      "“In Bad Dreams and Other Stories, characters are often unsettled by what they cannot fully understand.” Discuss.",
      "How does Hadley explore memory and regret?",
      "The stories suggest that small moments can permanently alter a person’s sense of self. Discuss.",
      "“Hadley’s characters are trapped more by emotion than by circumstance.” Discuss.",
      "How does Hadley use domestic spaces to reveal hidden conflict?",
      "To what extent are the characters in these stories lonely?",
      "“The past is never truly finished in Hadley’s stories.” Discuss.",
    ],
  },
  {
    book: "Chronicle of a Death Foretold — Gabriel García Márquez",
    prompts: [
      "“Everyone knows what will happen, yet no one prevents it.” Discuss.",
      "How does the novella criticise honour and social expectation?",
      "Chronicle of a Death Foretold presents truth as unstable and unreliable. Discuss.",
      "To what extent is Santiago Nasar responsible for his own death?",
      "“The town is more guilty than the murderers.” Discuss.",
      "How does Márquez use structure to create inevitability?",
      "The novella shows the danger of collective silence. Discuss.",
      "“In this society, reputation matters more than justice.” Discuss.",
    ],
  },
  {
    book: "False Claims of Colonial Thieves — Charmaine Papertalk Green and John Kinsella",
    prompts: [
      "The text challenges the ways colonial history has been recorded and remembered. Discuss.",
      "“Language becomes an act of resistance in False Claims of Colonial Thieves.” Discuss.",
      "How do the poets expose the violence hidden beneath colonial narratives?",
      "The collection presents land as a site of memory, identity and conflict. Discuss.",
      "“The text refuses to allow the past to remain buried.” Discuss.",
      "How is anger used productively in the collection?",
      "The poems show that colonisation is not only historical, but ongoing. Discuss.",
      "“Truth-telling is central to justice.” Discuss with reference to the text.",
    ],
  },
  {
    book: "Flames — Robbie Arnott",
    prompts: [
      "Flames presents grief as strange, powerful and transformative. Discuss.",
      "“Arnott’s world is magical, but its emotions are deeply human.” Discuss.",
      "How does the novel explore family inheritance and trauma?",
      "The natural world in Flames is both beautiful and threatening. Discuss.",
      "“The characters in Flames are shaped by forces they cannot control.” Discuss.",
      "To what extent is the novel about learning to let go?",
      "How does Arnott use multiple perspectives to deepen the story?",
      "“Love in Flames is intense, flawed and often destructive.” Discuss.",
    ],
  },
  {
    book: "Ghost Wall — Sarah Moss",
    prompts: [
      "Ghost Wall shows how violence can be disguised as tradition. Discuss.",
      "“Silvie’s greatest struggle is learning to see that escape is possible.” Discuss.",
      "How does Moss explore power within the family?",
      "The novel suggests that the past can be used to control the present. Discuss.",
      "“In Ghost Wall, fear keeps people silent.” Discuss.",
      "How does Moss use setting to create tension?",
      "To what extent is Bill a product of the beliefs he worships?",
      "“The novel condemns those who romanticise brutality.” Discuss.",
    ],
  },
  {
    book: "Go, Went, Gone — Jenny Erpenbeck",
    prompts: [
      "Go, Went, Gone suggests that empathy requires action, not just sympathy. Discuss.",
      "How does the novel explore the invisibility of refugees in European society?",
      "“Richard’s understanding of himself changes through his encounters with others.” Discuss.",
      "The novel shows that borders are political, emotional and moral. Discuss.",
      "“Erpenbeck challenges the reader to confront their own comfort.” Discuss.",
      "How does the text connect memory, history and displacement?",
      "To what extent is Richard transformed by the refugees he meets?",
      "“The novel asks who is allowed to belong.” Discuss.",
    ],
  },
  {
    book: "High Ground — Stephen Johnson",
    prompts: [
      "High Ground explores the violence of colonisation and its lasting consequences. Discuss.",
      "“Gutjuk is caught between two worlds, but accepted fully by neither.” Discuss.",
      "How does the film represent guilt and responsibility?",
      "The landscape in High Ground is more than a setting. Discuss.",
      "“The film challenges heroic versions of Australian history.” Discuss.",
      "To what extent is Travis seeking redemption?",
      "How does the film depict the relationship between power and violence?",
      "“Survival in High Ground requires both courage and compromise.” Discuss.",
    ],
  },
  {
    book: "Jane Eyre — Charlotte Brontë",
    prompts: [
      "“Jane’s greatest strength is her refusal to abandon her sense of self.” Discuss.",
      "How does Brontë explore the tension between love and independence?",
      "Jane Eyre presents morality as more important than passion. Discuss.",
      "To what extent is Rochester changed by suffering?",
      "“Jane’s search for belonging is also a search for equality.” Discuss.",
      "How does Brontë use setting to reflect Jane’s inner life?",
      "“Jane Eyre challenges the gender expectations of its time.” Discuss.",
      "Is Jane’s ending a victory? Discuss.",
    ],
  },
  {
    book: "My Brilliant Career — Miles Franklin",
    prompts: [
      "“Sybylla values freedom more than comfort.” Discuss.",
      "How does the novel explore gender and ambition?",
      "My Brilliant Career presents marriage as both tempting and limiting. Discuss.",
      "To what extent is Sybylla responsible for her own unhappiness?",
      "“The Australian landscape shapes Sybylla’s identity.” Discuss.",
      "How does Franklin challenge traditional ideas of femininity?",
      "“Sybylla’s refusal to conform is both admirable and painful.” Discuss.",
      "The novel is about the cost of independence. Discuss.",
    ],
  },
  {
    book: "New and Selected Poems, Volume One — Mary Oliver",
    prompts: [
      "Oliver’s poetry invites readers to pay closer attention to the natural world. Discuss.",
      "“In Oliver’s poems, nature becomes a guide to how we should live.” Discuss.",
      "How does Oliver explore mortality and wonder?",
      "The poems suggest that beauty is found through stillness and attention. Discuss.",
      "“Oliver’s poetry is simple in language but profound in meaning.” Discuss.",
      "How does Oliver present the relationship between humans and the non-human world?",
      "“The poems encourage gratitude without ignoring suffering.” Discuss.",
      "To what extent is Oliver’s poetry spiritual?",
    ],
  },
  {
    book: "Oedipus the King — Sophocles",
    prompts: [
      "“Oedipus is destroyed by his desire for truth.” Discuss.",
      "To what extent is Oedipus responsible for his downfall?",
      "Oedipus the King shows that human beings cannot escape fate. Discuss.",
      "How does Sophocles explore blindness and insight?",
      "“Oedipus’s strengths become his weaknesses.” Discuss.",
      "The play presents leadership as a burden. Discuss.",
      "How does dramatic irony shape the audience’s response to Oedipus?",
      "“The tragedy lies not in Oedipus’s guilt, but in his discovery.” Discuss.",
    ],
  },
  {
    book: "Rainbow’s End — Jane Harrison",
    prompts: [
      "Rainbow’s End celebrates resilience in the face of injustice. Discuss.",
      "How does Harrison explore the importance of family?",
      "“The play shows that hope can exist even in unfair circumstances.” Discuss.",
      "How does the text expose racism in everyday Australian life?",
      "“Education offers possibility, but not equality.” Discuss.",
      "To what extent is Dolly caught between loyalty and aspiration?",
      "The play uses humour to reveal painful truths. Discuss.",
      "“Home is central to identity in Rainbow’s End.” Discuss.",
    ],
  },
  {
    book: "Requiem for a Beast — Matt Ottley",
    prompts: [
      "Requiem for a Beast explores the burden of inherited guilt. Discuss.",
      "How does the text combine image, music and words to confront Australia’s past?",
      "“The beast represents both personal fear and national shame.” Discuss.",
      "To what extent is the boy’s journey a process of moral awakening?",
      "The text suggests that silence allows trauma to continue. Discuss.",
      "How does Ottley represent the relationship between memory and responsibility?",
      "“The past intrudes violently into the present.” Discuss.",
      "Requiem for a Beast is a text about learning to face truth. Discuss.",
    ],
  },
  {
    book: "Sunset Boulevard — Billy Wilder",
    prompts: [
      "Sunset Boulevard exposes the destructive nature of fame. Discuss.",
      "“Norma Desmond is both victim and villain.” Discuss.",
      "How does Wilder criticise Hollywood’s obsession with youth and image?",
      "“Joe Gillis sells his integrity long before he loses his life.” Discuss.",
      "To what extent is Norma trapped by her own illusions?",
      "The film presents ambition as morally dangerous. Discuss.",
      "How does Wilder use noir conventions to explore corruption?",
      "“In Sunset Boulevard, performance replaces reality.” Discuss.",
    ],
  },
  {
    book: "The Complete Stories — David Malouf",
    prompts: [
      "Malouf’s stories explore the hidden emotional lives of ordinary people. Discuss.",
      "“Memory shapes identity in Malouf’s short fiction.” Discuss.",
      "How does Malouf present childhood as both innocent and disturbing?",
      "The stories suggest that moments of revelation can be quiet but powerful. Discuss.",
      "“Malouf is interested in what remains unspoken.” Discuss.",
      "How do the stories explore connection and isolation?",
      "To what extent are Malouf’s characters shaped by place?",
      "“The past continues to live inside the present.” Discuss.",
    ],
  },
  {
    book: "The Erratics — Vicki Laveau-Harvie",
    prompts: [
      "The Erratics explores the damage caused by family dysfunction. Discuss.",
      "“The memoir is as much about survival as it is about trauma.” Discuss.",
      "How does Laveau-Harvie use dark humour to tell a painful story?",
      "To what extent does the text challenge idealised views of motherhood?",
      "“The narrator must return home in order to understand what she escaped.” Discuss.",
      "How does the memoir explore memory, resentment and obligation?",
      "“Family can be a place of harm rather than safety.” Discuss.",
      "The text shows that truth within families is often contested. Discuss.",
    ],
  },
  {
    book: "The Memory Police — Yoko Ogawa",
    prompts: [
      "The Memory Police explores the relationship between memory and identity. Discuss.",
      "“To forget is to lose part of oneself.” Discuss.",
      "How does Ogawa create fear through quietness and restraint?",
      "The novel suggests that authoritarian control depends on people accepting loss. Discuss.",
      "“Resistance in the novel is fragile but meaningful.” Discuss.",
      "To what extent is the narrator heroic?",
      "How does the novel explore the power of writing and storytelling?",
      "“The most frightening violence in the novel is psychological.” Discuss.",
    ],
  },
  {
    book: "Twelfth Night — William Shakespeare",
    prompts: [
      "Twelfth Night shows that love often makes people foolish. Discuss.",
      "How does Shakespeare explore mistaken identity and self-discovery?",
      "“Viola is the emotional centre of the play.” Discuss.",
      "To what extent is Malvolio treated cruelly?",
      "The play celebrates disorder, but only temporarily. Discuss.",
      "How does Shakespeare use disguise to challenge gender roles?",
      "“In Twelfth Night, desire is unstable and unpredictable.” Discuss.",
      "Is the ending truly happy? Discuss.",
    ],
  },
  {
    book: "We Have Always Lived in the Castle — Shirley Jackson",
    prompts: [
      "“Merricat’s world is shaped by fear, control and imagination.” Discuss.",
      "How does Jackson explore isolation and social cruelty?",
      "To what extent is Merricat a sympathetic narrator?",
      "The novel suggests that outsiders can be more dangerous than those they condemn. Discuss.",
      "“The Blackwood sisters create safety by rejecting the outside world.” Discuss.",
      "How does Jackson use gothic elements to explore family and trauma?",
      "“The novel blurs the line between innocence and guilt.” Discuss.",
      "To what extent is the ending a form of freedom?",
    ],
  },
];

const rows = BOOKS.flatMap(({ book, prompts }) =>
  prompts.map((prompt) => ({
    section: "A",
    book,
    prompt,
  })),
);

mkdirSync(resolve("imports"), { recursive: true });
const outPath = resolve("imports/admin-bulk-english-prompts.json");
writeFileSync(outPath, JSON.stringify({ rows }, null, 2), "utf8");
console.log(
  `Wrote ${rows.length} prompts across ${BOOKS.length} books → ${outPath}`,
);

if (!adminKey) {
  console.log("Set ADMIN_KEY to import into the database.");
  process.exit(0);
}

const res = await fetch(`${base}/api/admin/english/prompts/bulk`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Admin-Key": adminKey,
  },
  body: JSON.stringify({ rows }),
});

const json = await res.json().catch(() => ({}));
if (!res.ok) {
  console.error("Bulk import failed:", res.status, json);
  process.exit(1);
}

console.log(
  `Imported ${json.importedPrompts ?? 0} prompt(s), ${json.importedBooks ?? 0} new book(s).`,
);
if (json.errors?.length) {
  console.error("Errors (first 5):", json.errors.slice(0, 5));
  process.exit(1);
}

const listRes = await fetch(`${base}/api/admin/english/prompts`, {
  headers: { "X-Admin-Key": adminKey },
  signal: AbortSignal.timeout(30_000),
});
const list = await listRes.json();
if (listRes.ok && Array.isArray(list.prompts)) {
  const sectionA = list.prompts.filter((p) => p.section === "A").length;
  console.log(`  Admin total: ${list.prompts.length} prompts (${sectionA} in Section A)`);
}
