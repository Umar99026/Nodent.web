export type EnglishCriterionKey = "structure" | "evidence" | "expression" | "relevance";

export type EnglishCriterionScore = {
  score: number;
  feedback: string;
};

export type EnglishHighlight = {
  quote: string;
  type: "strength" | "improvement";
  criterion?: EnglishCriterionKey;
  feedback: string;
};

export type EnglishEssayResponse = {
  id: number;
  promptId: number | null;
  customPrompt: string | null;
  prompt: string;
  userId: number;
  username: string;
  responseType: "essay" | "paragraph";
  responseText: string;
  imageUrls: string[];
  updatedAt: string;
  aiScore: number | null;
  aiFeedback: string | null;
  aiCriteria: Partial<Record<EnglishCriterionKey, EnglishCriterionScore>> | null;
  aiHighlights: EnglishHighlight[];
  aiScoredAt: string | null;
  aiScoringStatus?: "pending" | "complete" | "failed" | null;
  aiScoringError?: string | null;
  aiScoringStartedAt?: string | null;
  isPublic?: boolean;
};

export const ENGLISH_CRITERION_LABELS: Record<EnglishCriterionKey, string> = {
  structure: "Structure",
  evidence: "Evidence & analysis",
  expression: "Expression",
  relevance: "Relevance",
};
