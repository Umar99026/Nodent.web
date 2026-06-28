import type { PdfTextSpan } from "@/lib/createPdfPageView";
import { buildMcqRows } from "@/lib/practiceExamImport";
import {
  extractMcqOptionsFromText,
  openPdfDocument,
} from "@/lib/pdfQuestionImport";
import { normalizeQuestionMathText } from "@/lib/questionMathText";
import type { PracticeExamMcqItem } from "@/lib/practiceExamTypes";

type QuestionAnchor = {
  questionNumber: number;
  topPct: number;
  leftPct: number;
  inlineStem?: string;
};

const LEFT_MARGIN_PCT = 24;
const REGION_BOTTOM_PCT = 97;

function cleanPdfText(raw: string): string {
  return raw
    .replace(/\u0000/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseAnchorFromSpan(span: PdfTextSpan): QuestionAnchor | null {
  const t = span.str.trim().replace(/\u00AD/g, "");
  if (span.leftPct > LEFT_MARGIN_PCT) return null;

  const questionLabel = t.match(/^Question\s*(\d{1,2})\s*\.?\s*$/i);
  if (questionLabel?.[1]) {
    return {
      questionNumber: Number(questionLabel[1]),
      topPct: span.topPct,
      leftPct: span.leftPct,
    };
  }

  const questionInline = t.match(/^Question\s*(\d{1,2})\s*\.?\s+(.+)$/i);
  if (questionInline?.[1]) {
    return {
      questionNumber: Number(questionInline[1]),
      topPct: span.topPct,
      leftPct: span.leftPct,
      inlineStem: questionInline[2]?.trim(),
    };
  }

  const standalone = t.match(/^(\d{1,2})\s*\.?\s*$/);
  if (standalone) {
    return {
      questionNumber: Number(standalone[1]),
      topPct: span.topPct,
      leftPct: span.leftPct,
    };
  }

  const inline = t.match(/^(\d{1,2})\s*\.\s+(.+)$/);
  if (inline?.[1] && inline[2]?.trim()) {
    return {
      questionNumber: Number(inline[1]),
      topPct: span.topPct,
      leftPct: span.leftPct,
      inlineStem: inline[2].trim(),
    };
  }

  return null;
}

async function buildTextSpans(
  page: import("pdfjs-dist").PDFPageProxy,
): Promise<PdfTextSpan[]> {
  const pdfjs = await import("pdfjs-dist");
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const spans: PdfTextSpan[] = [];

  for (const raw of content.items) {
    if (!raw || typeof raw !== "object" || !("str" in raw)) continue;
    const item = raw as { str: string; transform: number[]; width?: number };
    const str = item.str ?? "";
    if (!str.trim()) continue;

    const tm = pdfjs.Util.transform(viewport.transform, item.transform);
    const fontSize = Math.hypot(tm[2] ?? 0, tm[3] ?? 0) || 12;
    const left = tm[4] ?? 0;
    const top = (tm[5] ?? 0) - fontSize;
    const width = (item.width ?? str.length * 0.5) * fontSize;

    spans.push({
      str,
      leftPct: (left / viewport.width) * 100,
      topPct: (top / viewport.height) * 100,
      widthPct: Math.min(40, (width / viewport.width) * 100),
      fontSizePx: fontSize,
    });
  }

  return spans;
}

function findQuestionAnchors(spans: PdfTextSpan[], mcqCount: number): QuestionAnchor[] {
  const byNumber = new Map<number, QuestionAnchor>();

  for (const span of spans) {
    if (span.topPct < 4 || span.topPct > 96) continue;
    const anchor = parseAnchorFromSpan(span);
    if (!anchor || anchor.questionNumber > mcqCount) continue;

    const prev = byNumber.get(anchor.questionNumber);
    if (!prev || anchor.topPct < prev.topPct - 0.2) {
      byNumber.set(anchor.questionNumber, anchor);
    }
  }

  return [...byNumber.values()].sort(
    (a, b) => a.questionNumber - b.questionNumber,
  );
}

function regionEndTop(anchor: QuestionAnchor, anchors: QuestionAnchor[]): number {
  const next = anchors
    .filter((a) => a.questionNumber > anchor.questionNumber)
    .sort((a, b) => a.questionNumber - b.questionNumber)[0];
  return next ? next.topPct - 0.4 : REGION_BOTTOM_PCT;
}

function assignSpanToQuestion(
  span: PdfTextSpan,
  anchors: QuestionAnchor[],
): number | null {
  if (span.topPct < 4 || span.topPct > REGION_BOTTOM_PCT) return null;

  for (const anchor of anchors) {
    const endTop = regionEndTop(anchor, anchors);
    if (span.topPct >= anchor.topPct - 0.6 && span.topPct < endTop) {
      return anchor.questionNumber;
    }
  }
  return null;
}

function buildTextFromSpans(spans: PdfTextSpan[]): string {
  const sorted = [...spans].sort(
    (a, b) => a.topPct - b.topPct || a.leftPct - b.leftPct,
  );
  let text = "";
  let lastY: number | null = null;
  for (const span of sorted) {
    if (lastY !== null && Math.abs(span.topPct - lastY) > 1.6) {
      text += "\n";
    } else if (text && !text.endsWith("\n")) {
      text += " ";
    }
    text += span.str;
    lastY = span.topPct;
  }
  return cleanPdfText(text);
}

function cleanStem(stem: string, questionNumber: number): string {
  return normalizeQuestionMathText(
    stem
      .replace(new RegExp(`^\\s*${questionNumber}\\s*\\.?\\s*`), "")
      .replace(/^\s*Question\s+\d+\s*\.?\s*/i, "")
      .trim(),
  );
}

function extractFromRegionText(
  regionText: string,
  anchor: QuestionAnchor,
): { stem: string; options: string[] | null } {
  const prefixed = anchor.inlineStem
    ? `${anchor.questionNumber}. ${anchor.inlineStem}\n${regionText}`
    : regionText;

  const result = extractMcqOptionsFromText(prefixed);
  const stem = cleanStem(result.stem, anchor.questionNumber);
  const options =
    result.options?.length === 4 && result.options.every((o) => o.trim())
      ? result.options.map((o) => normalizeQuestionMathText(o.trim()))
      : null;

  return { stem, options };
}

type PageExtract = {
  questionNumber: number;
  pageNumber: number;
  stem: string;
  options: string[] | null;
};

async function extractMcqFromPage(
  page: import("pdfjs-dist").PDFPageProxy,
  pageNumber: number,
  mcqCount: number,
): Promise<PageExtract[]> {
  const spans = await buildTextSpans(page);
  const anchors = findQuestionAnchors(spans, mcqCount);
  if (!anchors.length) return [];

  const spansByQuestion = new Map<number, PdfTextSpan[]>();
  for (const anchor of anchors) {
    spansByQuestion.set(anchor.questionNumber, []);
  }

  for (const span of spans) {
    const qn = assignSpanToQuestion(span, anchors);
    if (qn == null) continue;
    spansByQuestion.get(qn)?.push(span);
  }

  const out: PageExtract[] = [];
  for (const anchor of anchors) {
    const regionSpans = spansByQuestion.get(anchor.questionNumber) ?? [];
    const regionText = buildTextFromSpans(regionSpans);
    if (!regionText.trim()) continue;

    const { stem, options } = extractFromRegionText(regionText, anchor);
    out.push({
      questionNumber: anchor.questionNumber,
      pageNumber,
      stem,
      options,
    });
  }

  return out;
}

function applyExtractToItem(
  item: PracticeExamMcqItem,
  extracted: PageExtract,
): PracticeExamMcqItem {
  const hasOptions =
    extracted.options?.length === 4 && extracted.options.every((o) => o.trim());

  return {
    ...item,
    pageNumber: extracted.pageNumber,
    question: extracted.stem.trim() || item.question,
    optionOverlays: undefined,
    ...(hasOptions ? { options: extracted.options! } : {}),
  };
}

export type McqPdfPageRange = { startPage: number; endPage: number };

export async function extractMcqContentFromPdf(
  file: File,
  existingItems: PracticeExamMcqItem[],
  mcqCount: number,
  pageRange?: McqPdfPageRange | null,
): Promise<{ items: PracticeExamMcqItem[]; extracted: number; warnings: string[] }> {
  const doc = await openPdfDocument(file);
  let items = buildMcqRows(mcqCount, existingItems);
  let extracted = 0;
  const warnings: string[] = [];
  const found = new Set<number>();

  const startPage = Math.max(1, pageRange?.startPage ?? 1);
  const endPage = Math.min(doc.numPages, pageRange?.endPage ?? doc.numPages);

  for (let pageNumber = startPage; pageNumber <= endPage; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const pageExtracts = await extractMcqFromPage(page, pageNumber, mcqCount);

    for (const block of pageExtracts) {
      if (block.questionNumber < 1 || block.questionNumber > mcqCount) continue;
      found.add(block.questionNumber);
      const idx = items.findIndex((item) => item.questionNumber === block.questionNumber);
      if (idx < 0) continue;

      items[idx] = applyExtractToItem(items[idx]!, block);
      if (block.options?.length === 4 && block.options.every((o) => o.trim())) {
        extracted++;
      } else if (block.stem.trim()) {
        warnings.push(
          `Q${block.questionNumber}: found stem on page ${pageNumber} but could not read all four options — check A–D layout.`,
        );
      }
    }
  }

  for (let q = 1; q <= mcqCount; q++) {
    if (!found.has(q)) {
      const item = items.find((i) => i.questionNumber === q);
      if (!item?.question?.trim()) {
        warnings.push(
          `Q${q}: question number not found in PDF text — place it manually or check the PDF has selectable text.`,
        );
      }
    }
  }

  if (!found.size) {
    warnings.unshift(
      "No numbered MCQs (1, 2, 3 …) found in the PDF text layer. Use Edit MCQs to enter questions manually.",
    );
  }

  return { items, extracted, warnings };
}
