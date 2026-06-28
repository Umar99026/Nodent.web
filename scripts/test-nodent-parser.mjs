/** Smoke tests for NODENT metadata parsing (no PDF). */

function normalizeNodentText(text) {
  return text
    .replace(/\u2013|\u2014|\u2212/g, "-")
    .replace(/\uFF1A/g, ":")
    .replace(/-{2,}\s*\n\s*NODENT\s*\n\s*-{2,}/gi, "---NODENT---")
    .replace(/-{2,}\s*\n\s*END\s*\n\s*-{2,}/gi, "---END---")
    .replace(/-{2,}\s*NODENT\s*-{2,}/gi, "---NODENT---")
    .replace(/-{2,}\s*END\s*-{2,}/gi, "---END---");
}

function normalizeFieldKey(raw) {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function looksLikeFieldLine(line) {
  const colon = line.indexOf(":");
  if (colon <= 0) return false;
  const key = normalizeFieldKey(line.slice(0, colon));
  if (!/^[a-z][a-z0-9_]*$/.test(key)) return false;
  const known = new Set([
    "question_id", "subject_id", "type", "topic", "marks", "use_image", "question",
    "option_a", "option_b", "option_c", "option_d", "correct_answer",
    "part_a_label", "part_a_marks", "part_a_answer",
  ]);
  if (known.has(key)) return true;
  return /^part_(?:[a-z]|i{1,3}|iv)_(label|marks|answer|placeholder)$/.test(key);
}

function parseFieldMap(block) {
  const fields = new Map();
  const normalized = block.replace(/\r\n/g, "\n").replace(/\uFF1A/g, ":");
  const lines = normalized.split("\n").map((l) => l.trim()).filter(Boolean);
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i];
    if (/^---(?:END|NODENT)---$/i.test(trimmed)) continue;
    const colon = trimmed.indexOf(":");
    if (colon < 0) continue;
    const key = normalizeFieldKey(trimmed.slice(0, colon));
    if (!key) continue;
    let val = trimmed.slice(colon + 1).trim();
    while (i + 1 < lines.length) {
      const next = lines[i + 1];
      if (looksLikeFieldLine(next) || /^---/i.test(next)) break;
      i++;
      val = val ? `${val} ${next}` : next;
    }
    if (!fields.has(key) || val) fields.set(key, val);
  }
  if (!fields.has("question_id")) {
    const idMatch = normalized.match(/\bquestion[_\s-]?id\s*:\s*(\S+)/i);
    if (idMatch?.[1]) fields.set("question_id", idMatch[1]);
  }
  return fields;
}

function extractNodentBlockBodies(text) {
  const normalized = normalizeNodentText(text);
  const bodies = [];
  for (const m of normalized.matchAll(/---NODENT---([\s\S]*?)---END---/gi)) {
    const body = m[1]?.trim();
    if (body) bodies.push(body);
  }
  if (bodies.length) return bodies;
  for (const part of normalized.split(/---NODENT---/i).slice(1)) {
    const withoutEnd = part.replace(/---END---[\s\S]*/i, "").trim();
    const nextMarker = withoutEnd.search(/---NODENT---/i);
    const body = (nextMarker >= 0 ? withoutEnd.slice(0, nextMarker) : withoutEnd).trim();
    if (body) bodies.push(body);
  }
  return bodies;
}

const samples = [
  {
    name: "standard block",
    text: `---NODENT---
question_id: 2024-gm1-q1
subject_id: demo
type: mcq
---END---
Figure here`,
    expectId: "2024-gm1-q1",
  },
  {
    name: "value on next line",
    text: `---NODENT---
question_id:
2024-gm1-q2
subject_id: demo
type: short_answer
---END---`,
    expectId: "2024-gm1-q2",
  },
  {
    name: "split marker lines",
    text: `---
NODENT
---
question_id: 2024-gm1-q3
subject_id: demo
---END---`,
    expectId: "2024-gm1-q3",
  },
  {
    name: "multiline question",
    text: `---NODENT---
question_id: gm-q1
subject_id: general-maths
type: short_answer
marks: 2
question: A researcher collects data on hours studied and test scores for 10 students.
The correlation is strong and positive.
part_a_label: State the correlation coefficient.
part_a_answer: 1
---END---`,
    expectId: "gm-q1",
    expectQuestion:
      "A researcher collects data on hours studied and test scores for 10 students. The correlation is strong and positive.",
  },
];

let failed = 0;
for (const s of samples) {
  const bodies = extractNodentBlockBodies(s.text);
  const fields = bodies[0] ? parseFieldMap(bodies[0]) : new Map();
  const id = fields.get("question_id");
  if (id !== s.expectId) {
    console.error("FAIL", s.name, "got", id, "want", s.expectId, { bodies });
    failed++;
  } else if (s.expectQuestion) {
    const q = fields.get("question");
    if (q !== s.expectQuestion) {
      console.error("FAIL", s.name, "question got", q, "want", s.expectQuestion);
      failed++;
    } else {
      console.log("ok", s.name, id);
    }
  } else {
    console.log("ok", s.name, id);
  }
}

// Infinite-loop guard: regex without g used to blow up here
const huge = "---NODENT---\nquestion_id: x\n---END---\n".repeat(5);
const many = extractNodentBlockBodies(huge);
console.log("block count", many.length, many.length === 5 ? "ok" : "FAIL");

process.exit(failed ? 1 : 0);
