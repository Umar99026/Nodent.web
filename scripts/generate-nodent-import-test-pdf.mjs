/**
 * Generate a small NODENT PDF for testing auto-answers + figure input placement.
 *
 *   node scripts/generate-nodent-import-test-pdf.mjs
 *
 * Output: fixtures/nodent-test-figure-inputs.pdf
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const OUT = resolve(process.cwd(), "fixtures/nodent-test-figure-inputs.pdf");

const METADATA = `---NODENT---
question_id: test-figure-q1
subject_id: demo
type: short_answer
topic: Data analysis
marks: 4
use_image: true
needs_input_boxes: true
question: The table below shows test scores for five students.
part_a_label: Find the standard deviation
part_a_marks: 2
part_a_answer: 2.5
part_b_label: Find the variance
part_b_marks: 2
part_b_answer: 6.25
---END---`;

async function main() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595, 842]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Hidden metadata (tiny, top of page)
  page.drawText(METADATA, {
    x: 24,
    y: 820,
    size: 6,
    font,
    color: rgb(0.55, 0.55, 0.55),
    lineHeight: 7,
    maxWidth: 547,
  });

  // Student-facing layout
  let y = 760;
  const draw = (text, opts = {}) => {
    page.drawText(text, { x: 48, y, size: 11, font, ...opts });
    y -= 18;
  };

  draw("Question 1 (4 marks)", { font: fontBold, size: 13 });
  y -= 4;
  draw("The table below shows test scores for five students.");
  y -= 8;

  // Simple table figure
  const tableTop = y;
  const colW = 90;
  const rowH = 28;
  const headers = ["Student", "Score"];
  const rows = [
    ["A", "12"],
    ["B", "15"],
    ["C", "18"],
    ["D", "14"],
    ["E", "16"],
  ];
  const tableX = 72;
  const tableW = colW * 2;
  const tableH = rowH * (rows.length + 1);

  page.drawRectangle({
    x: tableX,
    y: tableTop - tableH,
    width: tableW,
    height: tableH,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1,
  });
  for (let r = 0; r <= rows.length; r++) {
    page.drawLine({
      start: { x: tableX, y: tableTop - r * rowH },
      end: { x: tableX + tableW, y: tableTop - r * rowH },
      thickness: 1,
      color: rgb(0, 0, 0),
    });
  }
  page.drawLine({
    start: { x: tableX + colW, y: tableTop },
    end: { x: tableX + colW, y: tableTop - tableH },
    thickness: 1,
    color: rgb(0, 0, 0),
  });

  page.drawText(headers[0], { x: tableX + 12, y: tableTop - 20, size: 10, font: fontBold });
  page.drawText(headers[1], { x: tableX + colW + 12, y: tableTop - 20, size: 10, font: fontBold });
  rows.forEach((row, i) => {
    const ry = tableTop - rowH * (i + 1) - 18;
    page.drawText(row[0], { x: tableX + 12, y: ry, size: 10, font });
    page.drawText(row[1], { x: tableX + colW + 12, y: ry, size: 10, font });
  });

  y = tableTop - tableH - 24;
  draw("a)  Find the standard deviation.");
  draw("b)  Find the variance.");

  mkdirSync(dirname(OUT), { recursive: true });
  const bytes = await doc.save();
  writeFileSync(OUT, bytes);
  console.log(`Wrote ${OUT}`);
  console.log("Expected after import:");
  console.log("  part a accepted answer: 2.5");
  console.log("  part b accepted answer: 6.25");
  console.log("  needs_input_boxes / Place answers on figure: enabled hint");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
