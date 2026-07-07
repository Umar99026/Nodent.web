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

  const guidance = String(input.guidance ?? "").trim();
  if (guidance) {
    bullets.push(guidance.length > 400 ? `${guidance.slice(0, 397)}…` : guidance);
  } else if (!diagnoses.length && expected) {
    bullets.push("Review the question and compare each step of your method to the model answer.");
  }

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

  if (input.selectedOption && input.selectedOption !== input.correctOption) {
    const selectedIdx = input.options.findIndex((opt) => opt === input.selectedOption);
    const selectedLetter = selectedIdx >= 0 ? String.fromCharCode(65 + selectedIdx) : "";
    const selectedText =
      input.selectedOption.replace(/^\(?\[?[A-H]\]?\)?\s*[\).:\-–—]?\s*/i, "").trim() ||
      input.selectedOption;
    bullets.push(
      selectedLetter
        ? `You chose ${selectedLetter} (${selectedText}). Re-read the stem and rule out options that contradict the given facts.`
        : `You chose: ${selectedText}. Re-read the stem and rule out options that contradict the given facts.`,
    );
  }

  const guidance = String(input.guidance ?? "").trim();
  if (guidance) {
    bullets.push(guidance.length > 400 ? `${guidance.slice(0, 397)}…` : guidance);
  } else {
    bullets.push(
      "Work through why each incorrect option fails — often one distractor matches a common slip from the question.",
    );
  }

  return bullets;
}
