export type SectionBCuratedVariant = {
  framework: string;
  instructions: string[];
  title: string;
  promptLine: string;
  stimulus: string;
};

/** One practice page per title + stimulus (6 prompts total). */
export const SECTION_B_CURATED_VARIANTS: SectionBCuratedVariant[] = [
  {
    framework: "Writing about country",
    title: "Origins",
    promptLine:
      "Using at least one stimulus, write a crafted text exploring ideas about country and belonging.",
    instructions: [
      "Write a text that explores ideas about country.",
      "Use the provided title.",
      "Use at least one stimulus.",
    ],
    stimulus: "My body might go, but my heart can never leave.",
  },
  {
    framework: "Writing about country",
    title: "Origins",
    promptLine:
      "Using at least one stimulus, write a crafted text exploring ideas about country and belonging.",
    instructions: [
      "Write a text that explores ideas about country.",
      "Use the provided title.",
      "Use at least one stimulus.",
    ],
    stimulus:
      "... there is no separation between people, animals, plants, land, sea and sky. It is all Country. It is all family. And everyone is part of the story.",
  },
  {
    framework: "Writing about protest",
    title: "Small Acts, Big Wins",
    promptLine:
      "Using at least one stimulus, write a crafted text exploring ideas about protest and collective action.",
    instructions: [
      "Write a text that explores ideas about protest.",
      "Use the provided title.",
      "Use at least one stimulus.",
    ],
    stimulus:
      '"I want to change the world," said Tiny Dragon. "Start with the next person who needs your help," replied Big Panda.',
  },
  {
    framework: "Writing about protest",
    title: "Small Acts, Big Wins",
    promptLine:
      "Using at least one stimulus, write a crafted text exploring ideas about protest and collective action.",
    instructions: [
      "Write a text that explores ideas about protest.",
      "Use the provided title.",
      "Use at least one stimulus.",
    ],
    stimulus:
      "And now my voice is louder than ever. Louder because people have joined me and together we make a chorus, standing up for what we believe.",
  },
  {
    framework: "Writing about personal journeys",
    title: "Changing Direction",
    promptLine:
      "Using at least one stimulus, write a crafted text exploring ideas about personal journeys and transformation.",
    instructions: [
      "Write a text that explores ideas about personal journeys.",
      "Use the provided title.",
      "Use at least one stimulus.",
    ],
    stimulus: "You were looking for the key for years, but the door was always open!",
  },
  {
    framework: "Writing about personal journeys",
    title: "Changing Direction",
    promptLine:
      "Using at least one stimulus, write a crafted text exploring ideas about personal journeys and transformation.",
    instructions: [
      "Write a text that explores ideas about personal journeys.",
      "Use the provided title.",
      "Use at least one stimulus.",
    ],
    stimulus:
      "In the midst of my journey through life I found myself in a dark forest, where the clear way forward was lost.",
  },
];

/** @deprecated Use SECTION_B_CURATED_VARIANTS — kept for any legacy imports. */
export const SECTION_B_FRAMEWORKS: Record<string, SectionBCuratedVariant> = Object.fromEntries(
  SECTION_B_CURATED_VARIANTS.map((v) => [`${v.title}::${normalizeStimulusKey(v.stimulus)}`, v]),
);

/** Plain title-only imports to hide and delete from the bank. */
export const SECTION_B_BLOCKED_TITLES = new Set(
  [
    "Last Light on Platform 9",
    "Borrowed Silence",
    "Small Fires",
    "After the Rain",
  ].map(normalizeSectionBTitle),
);

const CURATED_TITLES = new Set(
  ["Origins", "Small Acts, Big Wins", "Changing Direction"].map(normalizeSectionBTitle),
);

export function normalizeSectionBTitle(title: string) {
  return String(title ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function normalizeStimulusKey(text: string) {
  return String(text ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export function buildSectionBPromptText(variant: SectionBCuratedVariant) {
  return [
    `Title: ${variant.title}.`,
    variant.promptLine,
    "",
    ...variant.instructions,
    "",
    "Stimulus",
    variant.stimulus,
  ].join("\n");
}

export function cleanSectionAPromptText(promptText: string) {
  return cleanSectionBPromptText(promptText)
    .replace(/^\s*\(?[ivxlcdm]+\)?[.)\-:\s]+/i, "")
    .trim();
}

export function cleanSectionBPromptText(promptText: string) {
  return String(promptText ?? "")
    .replace(/â€™|’/g, "'")
    .replace(/â€œ|â€|“|”/g, '"')
    .replace(/â€“|–/g, "-")
    .replace(/â€”|—/g, "-")
    .replace(/(\w)\?(\w)/g, "$1'$2")
    .replace(/\?([^?\n]*[.!][^?\n]*)\?/g, '"$1"')
    .replace(/\.\s*begin(?:ning)?\s+with\s*:\s*\.?\s*$/i, "")
    .replace(/\bbegin(?:ning)?\s+with\s*:\s*\.?\s*$/i, "")
    .trim();
}

export function formatSectionBPromptDisplay(promptText: string) {
  const cleaned = cleanSectionBPromptText(promptText)
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const m = cleaned.match(/^\s*title\s*:\s*([^.\n]+)\.?\s*(?:\n+)?([\s\S]*)$/i);
  if (!m) return cleaned;
  const title = String(m[1] ?? "").trim().replace(/[.,"']+$/g, "");
  const rest = String(m[2] ?? "").trim();
  if (!title && !rest) return cleaned;
  if (!rest) return `Title: ${title}`;
  return `Title: ${title}\n${rest}`;
}

export function isMalformedSectionBPrompt(promptText: string) {
  const t = String(promptText ?? "").trim();
  if (!t) return true;
  if (/\bbegin(?:ning)?\s+with\s*:\s*\.?\s*$/i.test(t)) return true;
  if (/^\s*title\s*:\s*creative writing\b/i.test(t)) return true;
  if (/^\s*creative writing\s*\.?\s*$/i.test(t)) return true;
  if (/^\s*title\s*:\s*creative writing\s*\.?\s*$/i.test(t)) return true;
  if (/^\s*title\s*:\s*[^.\n]{0,2}\s*$/i.test(t)) return true;
  return false;
}

export function extractSectionBTitle(promptText: string) {
  const cleaned = cleanSectionBPromptText(promptText);
  const explicit =
    cleaned.match(/Title:\s*['"]?([^'"\n]+?)['"]?(?:\s*(?:\.|\n|$))/i)?.[1] ??
    cleaned.match(/Title:\s*['"]?(.+?)['"]?\s+(?:Stimulus\b|Framework\b|Using\b)/i)?.[1];
  const titled = cleaned.match(/titled\s+([A-Za-z][A-Za-z ,'-]{1,80})/i)?.[1];
  return (explicit ?? titled ?? "").trim().replace(/[.,"']+$/g, "");
}

export function extractSectionBStimulus(promptText: string) {
  const cleaned = cleanSectionBPromptText(promptText);
  const block =
    cleaned.match(/(?:^|\n)\s*stimulus\s*:?\s*\n+([\s\S]+?)\s*$/i)?.[1] ??
    cleaned.match(/(?:^|\n)\s*stimulus\s*:?\s+([\s\S]+?)\s*$/i)?.[1];
  return String(block ?? "").trim();
}

export function matchSectionBCuratedVariant(promptText: string): SectionBCuratedVariant | null {
  const title = normalizeSectionBTitle(extractSectionBTitle(promptText));
  if (!title || !CURATED_TITLES.has(title)) return null;

  const stimulus = normalizeStimulusKey(extractSectionBStimulus(promptText));
  if (stimulus) {
    const hit = SECTION_B_CURATED_VARIANTS.find(
      (v) =>
        normalizeSectionBTitle(v.title) === title &&
        normalizeStimulusKey(v.stimulus) === stimulus,
    );
    if (hit) return hit;
  }

  // Legacy combined import (no stimulus block): hide — replaced by per-stimulus rows.
  return null;
}

export function sectionBFramework(promptText: string): SectionBCuratedVariant | null {
  return matchSectionBCuratedVariant(promptText);
}

export function sectionBTitle(promptText: string) {
  const variant = matchSectionBCuratedVariant(promptText);
  if (variant) return variant.title;
  const title = extractSectionBTitle(promptText);
  return title || "Creative writing";
}

export function sectionBPromptInstruction(promptText: string) {
  const variant = matchSectionBCuratedVariant(promptText);
  if (variant) return variant.promptLine;
  return "";
}

/** Plain imports: only "title: …" with no framework, stimuli, or VCAA-style instructions. */
export function isPlainSectionBPrompt(promptText: string) {
  const cleaned = cleanSectionBPromptText(promptText);
  if (!cleaned) return true;

  const title = normalizeSectionBTitle(extractSectionBTitle(cleaned));
  if (SECTION_B_BLOCKED_TITLES.has(title)) return true;
  if (matchSectionBCuratedVariant(cleaned)) return false;

  const lower = cleaned.toLowerCase();
  if (/\bstimulus\b/i.test(cleaned)) return false;
  if (/\bframework\b/i.test(cleaned)) return false;
  if (/using at least one/i.test(lower)) return false;
  if (/\binstructions?\b/i.test(lower)) return false;
  if (cleaned.length > 280) return false;

  const lines = cleaned.split("\n").map((l) => l.trim()).filter(Boolean);
  if (lines.length >= 4) return false;

  const titleOnly = /^\s*title\s*:\s*.+\.?\s*$/i.test(cleaned);
  const titlePlusShort = /^\s*title\s*:\s*[^.\n]+\.?\s*(?:\n\s*.{0,200})?\s*$/is.test(cleaned);
  return titleOnly || titlePlusShort || cleaned.length < 120;
}

/** Whether this Section B prompt should appear in practice (curated per-stimulus pages only). */
export function shouldShowSectionBPrompt(promptText: string) {
  if (isMalformedSectionBPrompt(promptText)) return false;
  if (isPlainSectionBPrompt(promptText)) return false;
  return matchSectionBCuratedVariant(promptText) !== null;
}
