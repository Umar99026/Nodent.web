/**
 * Parse fixtures/nodent-test-figure-inputs.pdf with nodentPdfImport.
 *   cd frontend && npx tsx ../scripts/test-nodent-parse-fixture.mjs
 */
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pdfPath = resolve(root, "fixtures/nodent-test-figure-inputs.pdf");

const { parseNodentPdfToQuestions } = await import(
  pathToFileURL(resolve(root, "frontend/src/lib/nodentPdfImport.ts")).href
);

const bytes = readFileSync(pdfPath);
const file = new File([bytes], "nodent-test-figure-inputs.pdf", { type: "application/pdf" });
const { questions, errors } = await parseNodentPdfToQuestions(file);

let failed = 0;
if (errors.length) {
  console.warn("warnings:", errors);
}
if (questions.length !== 1) {
  console.error("FAIL expected 1 question, got", questions.length);
  failed++;
} else {
  const q = questions[0];
  console.log("questionId:", q.questionId);
  console.log("parts:", q.parts.length);
  console.log("labelDiagramEnabled:", q.labelDiagramEnabled);
  const a = q.parts.find((p) => p.label === "a");
  const b = q.parts.find((p) => p.label === "b");
  if (a?.acceptedAnswer !== "2.5") {
    console.error("FAIL part a answer:", a?.acceptedAnswer);
    failed++;
  } else console.log("ok part a answer 2.5");
  if (b?.acceptedAnswer !== "6.25") {
    console.error("FAIL part b answer:", b?.acceptedAnswer);
    failed++;
  } else console.log("ok part b answer 6.25");
  if (!q.useImage) {
    console.error("FAIL useImage false");
    failed++;
  } else console.log("ok useImage");
  if (!q.labelDiagramEnabled) {
    console.error("FAIL labelDiagramEnabled false");
    failed++;
  } else console.log("ok labelDiagramEnabled");
  if (q.imageDataUrl?.startsWith("data:")) {
    console.log("ok page image rendered");
  } else {
    console.error("FAIL no imageDataUrl");
    failed++;
  }
}

process.exit(failed ? 1 : 0);
