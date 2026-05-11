/**
 * One-off: extract text from Methods topic PDFs → JSON for codegen.
 * Run: node scripts/extract-methods-pdfs.mjs "path/to/folder"
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFParse } from "pdf-parse";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const srcDir = process.argv[2];
if (!srcDir) {
  console.error('Usage: node scripts/extract-methods-pdfs.mjs "<folder with PDFs>"');
  process.exit(1);
}

function keyFromBasename(name) {
  return name
    .replace(/\.pdf$/i, "")
    .replace(/_/g, " ")
    .replace(/\s*\(\d+\)\s*$/i, "")
    .trim();
}

function cleanText(t) {
  return String(t ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/ +\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const files = fs
  .readdirSync(srcDir)
  .filter((f) => f.toLowerCase().endsWith(".pdf"))
  .sort((a, b) => a.localeCompare(b));

const out = {};
for (const f of files) {
  const full = path.join(srcDir, f);
  const buf = fs.readFileSync(full);
  const parser = new PDFParse({ data: buf });
  const data = await parser.getText();
  await parser.destroy();
  const key = keyFromBasename(f);
  const text = cleanText(data.text);
  if (!text) {
    console.warn("empty:", f);
    continue;
  }
  if (out[key]) {
    out[key] = `${out[key]}\n\n---\n\n### (from ${f})\n\n${text}`;
  } else {
    const title = keyFromBasename(f);
    out[key] = `### ${title}\n\n${text}`;
  }
  console.error("ok:", f, "chars:", text.length);
}

const jsonPath = path.join(__dirname, "..", "src", "lib", "data", "methodsTopicOverviews.raw.json");
fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
fs.writeFileSync(jsonPath, JSON.stringify(out, null, 0), "utf8");
console.log("wrote", jsonPath, "keys:", Object.keys(out).length);
