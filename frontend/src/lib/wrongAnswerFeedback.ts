import { isProseModelAnswer } from "@/lib/wordedQuestion";
import { isHandwritingValue } from "@/lib/handwritingMode";
import {
  extractExplanationKeywords,
  normalizeAnswer,
  parseNumericAnswer,
  splitAnswerValueAndUnit,
} from "@/lib/utils";

export type WrongAnswerFeedbackInput = {
  studentAnswer: string;
  expectedAnswers: string[];
  guidance?: string;
  questionText?: string;
  /** Skip bank guidance — used for free short-answer (match-only) feedback. */
  genericOnly?: boolean;
};

function primaryExpected(accepted: string[]): string {
  return accepted.map((a) => String(a ?? "").trim()).filter(Boolean)[0] ?? "";
}

function formatNumber(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return n
    .toFixed(4)
    .replace(/\.?0+$/, "")
    .replace(/\.$/, "");
}

function diagnoseNumericMismatch(student: string, expected: string): string | null {
  const studentNum = parseNumericAnswer(student);
  const expectedNum = parseNumericAnswer(expected);
  if (studentNum == null || expectedNum == null) return null;

  if (
    Math.abs(studentNum + expectedNum) < 1e-9 &&
    Math.abs(expectedNum) > 1e-9 &&
    Math.abs(studentNum) > 1e-9
  ) {
    return "Check the sign — your value has the right magnitude but the wrong sign.";
  }

  if (Math.abs(studentNum) > 1e-9 && Math.abs(expectedNum) > 1e-9) {
    const ratio = studentNum / expectedNum;
    if (Math.abs(ratio - 10) < 0.02 || Math.abs(ratio - 0.1) < 0.002) {
      return "Check place value — your answer may be off by a factor of 10.";
    }
    if (Math.abs(ratio - 100) < 0.5 || Math.abs(ratio - 0.01) < 0.005) {
      return "Check place value — your answer may be off by a factor of 100.";
    }
    if (Math.abs(ratio + 1) < 0.02) {
      return "Your answer is the negative of the correct value — recheck the direction or subtraction step.";
    }
  }

  const scale = Math.max(1, Math.abs(expectedNum));
  const relErr = Math.abs(studentNum - expectedNum) / scale;
  if (relErr > 1e-9 && relErr < 0.08) {
    return `Your value (${formatNumber(studentNum)}) is close to ${formatNumber(expectedNum)} — check rounding, units, or an intermediate step.`;
  }
  if (relErr >= 0.08) {
    return `Your value (${formatNumber(studentNum)}) does not match ${formatNumber(expectedNum)} — rework the method from the given information.`;
  }

  return null;
}

function diagnoseUnitMismatch(student: string, expected: string): string | null {
  const s = splitAnswerValueAndUnit(student);
  const e = splitAnswerValueAndUnit(expected);
  if (s.unit && e.unit && s.unit.toLowerCase() !== e.unit.toLowerCase()) {
    return `Check units — you wrote "${s.unit}" but the answer should use "${e.unit}".`;
  }
  if (!s.unit && e.unit && parseNumericAnswer(s.value) != null) {
    return `Include the unit: ${e.unit}.`;
  }
  return null;
}

function missingRubricKeywords(student: string, expected: string): string[] {
  const keywords = extractExplanationKeywords(expected);
  const studentNorm = normalizeAnswer(student);
  return keywords.filter((kw) => kw.length >= 3 && !studentNorm.includes(kw));
}

function diagnoseProseMismatch(student: string, expected: string): string | null {
  if (parseNumericAnswer(student) != null && parseNumericAnswer(expected) != null) return null;
  if (!isProseModelAnswer(expected)) return null;
  const missing = missingRubricKeywords(student, expected);
  if (!student.trim()) {
    return "Write a full response that addresses every part of the question command.";
  }
  if (missing.length) {
    const shown = missing.slice(0, 4);
    const more = missing.length > shown.length ? ` (+${missing.length - shown.length} more)` : "";
    return `Your answer should explicitly cover: ${shown.join(", ")}${more}.`;
  }
  if (student.trim().length < expected.trim().length * 0.35) {
    return "Expand your answer — add definitions, reasons, or a worked example as the question asks.";
  }
  return "Compare your reasoning to the model answer — key ideas or steps may be missing or stated too vaguely.";
}

function diagnoseAlgebraicMismatch(student: string, expected: string): string | null {
  const s = normalizeAnswer(student);
  const e = normalizeAnswer(expected);
  if (!s || !e || s === e) return null;
  if (parseNumericAnswer(student) != null || parseNumericAnswer(expected) != null) return null;
  if (isProseModelAnswer(expected)) return null;
  if (s.replace(/\s/g, "") === e.replace(/\s/g, "")) {
    return "Your expression matches apart from spacing or formatting — check whether the question needs a simplified form.";
  }
  return "Your expression does not match the model form — check factorisation, simplification, or which variable you solved for.";
}

function defaultCorrectMethod(expected: string): string {
  if (isProseModelAnswer(expected)) {
    return "Use the command word in the question, state each required idea clearly, then support it with the relevant reason, evidence, or example.";
  }
  if (parseNumericAnswer(expected) != null) {
    return "Identify the required relationship, substitute the given values carefully, show each calculation, include the correct unit, and only round at the end.";
  }
  return "Start from the information given, apply the relevant rule one step at a time, simplify carefully, and check that the final form answers exactly what was asked.";
}

/** Build specific bullet points explaining why a short/long answer was marked wrong. */
export function buildWrongAnswerBullets(input: WrongAnswerFeedbackInput): string[] {
  const student = String(input.studentAnswer ?? "").trim();
  const expected = primaryExpected(input.expectedAnswers);
  const bullets: string[] = [];

  if (!student) {
    bullets.push("You did not enter an answer for this part.");
  } else if (!isHandwritingValue(student)) {
    bullets.push(`You answered: ${student}`);
  }

  const diagnoses = [
    diagnoseUnitMismatch(student, expected),
    diagnoseNumericMismatch(student, expected),
    diagnoseProseMismatch(student, expected),
    diagnoseAlgebraicMismatch(student, expected),
  ].filter((line): line is string => Boolean(line));

  for (const line of diagnoses) {
    if (!bullets.includes(line)) bullets.push(line);
  }

  if (expected) {
    bullets.push(`Correct answer: ${expected}`);
  }

  const guidance = !input.genericOnly ? String(input.guidance ?? "").trim() : "";
  const method = guidance
    ? guidance.length > 400
      ? `${guidance.slice(0, 397)}…`
      : guidance
    : expected
      ? defaultCorrectMethod(expected)
      : "Re-read the question, identify what it asks for, and show a clear method before writing your final answer.";
  bullets.push(`How to get it: ${method}`);

  return bullets;
}

export function bulletsToFeedbackText(bullets: string[]): string {
  return bullets.map((b) => `• ${b}`).join("\n");
}

export type McqWrongFeedbackInput = {
  selectedOption: string | null;
  correctOption: string;
  options: string[];
  guidance?: string;
};

/** Specific feedback when an MCQ option is wrong. */
export function buildMcqWrongFeedback(input: McqWrongFeedbackInput): string[] {
  const bullets: string[] = [];
  const correctIdx = input.options.findIndex((opt) => opt === input.correctOption);
  const letter = correctIdx >= 0 ? String.fromCharCode(65 + correctIdx) : "";
  const stripOptionPrefix = (s: string) =>
    String(s ?? "").replace(/^\(?\[?[A-H]\]?\)?\s*[).:\-–—]?\s*/i, "").trim();
  const correctText = stripOptionPrefix(input.correctOption);

  if (input.selectedOption && input.selectedOption !== input.correctOption) {
    const selectedIdx = input.options.findIndex((opt) => opt === input.selectedOption);
    const selectedLetter = selectedIdx >= 0 ? String.fromCharCode(65 + selectedIdx) : "";
    const selectedText =
      input.selectedOption.replace(/^\(?\[?[A-H]\]?\)?\s*[).:\-–—]?\s*/i, "").trim() ||
      input.selectedOption;
    bullets.push(
      selectedLetter
        ? `You chose ${selectedLetter} (${selectedText}). Re-read the stem and rule out options that contradict the given facts.`
        : `You chose: ${selectedText}. Re-read the stem and rule out options that contradict the given facts.`,
    );
  }

  if (letter) {
    bullets.push(
      correctText
        ? `Correct answer: ${letter} (${correctText}).`
        : `Correct answer: ${letter}.`,
    );
  } else if (correctText) {
    bullets.push(`Correct answer: ${correctText}.`);
  }

  const guidance = String(input.guidance ?? "").trim();
  if (guidance) {
    const trimmed = guidance.length > 400 ? `${guidance.slice(0, 397)}…` : guidance;
    // Prefer “how to get it” framing so the feedback is actionable.
    bullets.push(`How to get it: ${trimmed}`);
  } else {
    bullets.push(
      "How to get it: write down the key relationship from the stem, substitute the given values carefully, and only round at the end. Then compare the computed value to the options.",
    );
  }

  return bullets;
}
