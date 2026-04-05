export type QuestionType = "mcq" | "short" | "long";

export interface BaseQuestion {
  type: QuestionType;
  topic: string;
  question: string;
  imageUrls?: string[];
  marks?: number;
  guidance?: string;
  passage?: string;
  /** Same id = multi-part question: shown together with one shared stimulus (`passage`). */
  groupId?: string;
  /** Set for admin / DB-backed questions (stable practice keys). */
  id?: number;
}

export interface McqQuestion extends BaseQuestion {
  type: "mcq";
  options: string[];
  answer: string;
}

export interface ShortQuestion extends BaseQuestion {
  type: "short";
  acceptedAnswers: string[];
}

export interface LongQuestion extends BaseQuestion {
  type: "long";
  /**
   * Optional accepted answers/keywords for scoring long responses.
   * Populated for custom questions from admin.
   */
  acceptedAnswers?: string[];
  /**
   * Optional single answer text for scoring long responses.
   * (Used only if `acceptedAnswers` is not provided.)
   */
  answer?: string;
}

export type Question = McqQuestion | ShortQuestion | LongQuestion;

export interface Subject {
  id: string;
  name: string;
  category: string;
  description: string;
  quiz: Question[];
}

export const baseSubjects: Subject[] = [
  {
    id: "methods",
    name: "Mathematical Methods",
    category: "Mathematics",
    description:
      "Functions, calculus, probability, algebra, graphs, and mathematical modelling.",
    quiz: [
      {
        type: "mcq",
        topic: "Calculus",
        question: "What is the derivative of x\u00B2?",
        options: ["x", "2x", "x\u00B2", "2"],
        answer: "2x",
      },
      {
        type: "short",
        topic: "Functions & Graphs",
        question: "State the gradient of a horizontal line.",
        acceptedAnswers: ["0", "zero"],
      },
      {
        type: "mcq",
        topic: "Trigonometry",
        question: "What is sin(90\u00B0)?",
        options: ["0", "1", "-1", "0.5"],
        answer: "1",
      },
      {
        type: "mcq",
        topic: "Algebra",
        question: "3 + 5 \u00D7 2 equals:",
        options: ["16", "13", "10", "8"],
        answer: "13",
      },
      {
        type: "mcq",
        topic: "Functions",
        question: "If f(x)=2x+3, then f(4) is:",
        options: ["8", "11", "13", "16"],
        answer: "11",
      },
      {
        type: "short",
        topic: "Algebra",
        question: "Solve for x: 2x - 6 = 10",
        acceptedAnswers: ["8", "x=8", "x = 8"],
      },
      {
        type: "mcq",
        topic: "Probability",
        question: "A fair coin is tossed once. P(heads) =",
        options: ["0", "1/4", "1/2", "1"],
        answer: "1/2",
      },
      {
        type: "mcq",
        topic: "Calculus",
        question: "The integral of 2x is:",
        options: ["x\u00B2 + C", "2x\u00B2 + C", "x + C", "2 + C"],
        answer: "x\u00B2 + C",
      },
      {
        type: "short",
        topic: "Trigonometry",
        question: "State the value of cos(0\u00B0).",
        acceptedAnswers: ["1", "1.0"],
      },
      {
        type: "mcq",
        topic: "Graphs",
        question: "A parabola y=x\u00B2 opens:",
        options: ["Upwards", "Downwards", "Left", "Right"],
        answer: "Upwards",
      },
      {
        type: "mcq",
        topic: "Algebra",
        question: "Factorise: x\u00B2 \u2212 9",
        options: ["(x\u22123)(x+3)", "(x\u22129)(x+1)", "(x\u22123)\u00B2", "Cannot be factorised"],
        answer: "(x\u22123)(x+3)",
      },
      {
        type: "short",
        topic: "Functions",
        question: "What is the y-intercept of y = 5x \u2212 2?",
        acceptedAnswers: ["-2", "y=-2", "y = -2"],
      },
      {
        type: "mcq",
        topic: "Calculus",
        question: "If f'(x) = 0 for all x in an interval, then f is:",
        options: ["Constant", "Always increasing", "Always decreasing", "Undefined"],
        answer: "Constant",
      },
    ],
  },
  {
    id: "general-maths",
    name: "General Mathematics",
    category: "Mathematics",
    description:
      "Statistics, finance, networks, matrices, measurement, and applied problem solving.",
    quiz: [
      {
        type: "mcq",
        topic: "Statistics",
        question: "25% of 200 is:",
        options: ["25", "50", "75", "100"],
        answer: "50",
      },
      {
        type: "short",
        topic: "Statistics",
        question: "What is the mean of 4, 6 and 8?",
        acceptedAnswers: ["6", "6.0"],
      },
      {
        type: "mcq",
        topic: "Measurement",
        question: "Angles in a triangle add to:",
        options: ["90\u00B0", "180\u00B0", "270\u00B0", "360\u00B0"],
        answer: "180\u00B0",
      },
      {
        type: "mcq",
        topic: "Finance",
        question: "If an item costs $80 after a 20% discount, the original price was:",
        options: ["$90", "$96", "$100", "$120"],
        answer: "$100",
      },
      {
        type: "short",
        topic: "Measurement",
        question: "Convert 2.5 hours to minutes.",
        acceptedAnswers: ["150", "150 minutes", "150 min"],
      },
      {
        type: "mcq",
        topic: "Networks",
        question: "In a network graph, a vertex represents a:",
        options: ["Point/node", "Line segment only", "Angle", "Matrix"],
        answer: "Point/node",
      },
      {
        type: "short",
        topic: "Statistics",
        question: "What is the median of 3, 7, 9, 12, 15?",
        acceptedAnswers: ["9", "9.0"],
      },
      {
        type: "mcq",
        topic: "Matrices",
        question: "A 2\u00D73 matrix has:",
        options: ["2 rows and 3 columns", "3 rows and 2 columns", "5 rows", "6 columns"],
        answer: "2 rows and 3 columns",
      },
      {
        type: "short",
        topic: "Finance",
        question: "Simple interest on $500 at 4% p.a. for 3 years is:",
        acceptedAnswers: ["60", "$60", "60 dollars", "si=60"],
      },
      {
        type: "mcq",
        topic: "Statistics",
        question: "The range of a data set is:",
        options: [
          "Largest value minus smallest value",
          "The middle value",
          "The average value",
          "The most common value",
        ],
        answer: "Largest value minus smallest value",
      },
      {
        type: "mcq",
        topic: "Measurement",
        question: "The area of a rectangle 6 cm by 4 cm is:",
        options: ["10 cm\u00B2", "20 cm\u00B2", "24 cm\u00B2", "30 cm\u00B2"],
        answer: "24 cm\u00B2",
      },
      {
        type: "short",
        topic: "Networks",
        question: "What does an edge represent in a network?",
        acceptedAnswers: ["a connection", "connection", "link", "a link"],
      },
    ],
  },
  {
    id: "specialist-maths",
    name: "Specialist Mathematics",
    category: "Mathematics",
    description:
      "Complex numbers, vectors, mechanics, advanced calculus, probability distributions, and proof.",
    quiz: [
      {
        type: "mcq",
        topic: "Complex Numbers",
        question: "The modulus of the complex number 3 + 4i is:",
        options: ["3", "4", "5", "7"],
        answer: "5",
      },
      {
        type: "short",
        topic: "Calculus",
        question: "What is the derivative of sin(x)?",
        acceptedAnswers: ["cos(x)", "cos x"],
      },
      {
        type: "mcq",
        topic: "Vectors",
        question: "A vector quantity has:",
        options: [
          "Magnitude only",
          "Direction only",
          "Both magnitude and direction",
          "Neither magnitude nor direction",
        ],
        answer: "Both magnitude and direction",
      },
      {
        type: "long",
        topic: "Proof",
        question:
          "Prove by mathematical induction that the sum of the first n positive integers is n(n+1)/2.",
        guidance:
          "Clearly show the base case, inductive hypothesis, and inductive step.",
      },
    ],
  },
];
