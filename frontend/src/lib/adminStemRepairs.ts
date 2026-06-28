import { questionStemKey } from "@/lib/builtinQuestionsSeed";
import { normalizeQuestionMathText } from "@/lib/questionMathText";

/** Canonical question text keyed by normalized stem (fixes DB rows on admin load). */
export const ADMIN_STEM_CANONICAL: Record<string, string> = {
  [questionStemKey(
    "Tide model $d(t)=2.5\\cos\\!\\left(\\dfrac{\\pi t}{6}\\right)+4$. Amplitude (metres)?",
  )]:
    "Tide model $d(t)=2.5\\cos\\!\\left(\\dfrac{\\pi t}{6}\\right)+4$. Amplitude (metres)?",
  [questionStemKey(
    "In a sample, $18$ successes in $80$ trials. Find $\\hat{p}$ (3 d.p.).",
  )]: "In a sample, $18$ successes in $80$ trials. Find $\\hat{p}$ (3 d.p.).",
  [questionStemKey(
    "Given $f(x)=x+1$ and $g(x)=x^2$, find $(f\\circ g)(2)$.",
  )]: "Given $f(x)=x+1$ and $g(x)=x^2$, find $(f\\circ g)(2)$.",
  [questionStemKey(
    "Find the smallest positive solution to $\\sin x = \\frac{\\sqrt{2}}{2}$ on $[0,2\\pi)$. The answer is $\\frac{\\pi}{k}$. Find $k$.",
  )]:
    "Find the smallest positive solution to $\\sin x = \\frac{\\sqrt{2}}{2}$ on $[0,2\\pi)$. The answer is $\\frac{\\pi}{k}$. Find $k$.",
  [questionStemKey(
    "For $n=4$, $p=0.5$, find $P(X=2)$ as a fraction.",
  )]: "For $n=4$, $p=0.5$, find $P(X=2)$ as a fraction.",
};

/** Match legacy / mangled stems to their canonical replacement text. */
const ADMIN_STEM_REPAIR_RULES: Array<{ includes: string; question: string }> = [
  {
    includes: "tide model",
    question:
      "Tide model $d(t)=2.5\\cos\\!\\left(\\dfrac{\\pi t}{6}\\right)+4$. Amplitude (metres)?",
  },
  {
    includes: "ferris wheel height",
    question:
      "Ferris wheel height $h(t)=10\\sin\\!\\left(\\dfrac{\\pi t}{6}\\right)+12$ (metres). Minimum height?",
  },
  {
    includes: "p(x=2) as fraction",
    question: "For $n=4$, $p=0.5$, find $P(X=2)$ as a fraction.",
  },
  {
    includes: "smallest positive solution",
    question:
      "Find the smallest positive solution to $\\sin x = \\frac{\\sqrt{2}}{2}$ on $[0,2\\pi)$. The answer is $\\frac{\\pi}{k}$. Find $k$.",
  },
  {
    includes: "sqrt{2}}{2}$ on",
    question:
      "Find the smallest positive solution to $\\sin x = \\frac{\\sqrt{2}}{2}$ on $[0,2\\pi)$. The answer is $\\frac{\\pi}{k}$. Find $k$.",
  },
  {
    includes: "sample:",
    question: "In a sample, $18$ successes in $80$ trials. Find $\\hat{p}$ (3 d.p.).",
  },
  {
    includes: "18$ successes in $80",
    question: "In a sample, $18$ successes in $80$ trials. Find $\\hat{p}$ (3 d.p.).",
  },
  {
    includes: "composite:",
    question: "Given $f(x)=x+1$ and $g(x)=x^2$, find $(f\\circ g)(2)$.",
  },
  {
    includes: "perpetuity:",
    question:
      "For a perpetuity with annual payment $\\$4\\,800$ at $5\\%$ p.a., find the present value (nearest dollar).",
  },
  {
    includes: "tasks: a(3)",
    question:
      "In a project network, tasks follow A(3)→B(2)→D(4) and A→C(1)→D. What is the critical path duration?",
  },
  {
    includes: "implicit:",
    question:
      "For $x^2 + y^2 = 25$, at $(3,4)$ find $k$ if $\\dfrac{dy}{dx} = -\\dfrac{3}{k}$.",
  },
  {
    includes: "separable:",
    question: "For $\\dfrac{dy}{dx} = 2y$, is the solution growth or decay? (one word)",
  },
  {
    includes: "verify: $y = ce",
    question:
      "Does $y = Ce^{2x}$ satisfy $y' = 2y$ for any constant $C$? (true or false)",
  },
  {
    includes: "polar:",
    question:
      "For $z = 2\\operatorname{cis}\\!\\left(\\dfrac{\\pi}{3}\\right)$, find the real part.",
  },
  {
    includes: "solid: region under",
    question:
      "A solid is formed when the region under $y=x^2$ from 0 to 2 is rotated about the $x$-axis. In $\\pi\\int_0^2 x^4\\,dx$, what is the power of $x$ in the integrand?",
  },
  {
    includes: "statement: 'all primes are odd",
    question: "The statement 'All primes are odd' is false. Give the smallest counterexample.",
  },
  {
    includes: "statement: 'if $n^2$ is even",
    question:
      "For 'If $n^2$ is even then $n$ is even', the contrapositive starts 'If $n$ is odd then …'. Complete: $n^2$ is ___ ?",
  },
];

export function repairAdminQuestionStem(question: string): string | undefined {
  const normalized = normalizeQuestionMathText(question);
  const key = questionStemKey(normalized);
  if (ADMIN_STEM_CANONICAL[key]) return ADMIN_STEM_CANONICAL[key];

  const stem = questionStemKey(question);
  for (const rule of ADMIN_STEM_REPAIR_RULES) {
    if (stem.includes(rule.includes.toLowerCase())) {
      const canonical = normalizeQuestionMathText(rule.question);
      if (questionStemKey(canonical) !== stem) return canonical;
    }
  }

  if (normalized && normalized !== String(question ?? "").trim()) {
    return normalized;
  }
  return undefined;
}
