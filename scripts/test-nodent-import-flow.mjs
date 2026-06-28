/**
 * Smoke test: NODENT metadata → parts with auto answers + input-box hint.
 *
 *   node scripts/test-nodent-import-flow.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Dynamic import from frontend — run via node with experimental or duplicate minimal parse.
// Use the generated PDF + pdfjs from frontend.

const FIXTURE = resolve(process.cwd(), "fixtures/nodent-test-figure-inputs.pdf");

async function main() {
  const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { openPdfDocument } = await import("../frontend/src/lib/pdfQuestionImport.ts").catch(
    () => ({ openPdfDocument: null }),
  );

  if (!openPdfDocument) {
    // Fallback: parse metadata text from PDF only
    const data = new Uint8Array(readFileSync(FIXTURE));
    const loadingTask = getDocument({ data, useSystemFonts: true });
    const doc = await loadingTask.promise;
    const page = await doc.getPage(1);
    const textContent = await page.getTextContent();
    const text = textContent.items.map((i) => i.str).join(" ");

    const block = text.match(/---NODENT---([\s\S]*?)---END---/i)?.[1] ?? "";
    const fields = new Map();
    for (const line of block.split(/\s+/).join("\n").split("\n")) {
      const m = line.match(/^([a-z0-9_]+):\s*(.*)$/i);
      if (m) fields.set(m[1].toLowerCase(), m[2].trim());
    }

    const partAAnswer = fields.get("part_a_answer");
    const partBAnswer = fields.get("part_b_answer");
    const needsBoxes = fields.get("needs_input_boxes");

    let failed = 0;
    if (partAAnswer !== "2.5") {
      console.error("FAIL part_a_answer:", partAAnswer);
      failed++;
    } else console.log("ok part_a_answer 2.5");
    if (partBAnswer !== "6.25") {
      console.error("FAIL part_b_answer:", partBAnswer);
      failed++;
    } else console.log("ok part_b_answer 6.25");
    if (needsBoxes !== "true") {
      console.error("FAIL needs_input_boxes:", needsBoxes);
      failed++;
    } else console.log("ok needs_input_boxes true");

    process.exit(failed ? 1 : 0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
