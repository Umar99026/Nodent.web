import type { Question } from "@/lib/subjects";

/** One mark-scheme step — what the student must show to earn that mark. */
export type MarkBreakdownStep = {
  marks: number;
  label: string;
  /** Model working / criterion the marker expects for this step. */
  model?: string;
};

export type MarkBreakdown = {
  steps: MarkBreakdownStep[];
  source?: "manual" | "ai" | "exam-guide" | "inferred";
};

export type MarkStepResult = {
  index: number;
  marks: number;
  marksAwarded: number;
  label: string;
  model?: string;
  studentText?: string;
  awarded: boolean;
  feedback?: string;
};

const STORAGE_KEY = "nodent_breakdown_mode";

export function readBreakdownModePreference(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function writeBreakdownModePreference(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {
    /* ignore */
  }
}

export function parseMarkBreakdown(raw: unknown): MarkBreakdown | null {
  if (!raw) return null;
  let data: unknown = raw;
  if (typeof raw === "string") {
    const t = raw.trim();
    if (!t) return null;
    try {
      data = JSON.parse(t);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object") return null;
  const row = data as Record<string, unknown>;
  const stepsRaw = Array.isArray(row.steps) ? row.steps : Array.isArray(data) ? data : [];
  const steps: MarkBreakdownStep[] = stepsRaw
    .map((step) => {
      const s = step as Record<string, unknown>;
      const label = String(s.label ?? s.criterion ?? s.description ?? "").trim();
      if (!label) return null;
      const marksParsed = Number(s.marks ?? 1);
      const marks = Number.isFinite(marksParsed) ? Math.max(1, Math.round(marksParsed)) : 1;
      const model = String(s.model ?? s.expected ?? s.modelAnswer ?? "").trim() || undefined;
      return { marks, label, model };
    })
    .filter(Boolean) as MarkBreakdownStep[];
  if (!steps.length) return null;
  const source = String(row.source ?? "").trim() as MarkBreakdown["source"];
  return {
    steps,
    source: source || undefined,
  };
}

/** Fallback steps when no rubric is stored — one line per mark. */
export function inferMarkBreakdown(question: Pick<Question, "marks" | "guidance" | "type">): MarkBreakdown {
  const total = Math.max(1, Math.round(Number(question.marks ?? 1) || 1));
  const guidance = String(question.guidance ?? "").trim();
  if (guidance) {
    const lines = guidance
      .split(/\n+|(?:\s*•\s*)|(?:\s*;\s*)/)
      .map((l) => l.replace(/^[-–]\s*/, "").trim())
      .filter((l) => l.length > 4);
    if (lines.length >= total) {
      return {
        source: "inferred",
        steps: lines.slice(0, total).map((label, idx) => ({
          marks: 1,
          label: label.length > 120 ? `${label.slice(0, 117)}…` : label,
        })),
      };
    }
  }
  return {
    source: "inferred",
    steps: Array.from({ length: total }, (_, idx) => ({
      marks: 1,
      label:
        total === 1
          ? "Show complete working and state the final answer."
          : idx === total - 1
            ? "State the final answer clearly."
            : idx === 0
              ? "Set up the problem — state given information or key equations."
              : `Working step ${idx + 1} — show the method for this mark.`,
    })),
  };
}

export function resolveMarkBreakdown(question: Question): MarkBreakdown {
  const stored = parseMarkBreakdown((question as { markBreakdown?: unknown }).markBreakdown);
  if (stored?.steps.length) return stored;
  return inferMarkBreakdown(question);
}

export function breakdownStepCount(breakdown: MarkBreakdown): number {
  return breakdown.steps.length;
}

export function breakdownTotalMarks(breakdown: MarkBreakdown): number {
  return breakdown.steps.reduce((sum, s) => sum + s.marks, 0);
}

export function emptyStepAnswers(count: number): string[] {
  return Array.from({ length: count }, () => "");
}
