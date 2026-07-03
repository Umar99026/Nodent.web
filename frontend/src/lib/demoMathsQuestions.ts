import type { ShortQuestion } from "@/lib/subjects";

/**
 * Built-in Maths sandbox question(s) — loaded without the database.
 * Draw working on the pad; submit triggers OpenAI vision marking (demo subject only).
 */
export const DEMO_MATHS_QUESTIONS: ShortQuestion[] = [
  {
    type: "short",
    topic: "Applications of differentiation",
    question:
      "A conical storage vessel stands vertex-down with a fixed height of $6\\,\\text{m}$ and a top radius of $3\\,\\text{m}$. Water is pumped in so that the volume of water increases at a constant rate of $8\\pi\\,\\text{m}^3\\text{/min}$. At any instant the water surface forms a similar cone. Let $h$ metres be the depth of the water.",
    acceptedAnswers: ["2", "1.28"],
    marks: 4,
    guidance:
      "Use $V=\\frac{\\pi h^3}{12}$ from similar triangles ($r=h/2$). Then $\\frac{dV}{dt}=\\frac{\\pi h^2}{4}\\frac{dh}{dt}$. Substitute $\\frac{dV}{dt}=8\\pi$ and the given depth before solving for $\\frac{dh}{dt}$.",
    useAiMarking: false,
    answerParts: [
      {
        key: "a",
        label: "a) Find $\\frac{dh}{dt}$ when the water depth is $4\\,\\text{m}$.",
        marks: 2,
        placeholder: "Draw your working and final answer…",
      },
      {
        key: "b",
        label:
          "b) Hence find $\\frac{dh}{dt}$ when the depth is $5\\,\\text{m}$, with the inflow rate unchanged.",
        marks: 2,
        placeholder: "Draw your working and final answer…",
      },
    ],
  },
];
