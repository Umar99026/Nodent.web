import type { AnswerPart, LongQuestion, Question } from "@/lib/subjects";

/**
 * Built-in Maths sandbox question(s) — loaded without the database.
 * Draw working on the pad; submit triggers OpenAI vision marking (demo subject only).
 */
function longMultipart(
  topic: string,
  question: string,
  answerParts: AnswerPart[],
  marks?: number,
  guidance?: string,
): LongQuestion {
  return {
    type: "long",
    topic,
    question,
    answerParts,
    marks,
    guidance,
  };
}

export const DEMO_MATHS_QUESTIONS: Question[] = [
  longMultipart(
    "Data analysis",
    "A school collects paired data for 10 students: weekly study time $x$ (hours) and test score $y$ (%). The least-squares regression line is $\\hat y = 38.6 + 4.12x$ with $s_y = 12.5$ and correlation $r = 0.76$.\n\nThe mean study time is $\\bar x = 6.0$ hours.",
    [
      {
        key: "a",
        label:
          "a) Interpret the slope in context and state whether the association is strong, moderate, or weak.",
        marks: 2,
        placeholder: "Explain in words…",
      },
      {
        key: "b",
        label:
          "b) Estimate the test score for a student who studies $8.5$ hours per week. Comment on whether this is interpolation or extrapolation if the observed $x$ values ranged from 2 to 9.",
        marks: 2,
        placeholder: "Show substitution and conclusion…",
      },
      {
        key: "c",
        label:
          "c) A student studied 7 hours and scored 62%. Find the residual and interpret it.",
        marks: 2,
        placeholder: "Compute residual and interpret…",
      },
    ],
    6,
    "Use residual = actual − predicted. For part (b), compare $x=8.5$ to the given range.",
  ),
  longMultipart(
    "Recursion and financial modelling",
    "A phone is bought for $\\$1\\,480$ on a reducing-balance plan. The outstanding balance after $n$ months is modelled by\n\\[B_{n+1} = 1.015\\,B_n - 120,\\quad B_0 = 1480.\\]\nAssume the interest is applied monthly then the repayment is made.",
    [
      {
        key: "a",
        label: "a) Calculate $B_1$ and $B_2$, rounding to the nearest cent.",
        marks: 2,
        placeholder: "Show working…",
      },
      {
        key: "b",
        label:
          "b) Find the equilibrium (steady) balance $B$ for this recurrence, and explain what it means in context.",
        marks: 2,
        placeholder: "Solve for B and interpret…",
      },
      {
        key: "c",
        label:
          "c) Using the equilibrium, determine whether the balance will reach $0$ in a finite number of months. Justify briefly.",
        marks: 2,
        placeholder: "Reason using equilibrium/stability…",
      },
    ],
    6,
    "Equilibrium satisfies $B = 1.015B - 120$. If the equilibrium is positive, compare repayments vs interest when near 0.",
  ),
  longMultipart(
    "Matrices",
    "A wildlife park tracks animals moving between three habitats (A, B, C) each month. The transition matrix is\n\\[T=\\begin{pmatrix}0.70&0.10&0.20\\\\0.20&0.80&0.10\\\\0.10&0.10&0.70\\end{pmatrix}\\]\nwhere each column represents the current habitat and each entry is the probability of moving to a habitat next month.",
    [
      {
        key: "a",
        label:
          "a) Verify that $T$ is a valid transition matrix and explain what one column sums to in this context.",
        marks: 2,
        placeholder: "State and check condition…",
      },
      {
        key: "b",
        label:
          "b) If the current distribution is $\\mathbf{x}_0 = \\begin{pmatrix}120\\\\90\\\\90\\end{pmatrix}$, find $\\mathbf{x}_1$ and $\\mathbf{x}_2$ (rounded to whole animals).",
        marks: 3,
        placeholder: "Compute T x0, then T x1…",
      },
      {
        key: "c",
        label:
          "c) Determine the steady-state distribution (as proportions) by solving $T\\mathbf{x}=\\mathbf{x}$ with $x_A+x_B+x_C=1$.",
        marks: 3,
        placeholder: "Solve linear system…",
      },
    ],
    8,
    "For steady state, solve (T−I)x=0 plus the sum constraint.",
  ),
  longMultipart(
    "Networks and decision mathematics",
    "A project has activities with durations (days):\n\n- A(3) then B(5) and C(4) can start\n- D(6) depends on B\n- E(2) depends on C\n- F(4) depends on D and E\n\nAssume activities start as soon as possible.",
    [
      {
        key: "a",
        label:
          "a) Draw the precedence network and find the earliest start/finish times for each activity.",
        marks: 3,
        placeholder: "List ES/EF values…",
      },
      {
        key: "b",
        label: "b) Find the minimum project completion time and identify the critical path.",
        marks: 2,
        placeholder: "State duration + path…",
      },
      {
        key: "c",
        label:
          "c) Calculate the total float for activity E and interpret what it means for scheduling.",
        marks: 2,
        placeholder: "Compute float and interpret…",
      },
    ],
    7,
    "Use forward pass for earliest times; use backward pass to get floats and the critical path.",
  ),
];
