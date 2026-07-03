import type { SmartMarkResult } from "@/lib/questionAiMarking";
import { enrichHandwritingMarkResult } from "@/lib/questionAiMarking";

/** 1×1 PNG — satisfies handwriting pad "has content" without a real drawing. */
export const DEMO_MATHS_DEV_PLACEHOLDER_DRAWING =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

const DEMO_MATHS_DEV_MOCK_MARK: SmartMarkResult = {
  correct: false,
  scorePercent: 0,
  feedback:
    "• Part (a): you gave the rate at $h=5\\,\\text{m}$, not at $h=4\\,\\text{m}$.\n" +
    "• Part (b): you reused the part (a) answer — the surface area is larger at greater depth.",
  correctAnswers: ["2", "1.28"],
  partResults: [
    {
      index: 0,
      correct: false,
      studentAnswerRead: "1.28 m/min",
      correctAnswer: "2 m/min",
      partFeedback:
        "• You wrote $\\frac{dh}{dt} = 1.28\\,\\text{m/min}$, which matches the answer for part (b), not this depth.\n" +
        "• At $h = 4\\,\\text{m}$: $8\\pi = \\frac{\\pi h^2}{4}\\frac{dh}{dt}$ gives $\\frac{dh}{dt} = 2\\,\\text{m/min}$.\n" +
        "• Check you substituted $h = 4$, not $h = 5$.",
    },
    {
      index: 1,
      correct: false,
      studentAnswerRead: "2 m/min",
      correctAnswer: "1.28 m/min",
      partFeedback:
        "• You wrote $\\frac{dh}{dt} = 2\\,\\text{m/min}$ — the same rate as part (a), but the water surface is deeper here.\n" +
        "• At $h = 5\\,\\text{m}$: $\\frac{dh}{dt} = \\frac{8\\pi}{\\pi h^2/4} = \\frac{32}{25} \\approx 1.28\\,\\text{m/min}$.\n" +
        "• The inflow rate is unchanged; only the surface area changes.",
    },
  ],
};

/** Localhost-only mock marking — never used in production builds. */
export function getDemoMathsDevMockMark(expectedAnswers?: string[]): SmartMarkResult | null {
  if (!import.meta.env.DEV) return null;
  if (expectedAnswers?.length) {
    return enrichHandwritingMarkResult(DEMO_MATHS_DEV_MOCK_MARK, expectedAnswers);
  }
  return { ...DEMO_MATHS_DEV_MOCK_MARK };
}
