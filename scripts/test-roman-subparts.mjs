/** Smoke test: letter + roman sub-part detection (c) … i. … ii. …). */

function cleanAcceptedPartAnswer(raw) {
  return String(raw ?? "")
    .replace(/^\s*(?:i{1,3}|iv)\.\s*/i, "")
    .replace(/^\s*(?:\(?i+\)?|[a-z]|\d+)\)\s*/i, "")
    .trim();
}

function splitMultipartAcceptedAnswers(acceptedPool) {
  if (acceptedPool.length !== 1) {
    return acceptedPool.map(cleanAcceptedPartAnswer).filter(Boolean);
  }
  const raw = String(acceptedPool[0] ?? "").trim();
  if (!raw) return acceptedPool;
  const romanChunks = [...raw.matchAll(/(?:^|[;\n])\s*(i{1,3}|iv)\.\s*([^;\n]+)/gi)];
  if (romanChunks.length >= 2) {
    return romanChunks.map((m) => cleanAcceptedPartAnswer(m[2] ?? "")).filter(Boolean);
  }
  return acceptedPool.map(cleanAcceptedPartAnswer);
}

const ROMAN_SUBPART_MARKER_RE = /(?:^|\n|\s)(i{1,3}|iv)\.\s*/gi;

function detectRomanSubpartsInBody(parentLetter, body) {
  const cleaned = body.trim();
  const markers = [];
  const re = new RegExp(ROMAN_SUBPART_MARKER_RE.source, ROMAN_SUBPART_MARKER_RE.flags);
  let m;
  while ((m = re.exec(cleaned)) !== null) {
    markers.push({ roman: m[1].toLowerCase(), index: m.index, matchLen: m[0].length });
  }
  if (markers.length < 2) return null;
  const expected = ["i", "ii", "iii", "iv"].slice(0, markers.length);
  if (!markers.every((x, i) => x.roman === expected[i])) return null;

  const preamble = cleaned.slice(0, markers[0].index).trim();
  const parts = markers.map((mk, i) => {
    const bodyStart = mk.index + mk.matchLen;
    const bodyEnd = i + 1 < markers.length ? markers[i + 1].index : cleaned.length;
    return {
      label: mk.roman,
      parentLetter,
      body: cleaned.slice(bodyStart, bodyEnd).trim(),
    };
  });
  return { preamble, parts };
}

function detectSingleLetterWithRomans(text) {
  const cleaned = text.trim();
  const letterMatch = cleaned.match(/(?:^|\n)\s*(?:\(([a-z])\)|([a-z])\s*[.)])\s*/i);
  if (!letterMatch) return null;
  const label = (letterMatch[1] || letterMatch[2] || "").toLowerCase();
  const body = cleaned.slice(letterMatch.index + letterMatch[0].length).trim();
  const romanSplit = detectRomanSubpartsInBody(label, body);
  if (!romanSplit || romanSplit.parts.length < 2) return null;
  const scenarioBlock = romanSplit.preamble ? `${label}) ${romanSplit.preamble}` : "";
  return { stem: scenarioBlock, parts: romanSplit.parts };
}

const oyster = `c) When a least squares line is used to model the association between oyster weight and volume, the equation is $\\text{volume}=0.780+0.953\\times\\text{weight}$.
i. Name the response variable in this equation.
ii. Complete the following sentence by filling in the box provided: This equation predicts that, on average, each 10 g increase in the weight of an oyster is associated with a $\\square\\;cm^3$ increase in its volume.`;

function assert(cond, msg) {
  if (!cond) {
    console.error("FAIL:", msg);
    process.exitCode = 1;
  } else {
    console.log("OK:", msg);
  }
}

const o = detectSingleLetterWithRomans(oyster);
assert(o?.parts.length === 2, `oyster has 2 roman parts (got ${o?.parts.length})`);
assert(o?.parts[0].label === "i", `first part is i (got ${o?.parts[0]?.label})`);
assert(o?.parts[1].label === "ii", `second part is ii (got ${o?.parts[1]?.label})`);
assert(o?.parts[0].parentLetter === "c", "roman parts parent is c");
assert(/least squares/i.test(o?.stem ?? ""), "stem keeps c) scenario");
assert(/response variable/i.test(o?.parts[0].body ?? ""), "part i body preserved");

const answers = splitMultipartAcceptedAnswers(["i. volume; ii. $9.53$"]);
assert(answers.length === 2, `split combined answer (got ${answers.length})`);
assert(answers[0] === "volume", `part i answer is volume (got ${answers[0]})`);
assert(answers[1] === "$9.53$", `part ii answer is 9.53 (got ${answers[1]})`);

if (process.exitCode) {
  console.error("\nRoman sub-part tests failed.");
} else {
  console.log("\nAll roman sub-part tests passed.");
}
