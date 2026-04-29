export type QuestionType = "mcq" | "short" | "long";

export interface AnswerPart {
  key: string;
  label: string;
  type?: "text" | "number";
}

export interface BaseQuestion {
  type: QuestionType;
  topic: string;
  question: string;
  imageUrls?: string[];
  /** Images that belong to the solution / marking scheme (shown after answering). */
  answerImageUrls?: string[];
  marks?: number;
  guidance?: string;
  passage?: string;
  /** Same id = multi-part question: shown together with one shared stimulus (`passage`). */
  groupId?: string;
  /** Set for admin / DB-backed questions (stable practice keys). */
  id?: number;
  /** Explicit multipart answer schema (preferred over text parsing). */
  answerParts?: AnswerPart[];
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
  acceptedAnswers?: string[];
  answer?: string;
}

export type Question = McqQuestion | ShortQuestion | LongQuestion;

export interface Subject {
  id: string;
  name: string;
  category: string;
  description: string;
  /**
   * Built-in question bank. Intentionally empty so only real exam content
   * (Sheets / Admin / PDF imports) appears across the app.
   */
  quiz: Question[];
}

export const baseSubjects: Subject[] = [
  {
    id: "methods",
    name: "Mathematical Methods",
    category: "Mathematics",
    description:
      "Functions, calculus, probability, algebra, graphs, and mathematical modelling.",
    quiz: [],
  },
  {
    id: "general-maths",
    name: "General Mathematics",
    category: "Mathematics",
    description:
      "Statistics, finance, measurement, networks, and introductory algebra.",
    quiz: [],
  },
  {
    id: "specialist-maths",
    name: "Specialist Mathematics",
    category: "Mathematics",
    description:
      "Complex numbers, vectors, mechanics, advanced calculus, probability distributions, and proof.",
    quiz: [],
  },
  {
    id: "english",
    name: "English",
    category: "English",
    description:
      "Analysing texts, argument, language, and crafting written responses.",
    quiz: [],
  },
];

