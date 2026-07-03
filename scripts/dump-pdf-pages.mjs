import fs from "fs";

const pdfPath = process.argv[2];
const pdfjs = await import("../frontend/node_modules/pdfjs-dist/legacy/build/pdf.mjs");
const data = new Uint8Array(fs.readFileSync(pdfPath));
const doc = await pdfjs.getDocument({ data, useSystemFonts: true }).promise;

async function pageText(p) {
  const page = await doc.getPage(p);
  const content = await page.getTextContent();
  const items = content.items.filter((i) => i.str?.trim());
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

for (const p of [2, 3, 5, 6, 9]) {
  console.log("\n\n======== PAGE", p, "========\n");
  console.log(await pageText(p));
}
