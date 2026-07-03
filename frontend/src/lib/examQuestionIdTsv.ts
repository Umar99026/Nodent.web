import type { AnswerSlotSource } from "@/lib/answerSlotOverlays";

/** VCAA-style module sizes for 2019 FURMATH NHT Exam 2 (Section A = 8, then M1–M4). */
const DEFAULT_MODULE_SIZES = [4, 3, 3, 4];

export type ParsedExamQuestionId = {
  globalQuestion: number;
  part: string;
  examSection?: string;
  examLocalNumber?: number;
};

export function parseExamQuestionId(rawId: string): ParsedExamQuestionId | null {
  const id = rawId.trim();
  if (!id) return null;

  const moduleMatch = id.match(/^B_M(\d+)_Q(\d+)([a-z]*)$/i);
  if (moduleMatch) {
    const moduleNum = Number(moduleMatch[1]);
    const localQ = Number(moduleMatch[2]);
    const part = (moduleMatch[3] || "a").toLowerCase();
    if (!Number.isFinite(moduleNum) || !Number.isFinite(localQ) || moduleNum < 1 || localQ < 1) {
      return null;
    }
    const globalQuestion =
      8 +
      DEFAULT_MODULE_SIZES.slice(0, moduleNum - 1).reduce((sum, n) => sum + n, 0) +
      localQ;
    return {
      globalQuestion,
      part,
      examSection: `Module ${moduleNum}`,
      examLocalNumber: localQ,
    };
  }

  const sectionMatch = id.match(/^A(\d+)([a-z]*)$/i);
  if (sectionMatch) {
    const localQ = Number(sectionMatch[1]);
    const part = (sectionMatch[2] || "a").toLowerCase();
    if (!Number.isFinite(localQ) || localQ < 1) return null;
    return {
      globalQuestion: localQ,
      part,
      examSection: "Section A",
      examLocalNumber: localQ,
    };
  }

  return null;
}

function normHeader(cell: string): string {
  return cell.replace(/\uFEFF/g, "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

function splitLine(line: string): string[] {
  if (line.includes("\t")) return line.split("\t").map((c) => c.trim());
  if ((line.match(/,/g) ?? []).length >= 2) {
    return line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
  }
  return line.split("\t").map((c) => c.trim());
}

function isQuestionIdExamHeader(cells: string[]): boolean {
  const norms = cells.map(normHeader);
  const hasId = norms.some((n) =>
    ["questionid", "id", "qid", "slot", "key"].includes(n),
  );
  const hasQuestion = norms.some((n) => n === "question" || n === "wording" || n === "prompt");
  const hasAnswer = norms.some((n) =>
    ["answer", "accepted", "solution", "response"].includes(n),
  );
  return hasId && hasQuestion && hasAnswer;
}

function columnIndex(cells: string[], names: string[]): number {
  const norms = cells.map(normHeader);
  for (const name of names) {
    const i = norms.indexOf(name);
    if (i >= 0) return i;
  }
  return -1;
}

function slotKeyFor(question: number, part: string): string {
  return `q${question}-${part.toLowerCase()}`;
}

/** Parse Question_ID / Question / Answer exam TSV (e.g. A1a, B_M1_Q2b). */
export function answerSlotsFromQuestionIdTsv(text: string): AnswerSlotSource[] {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\uFEFF/g, "");
  const lines = normalized
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length < 2) return [];

  const headerCells = splitLine(lines[0]!);
  if (!isQuestionIdExamHeader(headerCells)) return [];

  const idCol = columnIndex(headerCells, ["questionid", "id", "qid", "slot", "key"]);
  const questionCol = columnIndex(headerCells, ["question", "wording", "prompt", "text"]);
  const answerCol = columnIndex(headerCells, ["answer", "accepted", "solution", "response"]);
  if (idCol < 0 || questionCol < 0 || answerCol < 0) return [];

  const slots: AnswerSlotSource[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitLine(line);
    const idRaw = cells[idCol] ?? "";
    const parsed = parseExamQuestionId(idRaw);
    if (!parsed) continue;

    const wording = (cells[questionCol] ?? "").trim();
    const answer = (cells[answerCol] ?? "").trim();
    if (!wording && !answer) continue;

    slots.push({
      key: slotKeyFor(parsed.globalQuestion, parsed.part),
      descriptor: wording || `Q${parsed.globalQuestion} ${parsed.part})`,
      acceptedAnswer: answer,
      marks: answer ? 1 : 0,
      examSection: parsed.examSection,
      examLocalNumber: parsed.examLocalNumber,
    });
  }

  return slots;
}

export function looksLikeQuestionIdExamTsv(text: string): boolean {
  const line = text
    .replace(/\uFEFF/g, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find(Boolean);
  if (!line) return false;
  return isQuestionIdExamHeader(splitLine(line));
}
