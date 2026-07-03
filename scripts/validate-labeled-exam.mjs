import fs from "fs";

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node scripts/validate-labeled-exam.mjs <pdf>");
  process.exit(1);
}

const pdfjs = await import("../frontend/node_modules/pdfjs-dist/legacy/build/pdf.mjs");
const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

const QUESTION_HEADER_RE =
  /^Question\s+(\d{1,2})\s*\(\s*(\d{1,2})\s*marks?\s*\)/i;
const LETTER_MARKER_RE =
  /(?:^|\n|[.?!;]\s*|\s+)([a-e])\.\s+(?=\S)/g;
const ROMAN_MARKER_RE =
  /(?:^|\n)\s*(i{1,3}|iv)\.\s+(?=\S)/gi;

function extractPageText(items) {
  items.sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);
  let text = "";
  let lastY = null;
  for (const item of items) {
    const y = item.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 7) text += "\n";
    else if (text && !text.endsWith("\n") && !text.endsWith(" ")) text += " ";
    text += item.str;
    lastY = y;
  }
  return text;
}

function groupSpans(items, viewport, pageNumber) {
  const spans = [];
  for (const item of items) {
    if (!item.str?.trim()) continue;
    const pdfjs = { Util: { transform: (a, b) => b } };
    const tm = item.transform;
    const fontSize = 12;
    const top = (tm[5] ?? 0) - fontSize;
    spans.push({
      str: item.str,
      leftPct: ((tm[4] ?? 0) / viewport.width) * 100,
      topPct: (top / viewport.height) * 100,
      pageNumber,
    });
  }
  spans.sort((a, b) => b.topPct - a.topPct || a.leftPct - b.leftPct);
  const lines = [];
  const lineTol = 1.25;
  for (const span of spans) {
    if (span.topPct < 2.5 || span.topPct > 97.5) continue;
    const last = lines[lines.length - 1];
    if (last && Math.abs(span.topPct - last.topPct) < lineTol) {
      last.text += (last.text.endsWith(" ") ? "" : " ") + span.str;
      last.leftPct = Math.min(last.leftPct, span.leftPct);
    } else {
      lines.push({
        text: span.str.trim(),
        leftPct: span.leftPct,
        topPct: span.topPct,
        pageNumber,
      });
    }
  }
  return lines.map((l) => ({ ...l, text: l.text.replace(/\s+/g, " ").trim() })).filter((l) => l.text);
}

const pages = [];
const anchors = [];

for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items = content.items.filter((i) => i.str?.trim());
  const text = extractPageText([...items]);
  const lines = groupSpans(items, viewport, pageNumber);
  pages.push({ pageNumber, text, lines });

  for (const line of lines) {
    const match = line.text.match(QUESTION_HEADER_RE);
    if (!match || /continued/i.test(line.text) || line.leftPct > 22) continue;
    anchors.push({
      localNumber: Number(match[1]),
      marks: Number(match[2]),
      pageNumber,
    });
  }
}

console.log("Question anchors found:", anchors.length);

function blockForQuestion(index) {
  const start = anchors[index].pageNumber;
  const next = anchors[index + 1];
  const end = next ? next.pageNumber - 1 : pages[pages.length - 1].pageNumber;
  return pages.filter((p) => p.pageNumber >= start && p.pageNumber <= end);
}

function findParts(blockText) {
  const cleaned = blockText.replace(/\r/g, "");
  const markers = [];
  for (const re of [LETTER_MARKER_RE, ROMAN_MARKER_RE]) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(cleaned)) !== null) {
      markers.push(match[1].toLowerCase());
    }
  }
  return [...new Set(markers)];
}

anchors.forEach((anchor, index) => {
  const block = blockForQuestion(index);
  const blockText = block.map((p) => p.text).join("\n\n");
  const parts = findParts(blockText);
  console.log(
    `#${index + 1} [${anchor.pageNumber}] local Q${anchor.localNumber} (${anchor.marks}m) parts: ${parts.join(", ") || "(none)"}`,
  );
});
