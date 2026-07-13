import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const questionFiles = [
  "src/components/quiz/McqQuestion.tsx",
  "src/components/quiz/ShortQuestion.tsx",
  "src/components/quiz/LongQuestion.tsx",
];
const forbiddenRenderers = [
  "WrongAnswerFeedbackPanel",
  "AiMarkingFeedbackPanel",
  "AiMarkingPartFeedback",
  "MultipartMarkBreakdown",
  "MarkBreakdownFeedbackPanel",
];

const failures = [];

for (const relativePath of questionFiles) {
  const source = readFileSync(resolve(root, relativePath), "utf8");
  const unifiedRenders = source.match(/<QuestionFeedbackPanel\b/g)?.length ?? 0;
  if (unifiedRenders !== 1) {
    failures.push(
      `${relativePath} must render QuestionFeedbackPanel exactly once (found ${unifiedRenders}).`,
    );
  }
  for (const renderer of forbiddenRenderers) {
    if (source.includes(renderer)) {
      failures.push(`${relativePath} must not use legacy feedback renderer ${renderer}.`);
    }
  }
}

const panelSource = readFileSync(
  resolve(root, "src/components/quiz/QuestionFeedbackPanel.tsx"),
  "utf8",
);
if ((panelSource.match(/data-question-feedback=/g)?.length ?? 0) !== 1) {
  failures.push("QuestionFeedbackPanel must own the single data-question-feedback marker.");
}
if (!panelSource.includes(">\n              Feedback\n")) {
  failures.push('QuestionFeedbackPanel must keep the visible title "Feedback".');
}

const builderSource = readFileSync(resolve(root, "src/lib/wrongAnswerFeedback.ts"), "utf8");
for (const requiredPhrase of ["Correct answer:", "How to get it:"]) {
  if (!builderSource.includes(requiredPhrase)) {
    failures.push(`Wrong-answer feedback must include the permanent "${requiredPhrase}" step.`);
  }
}

if (failures.length) {
  throw new Error(`Feedback contract failed:\n- ${failures.join("\n- ")}`);
}

console.log("Feedback contract passed: one shared feedback box per question type.");
