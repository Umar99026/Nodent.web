import { parseAnswerKeyDocument } from "@/lib/createPdfAnswerImport";
import {
  answerSlotsFromQuestionIdTsv,
  looksLikeQuestionIdExamTsv,
} from "@/lib/examQuestionIdTsv";
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

function normHeaderCell(cell: string): string {
  return cell.replace(/\uFEFF/g, "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
}

type TsvDelimiter = "\t" | "," | ";" | "|";

function detectTsvDelimiter(line: string): TsvDelimiter {
  const counts: Array<[TsvDelimiter, number]> = [
    ["\t", (line.match(/\t/g) ?? []).length],
    [",", (line.match(/,/g) ?? []).length],
    [";", (line.match(/;/g) ?? []).length],
    ["|", (line.match(/\|/g) ?? []).length],
  ];
  const best = counts.reduce((a, b) => (b[1] > a[1] ? b : a));
  return best[1] > 0 ? best[0] : "\t";
}

function splitDelimitedLine(line: string, delimiter: TsvDelimiter): string[] {
  if (delimiter === "\t") {
    return line.split("\t").map((cell) => cell.trim());
  }
  if (delimiter === ",") {
    return parseCsvLine(line);
  }
  return line.split(delimiter).map((cell) => cell.trim().replace(/^"|"$/g, ""));
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  cells.push(current.trim());
  return cells;
}

function detectDelimiterFromLines(lines: string[]): TsvDelimiter {
  let tabLines = 0;
  let commaLines = 0;
  for (const line of lines.slice(0, 25)) {
    if ((line.match(/\t/g) ?? []).length >= 4) tabLines++;
    if ((line.match(/,/g) ?? []).length >= 4) commaLines++;
  }
  if (tabLines > 0) return "\t";
  if (commaLines > 0) return ",";
  return detectTsvDelimiter(lines[0] ?? "");
}

function isKnownExamImportHeaderLine(line: string): boolean {
  const norm = line.toLowerCase().replace(/[^a-z0-9_\s]/g, " ");
  return (
    norm.includes("question") &&
    (norm.includes("answer") || norm.includes("question text") || norm.includes("questiontext"))
  );
}

function parseLooseExamImportLine(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed || isKnownExamImportHeaderLine(trimmed)) return null;

  const head = trimmed.match(/^(\d+)\s+(stem|[a-z]{1,3}|mcq)\.?\s+/i);
  if (!head) return null;

  const question = head[1]!;
  const part = head[2]!.toLowerCase();
  let rest = trimmed.slice(head[0].length).trim();

  let marks = "";
  const marksMatch = rest.match(/\s+(\d+)\s*$/);
  if (marksMatch) {
    marks = marksMatch[1]!;
    rest = rest.slice(0, -marksMatch[0].length).trim();
  }

  let answer = "";
  if (part !== "stem" && rest) {
    const answerMatch = rest.match(/\s+(\S+)\s*$/);
    if (answerMatch) {
      answer = answerMatch[1]!;
      rest = rest.slice(0, -answerMatch[0].length).trim();
    }
  }

  return [question, part, rest, answer, marks];
}

function normalizeHeaderTokens(line: string): string {
  const lower = line.toLowerCase().trim();
  const tokens = lower.split(/\s+/);
  const out: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i] ?? "";
    if (token === "question" && tokens[i + 1] === "text") {
      out.push("question_text");
      i++;
      continue;
    }
    out.push(token);
  }
  return out.join("\t");
}

function coerceLinesToTabSeparated(lines: string[]): string[] | null {
  if (lines.some((line) => line.includes("\t"))) return null;

  const parsed = lines
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return null;
      if (isKnownExamImportHeaderLine(trimmed)) {
        return normalizeHeaderTokens(trimmed);
      }
      return parseLooseExamImportLine(trimmed)?.join("\t") ?? null;
    })
    .filter((line): line is string => Boolean(line));

  if (parsed.length < 2) return null;
  return parsed;
}

function normalizeTsvInput(text: string): { lines: string[]; delimiter: TsvDelimiter } {
  const normalized = text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\uFEFF/g, "");
  let lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (!lines.length) return { lines: [], delimiter: "\t" };

  const coerced = coerceLinesToTabSeparated(lines);
  if (coerced) {
    lines = coerced;
  }

  let delimiter = detectDelimiterFromLines(lines);
  if (delimiter === "\t" && !lines[0]!.includes("\t")) {
    for (const line of lines.slice(0, 10)) {
      const candidate = detectTsvDelimiter(line);
      if (candidate !== "\t" && splitDelimitedLine(line, candidate).length >= 2) {
        delimiter = candidate;
        break;
      }
    }
  }

  const firstSplit = splitDelimitedLine(lines[0]!, delimiter);
  if (firstSplit.length < 2 && lines.some((line) => /\s{2,}/.test(line))) {
    lines = lines.map((line) =>
      line
        .split(/\s{2,}/)
        .map((cell) => cell.trim())
        .join("\t"),
    );
    delimiter = "\t";
  }

  return { lines, delimiter };
}

const TSV_HEADER_ALIASES: Record<string, string[]> = {
  question: ["question", "q", "qn", "qnum", "num", "no", "questionnum", "questionnumber"],
  part: ["part", "sub", "subpart", "letter"],
  key: ["key", "slot", "id"],
  label: ["label", "descriptor", "name", "box", "prompt", "partlabel"],
  question_text: [
    "questiontext",
    "questiontextcolumn",
    "stem",
    "wording",
    "body",
    "content",
    "parttext",
    "prompttext",
    "stemtext",
    "description",
    "text",
  ],
  answer: ["answer", "accepted", "acceptedanswer", "solution", "value", "resp"],
  marks: ["marks", "mark", "m", "pts", "points"],
  option_a: ["option_a", "opt_a", "optiona"],
  option_b: ["option_b", "opt_b", "optionb"],
  option_c: ["option_c", "opt_c", "optionc"],
  option_d: ["option_d", "opt_d", "optiond"],
};

const STEM_PART_KEYS = new Set(["stem", "intro", "question", "stimulus", "passage"]);

function mapTsvHeader(cells: string[]): Map<string, number> | null {
  const idx = new Map<string, number>();
  let matched = 0;
  for (let i = 0; i < cells.length; i++) {
    const norm = normHeaderCell(cells[i] ?? "");
    if (!norm) continue;
    let bestField: string | null = null;
    let bestLen = 0;
    for (const [field, aliases] of Object.entries(TSV_HEADER_ALIASES)) {
      for (const alias of aliases) {
        if (norm === alias && alias.length > bestLen) {
          bestField = field;
          bestLen = alias.length;
        }
      }
    }
    if (bestField) {
      if (bestField === "question" && idx.has("question") && i > 0) {
        if (!idx.has("question_text")) {
          idx.set("question_text", i);
          matched++;
        }
        continue;
      }
      idx.set(bestField, i);
      matched++;
    }
  }
  if (matched < 2) return null;
  if (!idx.has("question") && !idx.has("key")) return null;
  if (!idx.has("answer") && !idx.has("label") && !idx.has("question_text")) return null;
  return idx;
}

function defaultTsvColumnMap(colCount: number): Map<string, number> | null {
  if (colCount >= 5) {
    return new Map([
      ["question", 0],
      ["part", 1],
      ["question_text", 2],
      ["answer", 3],
      ["marks", 4],
    ]);
  }
  if (colCount === 4) {
    return new Map([
      ["question", 0],
      ["part", 1],
      ["answer", 2],
      ["marks", 3],
    ]);
  }
  if (colCount === 3) {
    return new Map([
      ["question", 0],
      ["answer", 1],
      ["marks", 2],
    ]);
  }
  return null;
}

function isLikelyHeaderRow(cells: string[]): boolean {
  if (/^\d+$/.test((cells[0] ?? "").trim())) return false;
  return mapTsvHeader(cells) != null;
}

function parseQuestionNumberFromRow(
  get: (field: string) => string,
  cells: string[],
): number | null {
  const keyRaw = get("key");
  if (keyRaw) {
    const parsed = parseSlotKeyToken(keyRaw);
    if (parsed) return parsed.question;
  }

  const qRaw = get("question");
  if (qRaw && /^\d+$/.test(qRaw.trim())) {
    return Number(qRaw);
  }

  const first = (cells[0] ?? "").trim();
  if (/^\d+$/.test(first)) {
    return Number(first);
  }

  return null;
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
  const text = input.label?.trim() || input.questionStem?.trim() || "";
  if (!answer && !text) return null;
  if (!Number.isFinite(input.question) || input.question < 1) return null;
  const part = (input.part || "a").trim().toLowerCase() || "a";
  const marksRaw = Number(input.marks ?? (answer ? 1 : 0));
  const marks = Number.isFinite(marksRaw) ? Math.max(0, Math.round(marksRaw)) : answer ? 1 : 0;
  const descriptor = text || slotDescriptor(input.question, part);
  return {
    key: slotKeyFor(input.question, part),
    descriptor,
    acceptedAnswer: answer,
    marks: marks || (answer ? 1 : 0),
    ...(text && part === "mcq" ? { questionStem: text } : {}),
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
  const qRaw = get("question");
  let label = get("question_text") || get("label") || undefined;
  if (!label?.trim() && qRaw && !/^\d+$/.test(qRaw.trim())) {
    label = qRaw;
  }
  if (!answer && !label?.trim()) return null;

  const keyRaw = get("key");
  const hasPartCol = header.has("part");
  const partRaw = hasPartCol ? get("part").toLowerCase().replace(/\.$/, "") : "";
  let part = partRaw;

  const question = parseQuestionNumberFromRow(get, cells);
  if (question == null || !Number.isFinite(question) || question < 1) return null;

  if (keyRaw) {
    const parsed = parseSlotKeyToken(keyRaw);
    if (parsed) part = parsed.part || part;
  }

  return {
    question: question!,
    part,
    answer,
    label,
    marks: Number(get("marks") || (answer ? 1 : 0)),
    questionStem: label,
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
function parseTsvDataLines(
  lines: string[],
  delimiter: TsvDelimiter,
): Array<Omit<Parameters<typeof slotFromFields>[0], "part"> & { part: string }> {
  const splitLine = (line: string) => splitDelimitedLine(line, delimiter);
  const looksTabular = lines.some((line) => splitLine(line).length >= 2);
  if (!looksTabular) return [];

  const firstCells = splitLine(lines[0]!);
  const headerDetected = isLikelyHeaderRow(firstCells);
  let header = headerDetected ? mapTsvHeader(firstCells) : null;
  let dataLines = headerDetected
    ? lines.slice(1).map(splitLine)
    : lines.map(splitLine);
  dataLines = dataLines.filter((cells) => cells.length >= 2);

  const parseRows = (
    rowsHeader: Map<string, number> | null,
    rowsData: string[][],
  ) => {
    const parsed: Array<Omit<Parameters<typeof slotFromFields>[0], "part"> & { part: string }> =
      [];
    for (const cells of rowsData) {
      const row = rowsHeader
        ? rowToAnswerSlot(cells, rowsHeader)
        : rowToAnswerSlotHeuristic(cells);
      if (row) parsed.push(row);
    }
    return parsed;
  };

  let rows = parseRows(header, dataLines);
  if (rows.length) return rows;

  if (header) {
    rows = parseRows(null, dataLines);
    if (rows.length) return rows;

    const fallbackHeader = defaultTsvColumnMap(
      dataLines[0]?.length ?? firstCells.length,
    );
    if (fallbackHeader) {
      rows = parseRows(fallbackHeader, dataLines);
      if (rows.length) return rows;
    }
  }

  const fallbackHeader = defaultTsvColumnMap(firstCells.length);
  if (fallbackHeader && /^\d+$/.test((firstCells[0] ?? "").trim())) {
    rows = parseRows(fallbackHeader, lines.map(splitLine).filter((c) => c.length >= 2));
  }
  return rows;
}

/** Parse tab-separated answer rows for practice exam slot placement. */
export function answerSlotsFromSolutionTsv(text: string): AnswerSlotSource[] {
  if (looksLikeQuestionIdExamTsv(text)) {
    const idSlots = answerSlotsFromQuestionIdTsv(text);
    if (idSlots.length) return idSlots;
  }

  const { lines, delimiter } = normalizeTsvInput(text);
  if (!lines.length) return [];

  let rows = parseTsvDataLines(lines, delimiter);
  if (!rows.length) {
    const firstCells = splitDelimitedLine(lines[0]!, delimiter);
    const fallbackHeader = defaultTsvColumnMap(firstCells.length);
    const dataStart = isLikelyHeaderRow(firstCells) ? 1 : 0;
    if (fallbackHeader) {
      rows = [];
      for (const cells of lines
        .slice(dataStart)
        .map((line) => splitDelimitedLine(line, delimiter))
        .filter((cells) => cells.length >= 2)) {
        const row = rowToAnswerSlot(cells, fallbackHeader);
        if (row) rows.push(row);
      }
    }
  }

  return rowsToAnswerSlots(rows);
}

export type ExamImportTsvDiagnostics = {
  ok: boolean;
  slotCount: number;
  lineCount: number;
  hasTabs: boolean;
  hint?: string;
};

/** Explain why exam-import TSV parsing failed (for admin UI). */
export function getExamImportTsvDiagnostics(text: string): ExamImportTsvDiagnostics {
  const trimmed = text.trim();
  if (!trimmed) {
    return { ok: false, slotCount: 0, lineCount: 0, hasTabs: false, hint: "Paste TSV text first." };
  }

  const { lines } = normalizeTsvInput(trimmed);
  const hasTabs = trimmed.includes("\t");
  const slotCount = answerSlotsFromSolutionTsv(trimmed).length;

  if (slotCount > 0) {
    return { ok: true, slotCount, lineCount: lines.length, hasTabs };
  }

  if (looksLikeQuestionIdExamTsv(trimmed)) {
    return {
      ok: false,
      slotCount: 0,
      lineCount: lines.length,
      hasTabs: trimmed.includes("\t"),
      hint: "Question_ID format detected but no rows parsed. Check IDs like A1a or B_M1_Q2b.",
    };
  }

  let hint = "Use tab-separated columns: question, part, question_text, answer, marks — or Question_ID, Question, Answer.";
  if (!hasTabs) {
    hint =
      "No tab characters found. Copy from Excel/Google Sheets, or click Insert template. Spaces between columns are not supported for long question text.";
  } else if (lines.length < 2) {
    hint = "Add a header row plus at least one data row.";
  } else if (!isKnownExamImportHeaderLine(lines[0] ?? "")) {
    hint = "First row should be: question, part, question_text, answer, marks";
  }

  return { ok: false, slotCount: 0, lineCount: lines.length, hasTabs, hint };
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

  const splitTsvLine = (line: string) => line.split("\t").map((cell) => cell.trim());

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
