import fs from "fs";
import path from "path";

const pdfPath = process.argv[2];
if (!pdfPath) {
  console.error("Usage: node scripts/analyze-pdf.mjs <pdf>");
  process.exit(1);
}

const pdfjs = await import("../frontend/node_modules/pdfjs-dist/legacy/build/pdf.mjs");
const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;
console.log("Pages:", doc.numPages);

for (let p = 1; p <= doc.numPages; p++) {
  const page = await doc.getPage(p);
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const items = content.items.filter((i) => i.str?.trim());
  items.sort(
    (a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4],
  );
  let text = "";
  let lastY = null;
  for (const item of items) {
    const y = item.transform[5];
    if (lastY !== null && Math.abs(y - lastY) > 7) text += "\n";
    else if (text && !text.endsWith("\n") && !text.endsWith(" ")) text += " ";
    text += item.str;
    lastY = y;
  }
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const interesting = lines.filter(
    (l) =>
      /^(Question|QUESTION|\d+\.|\d+\)|[a-z]\)|\([a-z]\)|[a-z]\.)/i.test(l) ||
      /Question \d/i.test(l) ||
      /\(\d+ marks?\)/i.test(l),
  );
  if (interesting.length) {
    console.log(`\n=== PAGE ${p} ===`);
    interesting.forEach((l) => console.log(">", l.slice(0, 160)));
  }

  // Also dump left-margin spans for question detection
  const marginAnchors = [];
  for (const item of items) {
    const leftPct = (item.transform[4] / viewport.width) * 100;
    const t = item.str.trim();
    if (leftPct < 20 && /^(Question|\d+\.|[a-z]\)|\([a-z]\))/i.test(t)) {
      marginAnchors.push({ leftPct: leftPct.toFixed(1), t: t.slice(0, 80) });
    }
  }
  if (marginAnchors.length) {
    console.log("  margin:", marginAnchors.map((a) => `[${a.leftPct}%] ${a.t}`).join(" | "));
  }
}
