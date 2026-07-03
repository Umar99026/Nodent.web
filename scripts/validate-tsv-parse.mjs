import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// Load template from source
const examPdfImport = readFileSync(join(root, "frontend/src/lib/examPdfImport.ts"), "utf8");
const templateMatch = examPdfImport.match(
  /export const EXAM_IMPORT_TSV_TEMPLATE = `([\s\S]*?)`;/,
);
const template = templateMatch?.[1] ?? "";

const samples = [
  { name: "template tabs", text: template },
  {
    name: "comma separated header",
    text: template.replace(/\t/g, ","),
  },
  {
    name: "no header 5-col",
    text: template.split("\n").slice(1).join("\n"),
  },
  {
    name: "Question Text header",
    text: template.replace("question_text", "Question Text"),
  },
  {
    name: "literal backslash-t",
    text: template.replace(/\t/g, "\\t"),
  },
];

async function main() {
  const { answerSlotsFromSolutionTsv } = await import(
    join(root, "frontend/src/lib/practiceExamImport.ts")
  );

  let failed = 0;
  for (const { name, text } of samples) {
    const slots = answerSlotsFromSolutionTsv(text);
    const ok = slots.length >= 4;
    console.log(`${ok ? "OK" : "FAIL"} ${name}: ${slots.length} slots`);
    if (!ok) failed++;
  }
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
