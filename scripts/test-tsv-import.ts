import { answerSlotsFromSolutionTsv } from "../frontend/src/lib/practiceExamImport.ts";
import { EXAM_IMPORT_TSV_TEMPLATE } from "../frontend/src/lib/examPdfImport.ts";

const cases: Array<{ name: string; text: string }> = [
  { name: "template", text: EXAM_IMPORT_TSV_TEMPLATE },
  {
    name: "spaces single (broken)",
    text: EXAM_IMPORT_TSV_TEMPLATE.replace(/\t/g, " "),
  },
  {
    name: "4-col answers only",
    text: `question\tpart\tanswer\tmarks
1\ta\tnominal\t1
1\tb\t8.5\t1`,
  },
  {
    name: "label column",
    text: `question\tpart\tlabel\tanswer\tmarks
1\tstem\tThe table below displays...\t\t0
1\ta\tWhich variable?\tnominal\t1`,
  },
  {
    name: "comma with quoted text",
    text: `question,part,question_text,answer,marks
1,stem,"The table below displays the average sleep time, in hours",,0
1,a,Which variable?,nominal,1`,
  },
  {
    name: "Question Text header caps",
    text: EXAM_IMPORT_TSV_TEMPLATE.replace("question_text", "Question Text"),
  },
  {
    name: "no header",
    text: EXAM_IMPORT_TSV_TEMPLATE.split("\n").slice(1).join("\n"),
  },
];

let failed = 0;
for (const { name, text } of cases) {
  const slots = answerSlotsFromSolutionTsv(text);
  const ok = slots.length > 0;
  console.log(`${ok ? "OK" : "FAIL"} [${name}] ${slots.length} slots`);
  if (!ok) failed++;
  else console.log("  sample keys:", slots.slice(0, 3).map((s) => s.key).join(", "));
}

process.exit(failed ? 1 : 0);
