export type PracticeExamPage = {
  pageNumber: number;
  imageDataUrl: string;
};

/** How students answer: overlays on PDF, or MCQ buttons on paper + written overlays. */
export type PracticeExamLayout = "written" | "mcq_then_written";

export const MCQ_OPTION_LETTERS = ["A", "B", "C", "D"] as const;
export type McqOptionLetter = (typeof MCQ_OPTION_LETTERS)[number];

export type McqOptionOverlays = Partial<
  Record<
    McqOptionLetter,
    {
      overlayX: number;
      overlayY: number;
      overlayW: number;
      overlayH: number;
    }
  >
>;

export type PracticeExamMcqItem = {
  id: string;
  questionNumber: number;
  /** Question stem (extracted from PDF or pasted TSV). */
  question?: string;
  /** Four option texts A–D. */
  options?: string[];
  /** PDF page used for stimulus crop. */
  pageNumber?: number;
  /** Cropped exam figure shown above the stem when showStimulus is true. */
  stimulusImageUrl?: string;
  /** Normalised 0–1 crop rect on the source page image. */
  stimulusCrop?: { x: number; y: number; w: number; h: number };
  /** When false, students only see the stem and option cards (no figure). */
  showStimulus?: boolean;
  optionOverlays?: McqOptionOverlays;
  /** Normalised group box used to lay out / resize A–D together (% of page). */
  mcqGroupBounds?: {
    overlayX: number;
    overlayY: number;
    overlayW: number;
    overlayH: number;
  };
  /** When true, each letter is placed and dragged individually (for image-heavy options). */
  mcqButtonsSeparated?: boolean;
  /** How A–D are arranged inside the group box. */
  mcqGroupLayout?: "row" | "column";
  /** Preferred button diameter (% of page) for this question. */
  mcqButtonSizePct?: number;
  /** Correct option letter A–D. */
  acceptedAnswer: string;
  marks?: number;
};

export type PracticeExamSlot = {
  id: string;
  pageNumber: number;
  key: string;
  label?: string;
  acceptedAnswer: string;
  marks?: number;
  overlayX: number;
  overlayY: number;
  overlayW: number;
  overlayH: number;
  /** When true, the student input box has no fill on the exam paper. */
  transparentInput?: boolean;
};

export type PracticeExamMeta = {
  subjectId: string;
  year: number;
  examNumber: 1 | 2;
  published: boolean;
  layout: PracticeExamLayout;
  /** Questions 1…mcqCount use the MCQ answer sheet (Exam 2 Methods = 20). */
  mcqCount: number;
  mcqItems: PracticeExamMcqItem[];
  slots: PracticeExamSlot[];
  pages: { pageNumber: number }[];
};

export type PracticeExamListItem = {
  year: number;
  examNumber: 1 | 2;
  published: boolean;
  hasPages: boolean;
};

/** PDF render settings for imported exam pages (high res for readable text). */
export const EXAM_PDF_RENDER = {
  maxWidth: 2800,
  maxScale: 3,
  quality: 0.94,
} as const;
