import fs from "node:fs";
import path from "node:path";
import process from "node:process";
// pdfjs-dist provides ESM bundles; use dynamic import.
const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");

function usage() {
  console.log(
    [
      "Usage:",
      "  node scripts/import-pdf-to-demo.mjs <path-to-pdf> [--subject demo] [--out <jsonPath>] [--imagesDir <dir>]",
      "",
      "Example:",
      "  node scripts/import-pdf-to-demo.mjs \"C:\\\\Users\\\\you\\\\Downloads\\\\vce_methods_quiz_import_ready.pdf\" --subject demo",
      "",
    ].join("\n"),
  );
}

function readArg(flag) {
  const i = process.argv.findIndex((x) => x === flag);
  if (i < 0) return null;
  return process.argv[i + 1] ?? null;
}

function stripSmartQuotes(s) {
  return String(s ?? "")
    .replace(/[\u201c\u201d\u201e]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
}

function normalizeWhitespace(s) {
  return String(s ?? "").replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
}

function parseAccepted(raw) {
  const cleaned = stripSmartQuotes(raw);
  // Pipe separated alternatives: a | b | c
  return cleaned
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);
}

function isQuestionHeader(line) {
  return /^Question\s+\d+\s*$/i.test(line.trim());
}

function parseSubjectTopic(line) {
  // Subject: Mathematical Methods | Topic: Calculus - differentiation
  const m = line.match(/^Subject:\s*(.+?)\s*\|\s*Topic:\s*(.+?)\s*$/i);
  if (!m) return null;
  return { subjectLabel: m[1].trim(), topic: m[2].trim() };
}

function parsePartLine(line) {
  // (a) ... (2 marks)
  const m = line.match(/^\(([a-z])\)\s*([\s\S]*?)\s*\((\d+)\s*marks?\)\s*$/i);
  if (!m) return null;
  return { part: m[1].toLowerCase(), question: m[2].trim(), marks: Number(m[3]) };
}

function parseAcceptedLine(line) {
  const m = line.match(/^Accepted\s+answers:\s*([\s\S]+?)\s*$/i);
  if (!m) return null;
  return parseAccepted(m[1]);
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function renderPageToPng(pdf, pageNumber1, outPath, scale = 2) {
  const page = await pdf.getPage(pageNumber1);
  const viewport = page.getViewport({ scale });

  // Lazy import for node canvas
  const { createCanvas } = await import("canvas");
  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const ctx = canvas.getContext("2d");

  const renderContext = {
    canvasContext: ctx,
    viewport,
  };
  await page.render(renderContext).promise;
  const buf = canvas.toBuffer("image/png");
  fs.writeFileSync(outPath, buf);
}

async function main() {
  const pdfPath = process.argv[2];
  if (!pdfPath || pdfPath === "--help" || pdfPath === "-h") {
    usage();
    process.exit(pdfPath ? 0 : 1);
  }

  const subjectId = readArg("--subject") ?? "demo";
  const outJson =
    readArg("--out") ??
    path.resolve("imports", `admin-bulk-${subjectId}.json`);
  const imagesDir =
    readArg("--imagesDir") ??
    path.resolve("frontend", "public", "questions", subjectId);

  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  // Extract full text in reading order (line by line) for parsing.
  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((it) => ("str" in it ? it.str : "")).filter(Boolean);
    fullText += `\n--- PAGE ${i} ---\n` + strings.join("\n") + "\n";
  }

  const lines = normalizeWhitespace(fullText)
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const questions = [];
  let currentQNum = null;
  let currentTopic = "General";
  let pendingPart = null; // {part, question, marks}
  let seenPartsInThisQ = 0;
  let pageHint = 1;

  // Create 5 page images (cheap + robust): attach via passage to any question on that page.
  // We'll decide passages when we see PAGE markers.
  ensureDir(imagesDir);
  const pageImageMap = new Map();
  for (let p = 1; p <= pdf.numPages; p += 1) {
    const filename = `source-page-${String(p).padStart(2, "0")}.png`;
    const outPath = path.join(imagesDir, filename);
    await renderPageToPng(pdf, p, outPath, 2);
    pageImageMap.set(p, `/questions/${subjectId}/${filename}`);
  }

  const flushPendingPart = (acceptedAnswers) => {
    if (!pendingPart) return;
    if (!currentQNum) return;
    const partLetter = pendingPart.part;
    const questionText = `**(${partLetter})** ${pendingPart.question}`;
    const marks = pendingPart.marks;
    const passage = pageImageMap.get(pageHint)
      ? `![Source page](${pageImageMap.get(pageHint)})`
      : undefined;

    questions.push({
      subjectId,
      type: "short_answer",
      topic: currentTopic || "General",
      passage,
      question: questionText,
      acceptedAnswers: acceptedAnswers && acceptedAnswers.length ? acceptedAnswers : [],
      marks,
    });
    pendingPart = null;
  };

  for (const line of lines) {
    const pageM = line.match(/^---\s*PAGE\s+(\d+)\s*---$/i);
    if (pageM) {
      pageHint = Number(pageM[1]);
      continue;
    }

    if (isQuestionHeader(line)) {
      // If a question starts while we still have a part with no accepted line, flush with empty accepted.
      flushPendingPart([]);
      currentQNum = Number(line.match(/\d+/)?.[0] ?? 0) || null;
      seenPartsInThisQ = 0;
      continue;
    }

    const st = parseSubjectTopic(line);
    if (st) {
      currentTopic = st.topic || "General";
      continue;
    }

    const part = parsePartLine(line);
    if (part) {
      // If we get a new part without accepted line for previous, flush previous with empty.
      flushPendingPart([]);
      pendingPart = part;
      seenPartsInThisQ += 1;
      continue;
    }

    const acc = parseAcceptedLine(line);
    if (acc) {
      flushPendingPart(acc);
      continue;
    }
  }

  // flush last
  flushPendingPart([]);

  ensureDir(path.dirname(outJson));
  fs.writeFileSync(outJson, JSON.stringify({ questions }, null, 2), "utf8");

  console.log(`Wrote ${questions.length} question parts → ${outJson}`);
  console.log(`Rendered ${pdf.numPages} page image(s) → ${imagesDir}`);
  console.log("");
  console.log("Next step (Admin):");
  console.log("- Go to Admin → Bulk import");
  console.log(`- Paste the contents of ${outJson}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

