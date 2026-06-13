import { stripMarksAnnotations } from "@/lib/questionDisplay";
import {
  extractPageText,
  openPdfDocument,
  renderPdfPagesToDataUrls,
} from "@/lib/pdfQuestionImport";
import { normalizeQuestionMathText } from "@/lib/questionMathText";

type PositionedItem = { str: string; x: number; y: number };

export type TablePartRow = {
  questionId: string;
  partKey: string;
  subjectId: string;
  type: "mcq" | "short_answer" | "long_answer";
  topic: string;
  marks: number;
  partLabel: string;
  placeholder: string;
  acceptedAnswer: string;
  question: string;
  passage: string;
  pdfPage: number;
};

export type TableParseResult = {
  rows: TablePartRow[];
  errors: string[];
};

export type TableGroupedDraft = {
  id: string;
  questionId: string;
  pageNumber: number;
  pageNumbers: number[];
  question: string;
  marks: number;
  topic: string;
  type: TablePartRow["type"];
  passage?: string;
  imageDataUrl: string;
  imageDataUrls: string[];
  parts: Array<{
    label: string;
    descriptor: string;
    placeholder: string;
    acceptedAnswer: string;
    marks: number;
    imageDataUrl?: string;
    pdfPage: number;
  }>;
};

const HEADER_ALIASES: Record<string, string> = {
  question_id: "question_id",
  questionid: "question_id",
  id: "question_id",
  part_key: "part_key",
  partkey: "part_key",
  part: "part_key",
  subject_id: "subject_id",
  subjectid: "subject_id",
  subject: "subject_id",
  type: "type",
  topic: "topic",
  marks: "marks",
  part_label: "part_label",
  partlabel: "part_label",
  label: "part_label",
  placeholder: "placeholder",
  unit: "placeholder",
  units: "placeholder",
  accepted_answer: "accepted_answer",
  acceptedanswer: "accepted_answer",
  answer: "accepted_answer",
  correct_answer: "accepted_answer",
  question: "question",
  stem: "question",
  passage: "passage",
  pdf_page: "pdf_page",
  pdfpage: "pdf_page",
  page: "pdf_page",
  page_number: "pdf_page",
};

function normHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "").replace(/-/g, "_");
}

function splitCols(line: string, sep: "\t" | "," | "|"): string[] {
  if (sep === "|") return line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((x) => x.trim());
  return line.split(sep).map((x) => x.trim());
}

function normalizeType(raw: string): TablePartRow["type"] | null {
  const t = raw.trim().toLowerCase();
  if (!t) return null;
  if (t === "mcq" || t === "multiple_choice") return "mcq";
  if (t === "short" || t === "short_answer") return "short_answer";
  if (t === "long" || t === "long_answer") return "long_answer";
  return null;
}

function cleanLabel(text: string): string {
  return stripMarksAnnotations(normalizeQuestionMathText(text.trim()));
}

export function parseStructuredQuestionTable(text: string): TableParseResult {
  const errors: string[] = [];
  let raw = text.replace(/\r\n/g, "\n").trim();
  if (!raw) return { rows: [], errors: ["Paste a table with a header row."] };

  const firstLine = raw.split("\n")[0] ?? "";
  if (!firstLine.includes("\t") && firstLine.toLowerCase().includes("question_id")) {
    raw = raw.replace(/ {2,}/g, "\t");
  }

  const lines = raw.split("\n").filter((l) => l.trim());
  if (lines.length < 2) {
    return { rows: [], errors: ["Need a header row and at least one data row."] };
  }

  const sep: "\t" | "," | "|" = lines[0]!.includes("\t")
    ? "\t"
    : lines[0]!.includes("|")
      ? "|"
      : ",";

  const header = splitCols(lines[0]!, sep).map(normHeader);
  const idx = (name: string) => {
    const want = HEADER_ALIASES[normHeader(name)] ?? normHeader(name);
    for (let i = 0; i < header.length; i++) {
      const mapped = HEADER_ALIASES[header[i]!] ?? header[i]!;
      if (mapped === want) return i;
    }
    return -1;
  };

  const required = ["question_id", "part_key", "marks", "part_label", "pdf_page"];
  const missing = required.filter((h) => idx(h) < 0);
  if (missing.length) {
    return {
      rows: [],
      errors: [`Missing columns: ${missing.join(", ")}. Found: ${header.join(", ")}`],
    };
  }

  const rows: TablePartRow[] = [];
  let prev: Partial<TablePartRow> | null = null;

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCols(lines[i]!, sep);
    const get = (h: string) => {
      const j = idx(h);
      return j >= 0 ? String(cols[j] ?? "").trim() : "";
    };

    const questionId = get("question_id") || prev?.questionId || "";
    const partKey = get("part_key") || prev?.partKey || "a";
    const pdfPageRaw = get("pdf_page");
    const pdfPage = Math.max(1, Math.round(Number(pdfPageRaw) || 0));
    const marksRaw = get("marks");
    const marks = Math.max(1, Math.round(Number(marksRaw) || 0));

    const rowErrors: string[] = [];
    if (!questionId) rowErrors.push("question_id is required");
    if (!partKey) rowErrors.push("part_key is required");
    if (!pdfPageRaw || !Number.isFinite(Number(pdfPageRaw))) {
      rowErrors.push("pdf_page must be a page number");
    }
    if (!marksRaw || !Number.isFinite(Number(marksRaw))) {
      rowErrors.push("marks is required");
    }
    const partLabel = cleanLabel(get("part_label"));
    if (!partLabel) rowErrors.push("part_label is required");

    const type =
      normalizeType(get("type")) ?? prev?.type ?? "short_answer";
    const topic = get("topic") || prev?.topic || "General";
    const question = cleanLabel(get("question")) || prev?.question || "";
    const passage = get("passage") || prev?.passage || "";

    if (rowErrors.length) {
      errors.push(`Row ${i + 1}: ${rowErrors.join("; ")}`);
      continue;
    }

    const row: TablePartRow = {
      questionId,
      partKey,
      subjectId: get("subject_id") || prev?.subjectId || "",
      type,
      topic,
      marks,
      partLabel,
      placeholder: get("placeholder") || "Type your answer…",
      acceptedAnswer: get("accepted_answer"),
      question,
      passage,
      pdfPage,
    };
    rows.push(row);
    prev = row;
  }

  return { rows, errors };
}

function groupTableRows(rows: TablePartRow[]): Map<string, TablePartRow[]> {
  const groups = new Map<string, TablePartRow[]>();
  for (const row of rows) {
    const list = groups.get(row.questionId) ?? [];
    list.push(row);
    groups.set(row.questionId, list);
  }
  return groups;
}

function buildQuestionStem(group: TablePartRow[], imagePrimary: boolean): string {
  const stem = group.find((r) => r.question.trim())?.question?.trim() ?? "";
  if (stem) return stem;
  if (group.length >= 2) {
    return group.map((r) => r.partLabel).join("\n");
  }
  return imagePrimary ? "See figure." : `Question ${group[0]!.questionId}`;
}

export function groupTableRowsToDrafts(
  rows: TablePartRow[],
  pageImages: Map<number, string>,
  imagePrimary: boolean,
): TableGroupedDraft[] {
  const groups = groupTableRows(rows);
  const drafts: TableGroupedDraft[] = [];

  for (const [questionId, parts] of groups) {
    const sorted = [...parts].sort((a, b) => a.partKey.localeCompare(b.partKey));
    const pageNumbers = [...new Set(sorted.map((p) => p.pdfPage))].sort((a, b) => a - b);
    const stemPage = sorted[0]!.pdfPage;
    const stemImage = pageImages.get(stemPage) ?? "";

    const sharedPages = new Set<number>([stemPage]);
    const partDrafts = sorted.map((p) => {
      const img = pageImages.get(p.pdfPage);
      const isPartOnly = p.pdfPage !== stemPage || sorted.length === 1;
      return {
        label: p.partKey,
        descriptor: p.partLabel,
        placeholder: p.placeholder,
        acceptedAnswer: p.acceptedAnswer,
        marks: p.marks,
        pdfPage: p.pdfPage,
        imageDataUrl: isPartOnly && img && p.pdfPage !== stemPage ? img : undefined,
      };
    });

    const imageDataUrls = [...sharedPages]
      .map((n) => pageImages.get(n))
      .filter((url): url is string => Boolean(url));

    const totalMarks = sorted.reduce((s, p) => s + p.marks, 0);

    drafts.push({
      id: questionId.replace(/[^\w.-]+/g, "_"),
      questionId,
      pageNumber: stemPage,
      pageNumbers,
      question: buildQuestionStem(sorted, imagePrimary),
      marks: totalMarks,
      topic: sorted[0]!.topic,
      type: sorted[0]!.type,
      passage: sorted[0]!.passage || undefined,
      imageDataUrl: stemImage || imageDataUrls[0] || "",
      imageDataUrls,
      parts:
        sorted.length >= 2
          ? partDrafts
          : [
              {
                label: sorted[0]!.partKey,
                descriptor: sorted[0]!.partLabel,
                placeholder: sorted[0]!.placeholder,
                acceptedAnswer: sorted[0]!.acceptedAnswer,
                marks: sorted[0]!.marks,
                pdfPage: sorted[0]!.pdfPage,
              },
            ],
    });
  }

  return drafts.sort((a, b) => a.pageNumber - b.pageNumber);
}

async function extractPositionedItems(
  page: import("pdfjs-dist").PDFPageProxy,
): Promise<PositionedItem[]> {
  const content = await page.getTextContent();
  return (content.items as Array<{ str?: string; transform?: number[] }>)
    .filter((it) => it.str?.trim())
    .map((it) => ({
      str: it.str!.trim(),
      x: it.transform![4]!,
      y: it.transform![5]!,
    }));
}

function clusterRows(items: PositionedItem[], yTolerance = 7): PositionedItem[][] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x);
  const rows: PositionedItem[][] = [];
  for (const item of sorted) {
    const row = rows.find((r) => Math.abs(r[0]!.y - item.y) <= yTolerance);
    if (row) row.push(item);
    else rows.push([item]);
  }
  for (const row of rows) row.sort((a, b) => a.x - b.x);
  return rows;
}

function rowToCells(row: PositionedItem[], columnBounds: number[]): string[] {
  const cells = Array.from({ length: columnBounds.length }, () => "");
  for (const item of row) {
    let col = 0;
    for (let i = columnBounds.length - 1; i >= 0; i--) {
      if (item.x >= columnBounds[i]! - 18) {
        col = i;
        break;
      }
    }
    cells[col] = cells[col] ? `${cells[col]} ${item.str}` : item.str;
  }
  return cells.map((c) => c.trim());
}

function rowLooksLikeTableHeader(cells: string[]): boolean {
  const norms = cells.map((c) => normHeader(c)).map((h) => HEADER_ALIASES[h] ?? h);
  return norms.includes("question_id") && norms.includes("pdf_page");
}

function rowLooksLikeTableData(cells: string[], minCols: number): boolean {
  const filled = cells.filter((c) => c.trim()).length;
  if (filled < Math.min(4, minCols)) return false;
  const id = cells[0]?.trim() ?? "";
  if (!id) return false;
  if (/^(question_id|part_key|subject)/i.test(id)) return false;
  return /[\w.-]+/.test(id);
}

function plainTextToTsv(text: string): string | null {
  const lines = text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;
  const headerIdx = lines.findIndex((l) => /question_id/i.test(l) && /pdf_page/i.test(l));
  if (headerIdx < 0) return null;

  const headerLine = lines[headerIdx]!;
  if (headerLine.includes("\t")) {
    return lines.slice(headerIdx).join("\n");
  }
  const headerCells = headerLine.split(/\s{2,}|\|/).map((x) => x.trim());
  if (headerCells.length < 4) return null;

  const out = [headerCells.join("\t")];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]!;
    if (!line.trim()) break;
    if (/^(page\s+\d+|©|vce\s+)/i.test(line)) break;
    const cells = line.includes("\t")
      ? line.split("\t").map((x) => x.trim())
      : line.split(/\s{2,}|\|/).map((x) => x.trim());
    if (cells.length < 3) break;
    while (cells.length < headerCells.length) cells.push("");
    out.push(cells.slice(0, headerCells.length).join("\t"));
  }
  return out.length >= 2 ? out.join("\n") : null;
}

function rowsToTsv(header: string[], dataRows: string[][]): string {
  return [header.join("\t"), ...dataRows.map((r) => r.join("\t"))].join("\n");
}

async function extractTableTsvFromPage(
  page: import("pdfjs-dist").PDFPageProxy,
): Promise<{ tsv: string; rowCount: number } | null> {
  const plain = await extractPageText(page);
  const plainTsv = plainTextToTsv(plain);
  if (plainTsv) {
    const lines = plainTsv.split("\n");
    return { tsv: plainTsv, rowCount: Math.max(0, lines.length - 1) };
  }

  const items = await extractPositionedItems(page);
  if (!items.length) return null;

  const clustered = clusterRows(items);
  const headerIdx = clustered.findIndex((row) => {
    const cells = row.map((it) => it.str);
    return rowLooksLikeTableHeader(cells);
  });
  if (headerIdx < 0) return null;

  const headerRow = clustered[headerIdx]!;
  const columnBounds = headerRow.map((it) => it.x).sort((a, b) => a - b);
  const header = rowToCells(headerRow, columnBounds);
  const dataRows: string[][] = [];

  for (let i = headerIdx + 1; i < clustered.length; i++) {
    const cells = rowToCells(clustered[i]!, columnBounds);
    if (!rowLooksLikeTableData(cells, columnBounds.length)) break;
    dataRows.push(cells);
  }

  if (!dataRows.length) return null;
  return { tsv: rowsToTsv(header, dataRows), rowCount: dataRows.length };
}

export type PdfTableExtractResult = {
  tableText: string;
  tablePageNumbers: number[];
  errors: string[];
};

/** Find and extract the metadata table embedded in a PDF (first pages with question_id / pdf_page columns). */
export async function extractStructuredTableTextFromPdf(
  pdfFile: File,
  onProgress?: (message: string) => void,
): Promise<PdfTableExtractResult> {
  const errors: string[] = [];
  const doc = await openPdfDocument(pdfFile);
  const tablePageNumbers: number[] = [];
  const tsvChunks: string[] = [];
  let headerLine: string | null = null;
  let inTable = false;

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    onProgress?.(`Reading table from page ${pageNumber}…`);
    const page = await doc.getPage(pageNumber);
    const chunk = await extractTableTsvFromPage(page);
    if (!chunk?.rowCount) {
      if (inTable) break;
      continue;
    }

    const lines = chunk.tsv.split("\n");
    const pageHeader = lines[0] ?? "";
    const dataLines = lines.slice(1);

    if (!headerLine) {
      headerLine = pageHeader;
      tsvChunks.push(chunk.tsv);
      tablePageNumbers.push(pageNumber);
      inTable = true;
      continue;
    }

    if (pageHeader === headerLine || rowLooksLikeTableHeader(pageHeader.split("\t"))) {
      tsvChunks.push(dataLines.join("\n"));
      tablePageNumbers.push(pageNumber);
      continue;
    }

    if (dataLines.length) {
      tsvChunks.push(dataLines.join("\n"));
      tablePageNumbers.push(pageNumber);
    }
    break;
  }

  if (!headerLine || tsvChunks.length === 0) {
    return {
      tableText: "",
      tablePageNumbers: [],
      errors: [
        "No question table found in PDF. The PDF should include a table with columns question_id, part_key, marks, part_label, and pdf_page.",
      ],
    };
  }

  const tableText = tsvChunks.join("\n");
  return { tableText, tablePageNumbers, errors };
}

export async function loadStructuredTableFromPdf(
  pdfFile: File,
  imagePrimary: boolean,
  onProgress?: (message: string) => void,
): Promise<{ drafts: TableGroupedDraft[]; errors: string[]; tableText: string }> {
  const extracted = await extractStructuredTableTextFromPdf(pdfFile, onProgress);
  if (!extracted.tableText.trim()) {
    return { drafts: [], errors: extracted.errors, tableText: "" };
  }

  onProgress?.("Parsing table rows…");
  const result = await loadStructuredTableWithPdf(
    extracted.tableText,
    pdfFile,
    imagePrimary,
    onProgress,
  );
  return {
    ...result,
    errors: [...extracted.errors, ...result.errors],
    tableText: extracted.tableText,
  };
}

export async function loadStructuredTableWithPdf(
  tableText: string,
  pdfFile: File,
  imagePrimary: boolean,
  onProgress?: (message: string) => void,
): Promise<{ drafts: TableGroupedDraft[]; errors: string[] }> {
  const parsed = parseStructuredQuestionTable(tableText);
  if (!parsed.rows.length) {
    return { drafts: [], errors: parsed.errors.length ? parsed.errors : ["No valid rows."] };
  }

  const pageNumbers = parsed.rows.map((r) => r.pdfPage);
  onProgress?.("Rendering PDF pages…");
  const pageImages = await renderPdfPagesToDataUrls(pdfFile, pageNumbers, (done, total) => {
    onProgress?.(`Rendering page ${done + 1} of ${total}…`);
  });

  const missingPages = [...new Set(pageNumbers)].filter((p) => !pageImages.has(p));
  const errors = [...parsed.errors];
  if (missingPages.length) {
    errors.push(`PDF missing page(s): ${missingPages.join(", ")}`);
  }

  const drafts = groupTableRowsToDrafts(parsed.rows, pageImages, imagePrimary);
  return { drafts, errors };
}

export const STRUCTURED_TABLE_TEMPLATE = `question_id\tpart_key\tsubject_id\ttype\ttopic\tmarks\tpart_label\tplaceholder\taccepted_answer\tquestion\tpdf_page
2024-q5\ta\tdemo\tshort_answer\tData analysis\t2\ta) State the median\tEnter a number\t42\tThe histogram shows test scores.\t3
2024-q5\tb\tdemo\tshort_answer\tData analysis\t3\tb) Find the IQR\tEnter a number\t18\t\t4`;
