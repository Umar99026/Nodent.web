export type QuestionType = "mcq" | "short" | "long";

export interface AnswerPart {
  key: string;
  label: string;
  type?: "text" | "number";
  /** Grey hint shown in the answer input (PDF import / admin). */
  placeholder?: string;
  /** Figure shown above this part's answer input (PDF import). */
  imageUrl?: string;
  /** Marks for this subpart (PDF import / multipart). */
  marks?: number;
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
  /** When set, overrides auto-detection for smart (AI) marking on written questions. */
  useAiMarking?: boolean;
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

/** Local sandbox — admin-only subject. */
export const demoSubject: Subject = {
  id: "demo",
  name: "Demo",
  category: "Mathematics",
  description: "Local-only sandbox subject (blank by default).",
  quiz: [],
};

export const coreSubjects: Subject[] = [
  {
    id: "methods",
    name: "Mathematical Methods",
    category: "Mathematics",
    description:
      "Functions, calculus, probability, and exam-style reasoning — topic practice with instant feedback.",
    quiz: [],
  },
  {
    id: "general-maths",
    name: "General Mathematics",
    category: "Mathematics",
    description:
      "Data, finance, matrices, and networks — applied modelling and interpretation skills.",
    quiz: [],
  },
  {
    id: "specialist-maths",
    name: "Specialist Mathematics",
    category: "Mathematics",
    description:
      "Proof, complex numbers, vectors, and advanced calculus — built for high-band problem solving.",
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

/** Subjects shown in the app (excludes admin-only subjects). */
export const baseSubjects: Subject[] = coreSubjects;

export function subjectsForUser(opts: { isAdmin?: boolean }): Subject[] {
  const isAdmin = !!opts.isAdmin;
  if (!isAdmin) return coreSubjects;
  if (coreSubjects.some((s) => s.id === demoSubject.id)) return coreSubjects;
  return [...coreSubjects, demoSubject];
}

