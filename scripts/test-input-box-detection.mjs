/**
 * Quick check for [[INPUT]] marker parsing (no PDF required).
 * Run: node scripts/test-input-box-detection.mjs
 */

const INPUT_TOKEN_RE =
  /\[\[INPUT(?:\:([a-z])(?:\:([\w]+))?|:([\w]+))?\]\]/gi;

function parseInputMarkerToken(text) {
  const m = text.match(
    /\[\[INPUT(?:\:([a-z])(?:\:([\w]+))?|:([\w]+))?\]\]/i,
  );
  if (!m) return null;
  const partLetter = m[1]?.trim().toLowerCase();
  const partSubKey = m[2]?.trim();
  const questionKey = m[3]?.trim();
  if (partLetter && /^[a-z]$/.test(partLetter)) {
    return { partKey: partLetter, boxKey: partSubKey || "1" };
  }
  if (questionKey) return { boxKey: questionKey };
  return { boxKey: "" };
}

const samples = [
  "[[INPUT:1]]",
  "[[INPUT:3]]",
  "[[INPUT:b:1]]",
  "[[INPUT]]",
  "Cell [[INPUT:2]] value",
];

let failed = 0;
for (const s of samples) {
  const re = new RegExp(INPUT_TOKEN_RE.source, "gi");
  const hits = [...s.matchAll(re)].map((m) => parseInputMarkerToken(m[0]));
  if (!hits.length) {
    console.error("FAIL: no hit for", s);
    failed++;
  } else {
    console.log("OK:", s, "→", hits);
  }
}

process.exit(failed ? 1 : 0);
