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
for (const requiredPhrase of ["Correct answer:", "Worked steps are not available for this question yet."]) {
  if (!builderSource.includes(requiredPhrase)) {
    failures.push(`Wrong-answer feedback must include the permanent "${requiredPhrase}" step.`);
  }
}

const forbiddenGenericMethod =
  "Identify the required relationship, substitute the given values carefully";
if (builderSource.includes(forbiddenGenericMethod)) {
  failures.push("Wrong-answer feedback must not invent the generic calculation method.");
}

const quizPageSource = readFileSync(resolve(root, "src/pages/QuizPage.tsx"), "utf8");
if ((quizPageSource.match(/<AiDrawingQuotaBar\b/g)?.length ?? 0) !== 1) {
  failures.push("QuizPage must render the shared AI drawing quota bar exactly once.");
}
const shortQuestionSource = readFileSync(
  resolve(root, "src/components/quiz/ShortQuestion.tsx"),
  "utf8",
);
if (shortQuestionSource.includes("<AiDrawingQuotaBar")) {
  failures.push("ShortQuestion must not render a second question-specific quota bar.");
}
if (!shortQuestionSource.includes("notifyPremiumUsageUpdated()")) {
  failures.push("A successful AI drawing mark must refresh the shared quota bar.");
}

const practiceQuestionSource = readFileSync(
  resolve(root, "src/lib/practiceQuestions.ts"),
  "utf8",
);
for (const requiredGuidancePath of [
  "options,\n      answer,\n      guidance,",
  "acceptedAnswers,\n      guidance,",
]) {
  if (!practiceQuestionSource.includes(requiredGuidancePath)) {
    failures.push("Question loading must preserve authored guidance for every question type.");
  }
}

if (failures.length) {
  throw new Error(`Feedback contract failed:\n- ${failures.join("\n- ")}`);
}

console.log("Feedback contract passed: one shared feedback box per question type.");
