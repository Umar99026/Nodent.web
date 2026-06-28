import { parseAnswerKeyDocument } from "@/lib/createPdfAnswerImport";
import { openPdfDocument, renderPageToDataUrl, extractPageText } from "@/lib/pdfQuestionImport";
import { normalizeQuestionMathText } from "@/lib/questionMathText";
import type { AnswerSlotSource } from "@/lib/answerSlotOverlays";
import { EXAM_PDF_RENDER, type PracticeExamMcqItem, type PracticeExamPage } from "@/lib/practiceExamTypes";

export async function extractFullPdfText(file: File): Promise<string> {
  const doc = await openPdfDocument(file);
  const chunks: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const text = await extractPageText(page);
    if (text.trim()) chunks.push(text);
  }
  return chunks.join("\n\n");
}

/** Quick render for image-only solution PDFs (in-browser reference only, not saved). */
export async function loadSolutionReferencePages(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<PracticeExamPage[]> {
  const doc = await openPdfDocument(file);
  const pages: PracticeExamPage[] = [];
  const total = doc.numPages;
  for (let i = 1; i <= total; i++) {
    onProgress?.(i - 1, total);
    const page = await doc.getPage(i);
    const imageDataUrl = await renderPageToDataUrl(page, {
      maxWidth: 900,
      maxScale: 1.25,
      quality: 0.72,
    });
    pages.push({ pageNumber: i, imageDataUrl });
  }
  onProgress?.(total, total);
  return pages;
}

export function isImageOnlySolutionText(text: string, pageCount: number): boolean {
  const meaningful = text.replace(/[^\w$%./=+\-]/g, "").length;
  if (pageCount <= 1) return meaningful < 80;
  const perPage = meaningful / Math.max(1, pageCount);
  return meaningful < 400 || perPage < 80;
}

export function applySolutionTextToPalette(text: string): AnswerSlotSource[] {
  const tsv = answerSlotsFromSolutionTsv(text);
  if (tsv.length) return tsv;
  return answerSlotsFromSolutionText(text);
}

function splitTsvLine(line: string): string[] {
  return line.split("\t").map((cell) => cell.trim());
}

const TSV_HEADER_ALIASES: Record<string, string[]> = {
  question: ["question", "q", "qn", "qnum", "num"],
  part: ["part", "sub", "subpart", "letter"],
  key: ["key", "slot", "id"],
  label: ["label", "descriptor", "name", "box", "stem", "questiontext", "prompt"],
  answer: ["answer", "accepted", "acceptedanswer", "solution", "value", "resp"],
  marks: ["marks", "mark", "m", "pts", "points"],
  option_a: ["option_a", "opt_a", "optiona"],
  option_b: ["option_b", "opt_b", "optionb"],
  option_c: ["option_c", "opt_c", "optionc"],
  option_d: ["option_d", "opt_d", "optiond"],
};

function mapTsvHeader(cells: string[]): Map<string, number> | null {
  const idx = new Map<string, number>();
  let matched = 0;
  for (let i = 0; i < cells.length; i++) {
    const norm = cells[i]!.toLowerCase().replace(/[^a-z]/g, "");
    for (const [field, aliases] of Object.entries(TSV_HEADER_ALIASES)) {
      if (aliases.includes(norm)) {
        idx.set(field, i);
        matched++;
        break;
      }
    }
  }
  if (!idx.has("answer") || matched < 2) return null;
  return idx;
}

function parseSlotKeyToken(token: string): { question: number; part: string } | null {
  const raw = token.trim();
  if (!raw) return null;
  let match = raw.match(/^q?\s*(\d+)\s*[-_.]?\s*(mcq|[a-z])$/i);
  if (match) {
    return { question: Number(match[1]), part: String(match[2]).toLowerCase() };
  }
  match = raw.match(/^(\d+)\s*([a-z]+)$/i);
  if (match) {
    return { question: Number(match[1]), part: String(match[2]).toLowerCase() };
  }
  match = raw.match(/^(\d+)$/);
  if (match) {
    return { question: Number(match[1]), part: "a" };
  }
  return null;
}

function slotKeyFor(question: number, part: string): string {
  const p = part.toLowerCase();
  if (p === "mcq") return `q${question}-mcq`;
  return `q${question}-${p}`;
}

function slotDescriptor(question: number, part: string, label?: string): string {
  if (label?.trim()) return label.trim();
  if (part.toLowerCase() === "mcq") return `Question ${question} (MCQ)`;
  return `Q${question} ${part})`;
}

function slotFromFields(input: {
  question: number;
  part: string;
  answer: string;
  label?: string;
  marks?: number;
  questionStem?: string;
  mcqOptions?: string[];
}): AnswerSlotSource | null {
  const answer = input.answer.trim();
  if (!answer || !Number.isFinite(input.question) || input.question < 1) return null;
  const part = (input.part || "a").trim().toLowerCase() || "a";
  const marks = Math.max(1, Math.round(Number(input.marks ?? 1) || 1));
  const stem = input.questionStem?.trim() || input.label?.trim();
  return {
    key: slotKeyFor(input.question, part),
    descriptor: slotDescriptor(input.question, part, stem || input.label),
    acceptedAnswer: answer,
    marks,
    ...(stem && part === "mcq" ? { questionStem: stem } : {}),
    ...(input.mcqOptions?.length ? { mcqOptions: input.mcqOptions } : {}),
  };
}

function rowToAnswerSlot(
  cells: string[],
  header: Map<string, number>,
): Omit<Parameters<typeof slotFromFields>[0], "part"> & { part: string } | null {
  const get = (field: string) => {
    const i = header.get(field);
    return i == null ? "" : (cells[i] ?? "").trim();
  };
  const answer = get("answer");
  if (!answer) return null;

  const keyRaw = get("key");
  const qRaw = get("question");
  const hasPartCol = header.has("part");
  const partRaw = hasPartCol ? get("part").toLowerCase() : "";
  let question: number | null = null;
  let part = partRaw;

  if (keyRaw) {
    const parsed = parseSlotKeyToken(keyRaw);
    if (!parsed) return null;
    question = parsed.question;
    part = parsed.part || part;
  } else if (qRaw) {
    question = Number(qRaw);
    if (!Number.isFinite(question) || question < 1) return null;
  } else {
    return null;
  }

  return {
    question: question!,
    part,
    answer,
    label: get("label") || undefined,
    marks: Number(get("marks") || 1),
    questionStem: get("label") || undefined,
    mcqOptions: [get("option_a"), get("option_b"), get("option_c"), get("option_d")].filter(
      Boolean,
    ),
  };
}

function rowToAnswerSlotHeuristic(
  cells: string[],
): Omit<Parameters<typeof slotFromFields>[0], "part"> & { part: string } | null {
  if (cells.length < 2) return null;
  if (!cells.some(Boolean)) return null;

  if (/^\d+$/.test(cells[0] ?? "")) {
    const question = Number(cells[0]);
    if (cells.length === 2) {
      return { question, part: "", answer: cells[1] ?? "" };
    }
    if (cells.length === 3) {
      return {
        question,
        part: (cells[1] ?? "").toLowerCase(),
        answer: cells[2] ?? "",
      };
    }
    if (cells.length === 4) {
      return {
        question,
        part: (cells[1] ?? "").toLowerCase(),
        answer: cells[2] ?? "",
        marks: Number(cells[3] || 1),
      };
    }
    if (cells.length >= 5) {
      return {
        question,
        part: (cells[1] ?? "").toLowerCase(),
        answer: cells[3] ?? "",
        label: cells[2],
        marks: Number(cells[4] || 1),
      };
    }
  }

  const fromKey = parseSlotKeyToken(cells[0] ?? "");
  if (fromKey) {
    if (cells.length === 2) {
      return {
        question: fromKey.question,
        part: fromKey.part,
        answer: cells[1] ?? "",
      };
    }
    if (cells.length === 3) {
      const third = cells[2] ?? "";
      if (/^\d+$/.test(third)) {
        return {
          question: fromKey.question,
          part: fromKey.part,
          answer: cells[1] ?? "",
          marks: Number(third),
        };
      }
      return {
        question: fromKey.question,
        part: fromKey.part,
        answer: third,
        label: cells[1],
      };
    }
    return {
      question: fromKey.question,
      part: fromKey.part,
      answer: cells[2] ?? "",
      label: cells[1],
      marks: Number(cells[3] || 1),
    };
  }

  return null;
}

function nextAutoPart(question: number, counters: Map<number, number>): string {
  const n = counters.get(question) ?? 0;
  counters.set(question, n + 1);
  if (n < 26) return String.fromCharCode(97 + n);
  return `p${n + 1}`;
}

function rowsToAnswerSlots(
  rows: Array<Omit<Parameters<typeof slotFromFields>[0], "part"> & { part: string }>,
): AnswerSlotSource[] {
  const autoPart = new Map<number, number>();
  const slots: AnswerSlotSource[] = [];
  for (const row of rows) {
    const part = row.part.trim().toLowerCase() || nextAutoPart(row.question, autoPart);
    const slot = slotFromFields({ ...row, part });
    if (slot) slots.push(slot);
  }
  return slots;
}

/** Parse tab-separated answer rows for practice exam slot placement. */
export function answerSlotsFromSolutionTsv(text: string): AnswerSlotSource[] {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\uFEFF/g, "");
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const looksTabular = lines.some((line) => splitTsvLine(line).length >= 2);
  if (!looksTabular) return [];

  const firstCells = splitTsvLine(lines[0]!);

  const header = mapTsvHeader(firstCells);
  const dataLines = (header ? lines.slice(1) : lines)
    .map(splitTsvLine)
    .filter((cells) => cells.length >= 2);

  const rows: Array<Omit<Parameters<typeof slotFromFields>[0], "part"> & { part: string }> = [];
  for (const cells of dataLines) {
    const row = header ? rowToAnswerSlot(cells, header) : rowToAnswerSlotHeuristic(cells);
    if (row) rows.push(row);
  }
  return rowsToAnswerSlots(rows);
}

export function answerSlotsFromSolutionText(text: string): AnswerSlotSource[] {
  const map = parseAnswerKeyDocument(text);
  const slots: AnswerSlotSource[] = [];
  const sorted = [...map.entries()].sort((a, b) => a[0] - b[0]);

  for (const [qNum, q] of sorted) {
    if (q.mcqAnswer?.trim()) {
      slots.push({
        key: `q${qNum}-mcq`,
        descriptor: `Question ${qNum} (MCQ)`,
        acceptedAnswer: q.mcqAnswer.trim(),
        marks: 1,
      });
    }
    const parts = [...q.parts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (const part of parts) {
      const answer = part.answer?.trim();
      if (!answer) continue;
      const pk = part.key?.trim().toLowerCase() || "a";
      slots.push({
        key: `q${qNum}-${pk}`,
        descriptor: part.label?.trim() || `Q${qNum} ${pk})`,
        acceptedAnswer: answer,
        marks: 1,
      });
    }
  }
  return slots;
}

export async function loadExamPdfPages(
  file: File,
  onProgress?: (done: number, total: number) => void,
): Promise<PracticeExamPage[]> {
  const doc = await openPdfDocument(file);
  const pages: PracticeExamPage[] = [];
  const total = doc.numPages;

  for (let i = 1; i <= total; i++) {
    onProgress?.(i - 1, total);
    const page = await doc.getPage(i);
    const imageDataUrl = await renderPageToDataUrl(page, EXAM_PDF_RENDER);
    pages.push({
      pageNumber: i,
      imageDataUrl,
    });
  }
  onProgress?.(total, total);
  return pages;
}

export function unplacedPaletteSlots(
  palette: AnswerSlotSource[],
  placedKeys: Set<string>,
): AnswerSlotSource[] {
  return palette.filter((slot) => !placedKeys.has(slot.key.trim().toLowerCase()));
}

export function placedSlotKeys(slots: { key: string }[]): Set<string> {
  return new Set(slots.map((s) => s.key.trim().toLowerCase()).filter(Boolean));
}

/** `q1-a` → `1a`, `q2-mcq` → `2mcq` */
export function shortLabelFromSlotKey(key: string): string {
  const match = String(key ?? "")
    .trim()
    .match(/^q?(\d+)\s*[-_.]?\s*([a-z]+)$/i);
  if (!match) return key;
  return `${match[1]}${match[2]}`;
}

export function isMcqSlotKey(key: string): boolean {
  return /-mcq$/i.test(String(key ?? "").trim());
}

export function questionNumberFromSlotKey(key: string): number | null {
  const m = String(key ?? "")
    .trim()
    .match(/^q?(\d+)/i);
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Normalise solution key values like `B`, `4C`, `23 D` to a single letter. */
export function normalizeMcqLetter(raw: string): string {
  const t = String(raw ?? "").trim().toUpperCase();
  const m = t.match(/^(?:\d+\s*)?([A-D])$/);
  if (m?.[1]) return m[1];
  const lone = t.match(/^([A-D])$/);
  return lone?.[1] ?? t.slice(-1);
}

export function splitPaletteIntoMcqAndWritten(palette: AnswerSlotSource[]): {
  mcq: PracticeExamMcqItem[];
  written: AnswerSlotSource[];
} {
  const mcq: PracticeExamMcqItem[] = [];
  const written: AnswerSlotSource[] = [];
  for (const slot of palette) {
    if (isMcqSlotKey(slot.key)) {
      const questionNumber = questionNumberFromSlotKey(slot.key);
      if (!questionNumber) continue;
      mcq.push({
        id: crypto.randomUUID(),
        questionNumber,
        acceptedAnswer: normalizeMcqLetter(slot.acceptedAnswer),
        marks: slot.marks ?? 1,
        ...(slot.questionStem?.trim() ? { question: slot.questionStem.trim() } : {}),
        ...(slot.mcqOptions?.length === 4 ? { options: [...slot.mcqOptions] } : {}),
      });
    } else {
      written.push(slot);
    }
  }
  mcq.sort((a, b) => a.questionNumber - b.questionNumber);
  return { mcq, written };
}

export function buildMcqRows(
  mcqCount: number,
  items: PracticeExamMcqItem[],
): PracticeExamMcqItem[] {
  const byQuestion = new Map(items.map((item) => [item.questionNumber, item]));
  const rows: PracticeExamMcqItem[] = [];
  for (let q = 1; q <= mcqCount; q++) {
    rows.push(
      byQuestion.get(q) ?? {
        id: `mcq-q${q}`,
        questionNumber: q,
        acceptedAnswer: "",
        marks: 1,
      },
    );
  }
  return rows;
}

/** Merge freshly parsed MCQ rows into existing items (keeps crops / edits by question number). */
export function mergeMcqItems(
  existing: PracticeExamMcqItem[],
  incoming: PracticeExamMcqItem[],
): PracticeExamMcqItem[] {
  const byQ = new Map(existing.map((item) => [item.questionNumber, item]));
  for (const row of incoming) {
    const prev = byQ.get(row.questionNumber);
    byQ.set(row.questionNumber, {
      ...(prev ?? { id: row.id }),
      ...row,
      id: prev?.id ?? row.id,
      stimulusImageUrl: prev?.stimulusImageUrl ?? row.stimulusImageUrl,
      stimulusCrop: prev?.stimulusCrop ?? row.stimulusCrop,
      showStimulus: prev?.showStimulus ?? row.showStimulus,
      pageNumber: prev?.pageNumber ?? row.pageNumber,
      optionOverlays: prev?.optionOverlays ?? row.optionOverlays,
      mcqGroupBounds: prev?.mcqGroupBounds ?? row.mcqGroupBounds,
      mcqButtonsSeparated: prev?.mcqButtonsSeparated ?? row.mcqButtonsSeparated,
      mcqGroupLayout: prev?.mcqGroupLayout ?? row.mcqGroupLayout,
      mcqButtonSizePct: prev?.mcqButtonSizePct ?? row.mcqButtonSizePct,
      question: row.question?.trim() || prev?.question,
      options: row.options?.length === 4 ? row.options : prev?.options,
    });
  }
  return [...byQ.values()].sort((a, b) => a.questionNumber - b.questionNumber);
}

const MCQ_TSV_HEADER_ALIASES: Record<string, string[]> = {
  number: ["q", "qn", "num", "no", "questionnum", "questionnumber", "qnum"],
  stem: ["stem", "questiontext", "text", "prompt", "qtext", "question"],
  option_a: ["option_a", "opt_a", "optiona", "a"],
  option_b: ["option_b", "opt_b", "optionb", "b"],
  option_c: ["option_c", "opt_c", "optionc", "c"],
  option_d: ["option_d", "opt_d", "optiond", "d"],
  answer: ["answer", "correct", "key", "ans", "accepted", "acceptedanswer"],
  marks: ["marks", "mark", "m", "pts", "points"],
};

function mapMcqTsvHeader(cells: string[]): Map<string, number> | null {
  const idx = new Map<string, number>();
  let matched = 0;
  for (let i = 0; i < cells.length; i++) {
    const norm = cells[i]!.toLowerCase().replace(/[^a-z_]/g, "");
    for (const [field, aliases] of Object.entries(MCQ_TSV_HEADER_ALIASES)) {
      if (aliases.includes(norm)) {
        if (!idx.has(field)) {
          idx.set(field, i);
          matched++;
        }
        break;
      }
    }
  }
  if (!idx.has("answer") || matched < 3) return null;
  return idx;
}

function formatMcqOptionText(raw: string): string {
  return normalizeQuestionMathText(
    raw
      .replace(/^\[([A-D])\]\s*/i, "")
      .replace(/^([A-D])[.)]\s*/i, "")
      .trim(),
  );
}

function mcqItemFromCells(
  cells: string[],
  header: Map<string, number> | null,
): PracticeExamMcqItem | null {
  const get = (field: string) => {
    const i = header?.get(field);
    return i == null ? "" : (cells[i] ?? "").trim();
  };

  let questionNumber: number | null = null;
  let stem = "";
  let options: string[] = [];
  let answer = "";
  let marks = 1;

  if (header) {
    const numRaw = header.has("number") ? get("number") : "";
    if (numRaw && /^\d+$/.test(numRaw)) {
      questionNumber = Number(numRaw);
    } else if (/^\d+$/.test(cells[0] ?? "")) {
      questionNumber = Number(cells[0]);
    } else {
      return null;
    }

    const stemIdx = header.get("stem");
    if (stemIdx != null && stemIdx !== header.get("number")) {
      stem = cells[stemIdx] ?? "";
    } else if (!header.has("number") && header.has("stem") && header.get("stem") === 0) {
      stem = "";
    } else if (cells.length > 1 && !/^\d+$/.test(cells[1] ?? "")) {
      stem = cells[1] ?? "";
    } else {
      stem = get("stem");
    }

    options = [
      formatMcqOptionText(get("option_a")),
      formatMcqOptionText(get("option_b")),
      formatMcqOptionText(get("option_c")),
      formatMcqOptionText(get("option_d")),
    ];
    answer = get("answer");
    marks = Math.max(1, Math.round(Number(get("marks") || 1) || 1));
  } else if (cells.length >= 7 && /^\d+$/.test(cells[0] ?? "")) {
    questionNumber = Number(cells[0]);
    stem = cells[1] ?? "";
    options = cells.slice(2, 6).map(formatMcqOptionText);
    answer = cells[6] ?? "";
    if (cells[7]) marks = Math.max(1, Math.round(Number(cells[7]) || 1));
  } else {
    return null;
  }

  if (!questionNumber || questionNumber < 1 || !answer) return null;

  const normalizedStem = normalizeQuestionMathText(stem);
  const hasAllOptions = options.length === 4 && options.every((o) => o.trim());

  return {
    id: crypto.randomUUID(),
    questionNumber,
    question: normalizedStem,
    ...(hasAllOptions ? { options: options as [string, string, string, string] } : {}),
    acceptedAnswer: normalizeMcqLetter(answer),
    marks,
  };
}

/** Parse tab-separated MCQ rows (question text, four options, answer letter). */
export function parseMcqTsv(text: string): PracticeExamMcqItem[] {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\uFEFF/g, "");
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return [];

  const firstCells = splitTsvLine(lines[0]!);
  const header = mapMcqTsvHeader(firstCells);
  const dataLines = (header ? lines.slice(1) : lines)
    .map(splitTsvLine)
    .filter((cells) => cells.length >= 2);

  const items: PracticeExamMcqItem[] = [];
  for (const cells of dataLines) {
    const item = mcqItemFromCells(cells, header);
    if (item) items.push(item);
  }
  return items;
}

export function mergeParsedMcqTsv(
  existing: PracticeExamMcqItem[],
  parsed: PracticeExamMcqItem[],
): PracticeExamMcqItem[] {
  return mergeMcqItems(existing, parsed);
}
