import type { PdfTextSpan } from "@/lib/createPdfPageView";
import { loadPdfPageView, openPdfDocument } from "@/lib/createPdfPageView";
import {
  extractPageText,
  extractPartMarks,
  extractQuestionTotalMarks,
  sanitizePdfQuestionText,
  stripExamBoilerplate,
  type DetectedSubpart,
  type PdfParsedQuestion,
} from "@/lib/pdfQuestionImport";
import { partKeyFromLabel, stripMarksAnnotations } from "@/lib/questionDisplay";
import { normalizeQuestionMathText } from "@/lib/questionMathText";

type TextLine = {
  text: string;
  topPct: number;
  leftPct: number;
  pageNumber: number;
};

type QuestionAnchor = {
  localNumber: number;
  marks: number;
  pageNumber: number;
  topPct: number;
  sectionLabel: string;
};

type PageBundle = {
  pageNumber: number;
  text: string;
  imageDataUrl: string;
  lines: TextLine[];
};

const QUESTION_HEADER_RE =
  /^Question\s+(\d{1,2})\s*\(\s*(\d{1,2})\s*marks?\s*\)/i;

const SECTION_A_RE = /SECTION\s+A\b/i;
const SECTION_B_MODULE_RE = /SECTION\s+B\s*[–-]\s*Module\s+(\d+)/i;

const BOILERPLATE_LINE_RES = [
  /^Page\s+\d+\s+of\s+\d+/i,
  /^\d+\s+20\d{2}\s+/i,
  /^20\d{2}\s+\w+/i,
  /^SECTION\s+[AB]\s*[–-]/i,
  /^Instructions for Section/i,
  /^TURN OVER$/i,
  /^DO\s+NOT\s+WRITE/i,
  /^Data:\s/i,
  /^©\s*VCAA/i,
  /^a r e a$/i,
  /^t h i s$/i,
  /^i n$/i,
  /^w r i t e$/i,
  /^n o t$/i,
  /^d o$/i,
];

function cleanLineText(raw: string): string {
  return raw.replace(/\u00AD/g, "").replace(/\s+/g, " ").trim();
}

function groupSpansIntoLines(spans: PdfTextSpan[], pageNumber: number): TextLine[] {
  const sorted = [...spans].sort((a, b) => b.topPct - a.topPct || a.leftPct - b.leftPct);
  const lines: TextLine[] = [];
  const lineTol = 1.25;

  for (const span of sorted) {
    if (span.topPct < 2.5 || span.topPct > 97.5) continue;
    const str = span.str.replace(/\u00AD/g, "");
    if (!str.trim()) continue;

    const last = lines[lines.length - 1];
    if (last && Math.abs(span.topPct - last.topPct) < lineTol) {
      const gap = last.text.endsWith(" ") || str.startsWith(" ") ? "" : " ";
      last.text += gap + str;
      last.leftPct = Math.min(last.leftPct, span.leftPct);
    } else {
      lines.push({
        text: str,
        topPct: span.topPct,
        leftPct: span.leftPct,
        pageNumber,
      });
    }
  }

  return lines
    .map((line) => ({ ...line, text: cleanLineText(line.text) }))
    .filter((line) => line.text.length > 0);
}

function isBoilerplateLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (BOILERPLATE_LINE_RES.some((re) => re.test(t))) return true;
  if (/^Question\s+\d+\s*[–-]\s*continued/i.test(t)) return true;
  if (/^SECTION\s+[AB]\s*[–-]\s*Question\s+\d+\s*[–-]\s*continued/i.test(t)) return true;
  return false;
}

function sectionLabelFromLines(lines: TextLine[], beforePage: number): string {
  let section = "Section A";
  for (const line of lines) {
    if (line.pageNumber > beforePage) break;
    if (SECTION_A_RE.test(line.text) && !SECTION_B_MODULE_RE.test(line.text)) {
      section = "Section A";
    }
    const mod = line.text.match(SECTION_B_MODULE_RE);
    if (mod?.[1]) section = `Module ${mod[1]}`;
  }
  return section;
}

function findQuestionAnchors(pages: PageBundle[]): QuestionAnchor[] {
  const anchors: QuestionAnchor[] = [];
  const allLines = pages.flatMap((p) => p.lines);

  for (const page of pages) {
    for (const line of page.lines) {
      const match = line.text.match(QUESTION_HEADER_RE);
      if (!match?.[1] || !match[2]) continue;
      if (/continued/i.test(line.text)) continue;
      if (line.leftPct > 22) continue;

      const localNumber = Number(match[1]);
      const marks = Number(match[2]);
      if (!Number.isFinite(localNumber) || !Number.isFinite(marks)) continue;

      anchors.push({
        localNumber,
        marks,
        pageNumber: page.pageNumber,
        topPct: line.topPct,
        sectionLabel: sectionLabelFromLines(allLines, page.pageNumber),
      });
    }
  }

  anchors.sort(
    (a, b) => a.pageNumber - b.pageNumber || a.topPct - b.topPct,
  );
  return anchors;
}

function pagesForQuestion(
  anchorIndex: number,
  anchors: QuestionAnchor[],
  pages: PageBundle[],
): PageBundle[] {
  const start = anchors[anchorIndex]!.pageNumber;
  const next = anchors[anchorIndex + 1];
  const end = next ? next.pageNumber - 1 : pages[pages.length - 1]!.pageNumber;
  return pages.filter((p) => p.pageNumber >= start && p.pageNumber <= end);
}

function contentLinesFromBlock(lines: TextLine[]): TextLine[] {
  return lines.filter((line) => !isBoilerplateLine(line.text));
}

function cleanedTextFromBlock(blockText: string): string {
  const stripped = stripExamBoilerplate(blockText);
  return stripped
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !isBoilerplateLine(line))
    .join("\n");
}

function lineCharOffsetInCleaned(line: TextLine, contentLines: TextLine[]): number {
  let offset = 0;
  for (const entry of contentLines) {
    if (entry === line) return offset;
    offset += entry.text.length + 1;
  }
  return offset;
}

type PartMarker = {
  key: string;
  label: string;
  index: number;
  pageNumber: number;
  topPct: number;
};

const LETTER_MARKER_RE =
  /(?:^|\n|[.?!;]\s*|\s+)([a-e])\.\s+(?=\S)/g;
const ROMAN_MARKER_RE =
  /(?:^|\n)\s*(i{1,3}|iv)\.\s+(?=\S)/gi;
const LETTER_LINE_RE = /^([a-e])\.\s+(.+)$/i;
const ROMAN_LINE_RE = /^(i{1,3}|iv)\.\s+(.+)$/i;

function findPartMarkers(blockText: string, lines: TextLine[]): PartMarker[] {
  const contentLines = contentLinesFromBlock(lines);
  const cleaned = cleanedTextFromBlock(blockText);
  const markers: PartMarker[] = [];

  const addMarker = (
    key: string,
    label: string,
    index: number,
    pageNumber: number,
    topPct: number,
  ) => {
    if (!key.trim()) return;
    markers.push({ key, label, index, pageNumber, topPct });
  };

  for (const line of contentLines) {
    const letterLine = line.text.match(LETTER_LINE_RE);
    if (letterLine?.[1] && (line.leftPct < 22 || letterLine[1] === letterLine[1].toLowerCase())) {
      const partLabel = `${letterLine[1].toLowerCase()}.`;
      const key = partKeyFromLabel(partLabel, letterLine[1].toLowerCase());
      addMarker(
        key,
        partLabel,
        lineCharOffsetInCleaned(line, contentLines),
        line.pageNumber,
        line.topPct,
      );
      continue;
    }

    const romanLine = line.text.match(ROMAN_LINE_RE);
    if (romanLine?.[1] && line.leftPct < 22) {
      const partLabel = `${romanLine[1].toLowerCase()}.`;
      const key = partKeyFromLabel(partLabel, romanLine[1].toLowerCase());
      addMarker(
        key,
        partLabel,
        lineCharOffsetInCleaned(line, contentLines),
        line.pageNumber,
        line.topPct,
      );
    }
  }

  for (const re of [LETTER_MARKER_RE, ROMAN_MARKER_RE]) {
    re.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = re.exec(cleaned)) !== null) {
      const rawLabel = match[1]!.toLowerCase();
      const partLabel = `${rawLabel}.`;
      const key = partKeyFromLabel(partLabel, rawLabel);
      const index = match.index + match[0].indexOf(rawLabel);
      const line = contentLines.find((entry) => {
        const start = lineCharOffsetInCleaned(entry, contentLines);
        const end = start + entry.text.length;
        return index >= start && index <= end + 1;
      });
      addMarker(
        key,
        partLabel,
        index,
        line?.pageNumber ?? contentLines[0]?.pageNumber ?? 1,
        line?.topPct ?? 0,
      );
    }
  }

  markers.sort(
    (a, b) => a.pageNumber - b.pageNumber || a.topPct - b.topPct || a.index - b.index,
  );

  const seen = new Set<string>();
  return markers.filter((m) => {
    if (seen.has(m.key)) return false;
    seen.add(m.key);
    return true;
  });
}

function detectPartsFromBlock(
  blockText: string,
  lines: TextLine[],
): { stem: string; parts: DetectedSubpart[] } {
  const cleaned = cleanedTextFromBlock(blockText);
  if (!cleaned) return { stem: "", parts: [] };

  const markers = findPartMarkers(blockText, lines);
  if (!markers.length) return { stem: cleaned, parts: [] };

  const stem = cleaned.slice(0, markers[0]!.index).trim();
  const parts: DetectedSubpart[] = [];

  for (let i = 0; i < markers.length; i++) {
    const { key, label, index } = markers[i]!;
    const bodyStart = index + label.length;
    const bodyEnd =
      i + 1 < markers.length ? markers[i + 1]!.index : cleaned.length;
    let body = cleaned.slice(bodyStart, bodyEnd).trim();
    body = body.replace(/^\s*[.)]\s*/, "").trim();
    const marks = extractPartMarks(body);
    const cleanBody = stripMarksAnnotations(body);
    const descriptor = cleanBody ? `${label} ${cleanBody}` : label;
    parts.push({
      label: key,
      descriptor,
      body: cleanBody,
      ...(marks ? { marks } : {}),
    });
  }

  return { stem, parts };
}

function buildQuestionDisplay(
  stem: string,
  parts: DetectedSubpart[],
  _sectionLabel: string,
  _localNumber: number,
  fallbackText: string,
): string {
  const stemText = sanitizePdfQuestionText(stem, false);
  if (stemText) return stemText;
  if (parts.length === 1) {
    return sanitizePdfQuestionText(parts[0]!.body, false) || stemText;
  }
  if (parts.length >= 2) return stemText;
  return sanitizePdfQuestionText(fallbackText, false) || "";
}

function parsedQuestionSkeletonFromAnchor(
  globalNumber: number,
  anchor: QuestionAnchor,
  pages: PageBundle[],
): PdfParsedQuestion {
  const images = pages.map((p) => p.imageDataUrl);
  return {
    id: `q${globalNumber}`,
    pageNumber: pages[0]!.pageNumber,
    pageNumbers: pages.map((p) => p.pageNumber),
    marks: anchor.marks,
    question: "",
    stem: "",
    examSection: anchor.sectionLabel,
    examLocalNumber: anchor.localNumber,
    imageDataUrl: images[0]!,
    imageDataUrls: images,
  };
}

function parsedQuestionFromAnchor(
  globalNumber: number,
  anchor: QuestionAnchor,
  pages: PageBundle[],
): PdfParsedQuestion {
  const blockText = pages.map((p) => p.text).join("\n\n");
  const lines = pages.flatMap((p) => p.lines);
  const { stem, parts } = detectPartsFromBlock(blockText, lines);
  const marks = anchor.marks || extractQuestionTotalMarks(blockText) || 1;
  const images = pages.map((p) => p.imageDataUrl);
  const question = buildQuestionDisplay(
    stem,
    parts,
    anchor.sectionLabel,
    anchor.localNumber,
    blockText,
  );
  const stemText = sanitizePdfQuestionText(stem, false);

  return {
    id: `q${globalNumber}`,
    pageNumber: pages[0]!.pageNumber,
    pageNumbers: pages.map((p) => p.pageNumber),
    marks,
    question: normalizeQuestionMathText(question || stemText || `Question ${anchor.localNumber}`),
    stem: normalizeQuestionMathText(stemText || question),
    examSection: anchor.sectionLabel,
    examLocalNumber: anchor.localNumber,
    rawText: blockText,
    imageDataUrl: images[0]!,
    imageDataUrls: images,
    detectedParts: parts.length >= 1 ? parts : undefined,
  };
}

export type LabeledExamParseReport = {
  questionCount: number;
  anchors: Array<{ globalNumber: number; localNumber: number; section: string; pages: number[] }>;
};

export async function parseLabeledExamPdf(
  file: File,
  options?: {
    onProgress?: (done: number, total: number) => void;
    /** When true, PDF only supplies page images + question boundaries — no question text. */
    skeletonOnly?: boolean;
  },
): Promise<{ questions: PdfParsedQuestion[]; report: LabeledExamParseReport }> {
  const skeletonOnly = options?.skeletonOnly ?? false;
  const doc = await openPdfDocument(file);
  const pages: PageBundle[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    options?.onProgress?.(pageNumber - 1, doc.numPages);
    const page = await doc.getPage(pageNumber);
    const view = await loadPdfPageView(doc, pageNumber);
    const lines = groupSpansIntoLines(view.textSpans, pageNumber);
    pages.push({
      pageNumber,
      text: skeletonOnly ? "" : await extractPageText(page),
      imageDataUrl: view.imageDataUrl,
      lines,
    });
  }
  options?.onProgress?.(doc.numPages, doc.numPages);

  const anchors = findQuestionAnchors(pages);
  const questions: PdfParsedQuestion[] = [];
  const reportAnchors: LabeledExamParseReport["anchors"] = [];

  anchors.forEach((anchor, index) => {
    const globalNumber = index + 1;
    const questionPages = pagesForQuestion(index, anchors, pages);
    if (!questionPages.length) return;
    questions.push(
      skeletonOnly
        ? parsedQuestionSkeletonFromAnchor(globalNumber, anchor, questionPages)
        : parsedQuestionFromAnchor(globalNumber, anchor, questionPages),
    );
    reportAnchors.push({
      globalNumber,
      localNumber: anchor.localNumber,
      section: anchor.sectionLabel,
      pages: questionPages.map((p) => p.pageNumber),
    });
  });

  return {
    questions,
    report: { questionCount: questions.length, anchors: reportAnchors },
  };
}
