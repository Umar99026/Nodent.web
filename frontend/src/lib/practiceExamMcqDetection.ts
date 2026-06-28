import type { PdfTextSpan } from "@/lib/createPdfPageView";
import { buildMcqRows } from "@/lib/practiceExamImport";
import { openPdfDocument } from "@/lib/pdfQuestionImport";
import type { OverlayRect } from "@/lib/diagramLabels";
import {
  boundsFromMcqOverlays,
  clampMcqGroupBounds,
  inferMcqGroupLayout,
  layoutMcqGroupInBounds,
  mcqButtonRectAtCenter,
  mcqPlacementCount,
  MCQ_BUTTON_SIZE_PCT,
} from "@/lib/practiceExamMcq";
import type {
  McqOptionLetter,
  McqOptionOverlays,
  PracticeExamMcqItem,
} from "@/lib/practiceExamTypes";
import { MCQ_OPTION_LETTERS } from "@/lib/practiceExamTypes";

type LetterHit = PdfTextSpan & { letter: McqOptionLetter; index: number };

export type DetectedMcqGroup = {
  questionNumber: number | null;
  pageNumber: number;
  options: McqOptionOverlays;
  sortKey: number;
};

const ROW_Y_TOL_PCT = 2;
const COL_X_TOL_PCT = 2.5;
const MIN_LETTER_GAP_PCT = 0.35;
const MAX_LETTER_GAP_PCT = 42;
const LEFT_MARGIN_PCT = 22;

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

function parseMcqLetter(str: string): McqOptionLetter | null {
  const t = str.trim().replace(/\u00AD/g, "");
  if (t.length > 5) return null;
  const paren = t.match(/^\(\s*([A-Da-d])\s*\)\.?$/);
  if (paren?.[1]) return paren[1].toUpperCase() as McqOptionLetter;
  const plain = t.match(/^([A-Da-d])\s*\.?\s*$/);
  if (plain?.[1]) return plain[1].toUpperCase() as McqOptionLetter;
  return null;
}

function parseBareQuestionNumber(str: string): number | null {
  const t = str.trim().replace(/\u00AD/g, "");
  const m = t.match(/^(\d{1,2})\s*\.?\s*$/);
  if (!m?.[1]) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 60 ? n : null;
}

type QuestionLabelAnchor = {
  questionNumber: number;
  topPct: number;
  leftPct: number;
};

/** Match "Question 17", "QUESTION 17.", or adjacent "Question" + "17" spans. */
function buildQuestionLabelAnchors(
  spans: PdfTextSpan[],
  maxQuestions: number,
): QuestionLabelAnchor[] {
  const anchors: QuestionLabelAnchor[] = [];
  const sorted = [...spans].sort((a, b) => a.topPct - b.topPct || a.leftPct - b.leftPct);

  for (const span of sorted) {
    if (span.topPct < 4 || span.topPct > 96) continue;
    if (span.leftPct > LEFT_MARGIN_PCT) continue;
    const t = span.str.trim().replace(/\u00AD/g, "");

    const labelOnly = t.match(/^Question\s*(\d{1,2})\s*\.?\s*$/i);
    if (labelOnly?.[1]) {
      const n = Number(labelOnly[1]);
      if (n >= 1 && n <= maxQuestions) {
        anchors.push({
          questionNumber: n,
          topPct: span.topPct,
          leftPct: span.leftPct,
        });
      }
      continue;
    }

    const labelInline = t.match(/^Question\s*(\d{1,2})\s*\.?\s+/i);
    if (labelInline?.[1]) {
      const n = Number(labelInline[1]);
      if (n >= 1 && n <= maxQuestions) {
        anchors.push({
          questionNumber: n,
          topPct: span.topPct,
          leftPct: span.leftPct,
        });
      }
    }
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i]!;
    const b = sorted[i + 1]!;
    if (a.topPct < 4 || a.topPct > 96) continue;
    if (a.leftPct > LEFT_MARGIN_PCT) continue;
    if (Math.abs(a.topPct - b.topPct) > 2.2) continue;
    if (b.leftPct < a.leftPct - 1) continue;
    if (!/^Question\.?$/i.test(a.str.trim())) continue;
    const n = parseBareQuestionNumber(b.str);
    if (n != null && n <= maxQuestions) {
      anchors.push({
        questionNumber: n,
        topPct: a.topPct,
        leftPct: a.leftPct,
      });
    }
  }

  const byNumber = new Map<number, QuestionLabelAnchor>();
  for (const anchor of anchors) {
    const prev = byNumber.get(anchor.questionNumber);
    if (!prev || anchor.topPct < prev.topPct - 0.2) {
      byNumber.set(anchor.questionNumber, anchor);
    }
  }

  return [...byNumber.values()].sort((a, b) => a.topPct - b.topPct);
}

const REGION_BOTTOM_PCT = 97;

/** Which "Question N" region contains this A–D group (by vertical position). */
function questionNumberForMcqGroup(
  groupTopPct: number,
  anchors: QuestionLabelAnchor[],
): number | null {
  if (!anchors.length) return null;
  const sorted = [...anchors].sort((a, b) => a.topPct - b.topPct);

  for (let i = 0; i < sorted.length; i++) {
    const anchor = sorted[i]!;
    const nextTop = sorted[i + 1]?.topPct ?? REGION_BOTTOM_PCT;
    if (groupTopPct >= anchor.topPct - 1.2 && groupTopPct < nextTop - 0.25) {
      return anchor.questionNumber;
    }
  }

  return null;
}

function overlayFromLetterSpan(span: PdfTextSpan, viewportHeight: number): OverlayRect {
  const letterH = ((span.fontSizePx * 1.1) / viewportHeight) * 100;
  const cx = span.leftPct + Math.max(span.widthPct, 1) / 2;
  const cy = span.topPct + letterH / 2;
  return mcqButtonRectAtCenter(cx, cy, Math.min(MCQ_BUTTON_SIZE_PCT, letterH * 1.2));
}

function letterHits(spans: PdfTextSpan[]): LetterHit[] {
  const hits: LetterHit[] = [];
  spans.forEach((span, index) => {
    if (span.topPct < 5 || span.topPct > 96) return;
    const letter = parseMcqLetter(span.str);
    if (!letter) return;
    hits.push({ ...span, letter, index });
  });
  return hits;
}

function groupHorizontalAbcd(hits: LetterHit[], used: Set<number>): LetterHit[] | null {
  for (const start of hits) {
    if (start.letter !== "A" || used.has(start.index)) continue;

    const row = hits.filter(
      (h) =>
        !used.has(h.index) &&
        Math.abs(h.topPct - start.topPct) <= ROW_Y_TOL_PCT &&
        h.leftPct >= start.leftPct - 1,
    );

    const ordered: LetterHit[] = [];
    let failed = false;
    for (const letter of MCQ_OPTION_LETTERS) {
      const candidates = row
        .filter((h) => h.letter === letter && !ordered.includes(h))
        .sort((a, b) => a.leftPct - b.leftPct);
      const pick = candidates[0];
      if (!pick) {
        failed = true;
        break;
      }
      if (ordered.length) {
        const gap = pick.leftPct - ordered[ordered.length - 1]!.leftPct;
        if (gap < MIN_LETTER_GAP_PCT || gap > MAX_LETTER_GAP_PCT) {
          failed = true;
          break;
        }
      }
      ordered.push(pick);
    }

    if (!failed && ordered.length === 4) return ordered;
  }
  return null;
}

function groupVerticalAbcd(hits: LetterHit[], used: Set<number>): LetterHit[] | null {
  for (const start of hits) {
    if (start.letter !== "A" || used.has(start.index)) continue;

    const col = hits
      .filter(
        (h) =>
          !used.has(h.index) &&
          Math.abs(h.leftPct - start.leftPct) <= COL_X_TOL_PCT &&
          h.topPct >= start.topPct - 0.5,
      )
      .sort((a, b) => a.topPct - b.topPct);

    const ordered: LetterHit[] = [];
    let failed = false;
    for (const letter of MCQ_OPTION_LETTERS) {
      const pick = col.find((h) => h.letter === letter && !ordered.includes(h));
      if (!pick) {
        failed = true;
        break;
      }
      if (ordered.length) {
        const gap = pick.topPct - ordered[ordered.length - 1]!.topPct;
        if (gap < 0.6 || gap > 14) {
          failed = true;
          break;
        }
      }
      ordered.push(pick);
    }

    if (!failed && ordered.length === 4) return ordered;
  }
  return null;
}

/** VCE-style 2×2: A B on one row, C D on the next. */
function groupGridAbcd(hits: LetterHit[], used: Set<number>): LetterHit[] | null {
  for (const a of hits) {
    if (a.letter !== "A" || used.has(a.index)) continue;

    const b = hits
      .filter(
        (h) =>
          !used.has(h.index) &&
          h.letter === "B" &&
          Math.abs(h.topPct - a.topPct) <= ROW_Y_TOL_PCT &&
          h.leftPct > a.leftPct + MIN_LETTER_GAP_PCT,
      )
      .sort((x, y) => x.leftPct - y.leftPct)[0];
    if (!b) continue;

    const c = hits
      .filter(
        (h) =>
          !used.has(h.index) &&
          h.letter === "C" &&
          Math.abs(h.leftPct - a.leftPct) <= COL_X_TOL_PCT &&
          h.topPct > a.topPct + 0.4 &&
          h.topPct < a.topPct + 14,
      )
      .sort((x, y) => x.topPct - y.topPct)[0];
    if (!c) continue;

    const d = hits
      .filter(
        (h) =>
          !used.has(h.index) &&
          h.letter === "D" &&
          Math.abs(h.leftPct - b.leftPct) <= COL_X_TOL_PCT &&
          Math.abs(h.topPct - c.topPct) <= ROW_Y_TOL_PCT &&
          h.topPct > a.topPct + 0.4,
      )
      .sort((x, y) => x.leftPct - y.leftPct)[0];
    if (!d) continue;

    return [a, b, c, d];
  }
  return null;
}

function pickAbcdGroup(hits: LetterHit[], used: Set<number>): LetterHit[] | null {
  return (
    groupHorizontalAbcd(hits, used) ??
    groupGridAbcd(hits, used) ??
    groupVerticalAbcd(hits, used)
  );
}

function nearestQuestionNumber(
  group: LetterHit[],
  anchors: QuestionLabelAnchor[],
): number | null {
  const anchor = group[0]!;
  return questionNumberForMcqGroup(anchor.topPct, anchors);
}

export async function detectMcqGroupsOnPage(
  page: import("pdfjs-dist").PDFPageProxy,
  pageNumber: number,
  maxQuestions = 60,
): Promise<DetectedMcqGroup[]> {
  const viewport = page.getViewport({ scale: 1 });
  const spans = await buildTextSpans(page);
  const hits = letterHits(spans);
  const labelAnchors = buildQuestionLabelAnchors(spans, maxQuestions);

  const groups: DetectedMcqGroup[] = [];
  const used = new Set<number>();

  while (groups.length < 40) {
    const picked = pickAbcdGroup(hits, used);
    if (!picked) break;

    for (const h of picked) used.add(h.index);

    const options: McqOptionOverlays = {};
    for (const h of picked) {
      options[h.letter] = overlayFromLetterSpan(h, viewport.height);
    }

    const anchor = picked[0]!;
    groups.push({
      questionNumber: nearestQuestionNumber(picked, labelAnchors),
      pageNumber,
      options,
      sortKey: anchor.topPct * 1000 + anchor.leftPct,
    });
  }

  groups.sort((a, b) => a.sortKey - b.sortKey);
  return groups;
}

export async function detectMcqGroupsFromPdf(
  file: File,
  maxQuestions = 20,
): Promise<{ groups: DetectedMcqGroup[]; unlabeledCount: number }> {
  const doc = await openPdfDocument(file);
  const all: DetectedMcqGroup[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const onPage = await detectMcqGroupsOnPage(page, p, maxQuestions);
    all.push(...onPage);
  }

  // Match each A–D group to the "Question N" region it sits in (skip if no label / image MCQs).
  all.sort((a, b) => a.pageNumber - b.pageNumber || a.sortKey - b.sortKey);

  const byQuestion = new Map<number, DetectedMcqGroup>();
  for (const group of all) {
    const qn = group.questionNumber;
    if (qn == null || qn < 1 || qn > maxQuestions) continue;
    if (!byQuestion.has(qn)) byQuestion.set(qn, group);
  }

  return {
    groups: [...byQuestion.values()].sort(
      (a, b) => (a.questionNumber ?? 0) - (b.questionNumber ?? 0),
    ),
    unlabeledCount: all.filter((g) => g.questionNumber == null).length,
  };
}

export async function autoAlignMcqItemsFromPdf(
  file: File,
  items: PracticeExamMcqItem[],
  mcqCount: number,
): Promise<{ items: PracticeExamMcqItem[]; aligned: number; warnings: string[] }> {
  const warnings: string[] = [];
  if (mcqCount < 1) {
    return { items, aligned: 0, warnings: ["Set MCQ count before auto-placing buttons."] };
  }

  const { groups: detected, unlabeledCount } = await detectMcqGroupsFromPdf(file, mcqCount);
  if (!detected.length) {
    warnings.push(
      "Could not find A–D letter positions in the PDF text layer. Place buttons manually or use a text-based PDF.",
    );
    return { items: buildMcqRows(mcqCount, items), aligned: 0, warnings };
  }

  const byQuestion = new Map(
    buildMcqRows(mcqCount, items).map((item) => [item.questionNumber, { ...item }]),
  );

  let aligned = 0;
  for (const group of detected) {
    const qn = group.questionNumber;
    if (!qn || qn < 1 || qn > mcqCount) continue;

    const existing = byQuestion.get(qn);
    const rawBounds = boundsFromMcqOverlays(group.options);
    const bounds = rawBounds ? clampMcqGroupBounds(rawBounds) : undefined;
    const layout = bounds ? inferMcqGroupLayout(bounds) : undefined;
    const optionOverlays =
      bounds && layout ? layoutMcqGroupInBounds(bounds, layout) : group.options;
    byQuestion.set(qn, {
      id: existing?.id ?? crypto.randomUUID(),
      questionNumber: qn,
      pageNumber: group.pageNumber,
      optionOverlays,
      mcqGroupBounds: bounds,
      mcqGroupLayout: layout,
      mcqButtonsSeparated: false,
      acceptedAnswer: existing?.acceptedAnswer ?? "",
      marks: existing?.marks ?? 1,
    });
    aligned++;
  }

  const next = [...byQuestion.values()].sort((a, b) => a.questionNumber - b.questionNumber);

  if (aligned < mcqCount) {
    const placed = [...byQuestion.values()].filter((i) => mcqPlacementCount(i) === 4).length;
    const missing = mcqCount - placed;
    warnings.push(
      `Auto-placed ${aligned} MCQ group(s) (${placed} complete). ${missing} question(s) have no A–D text — use Separate to place image-option MCQs manually.`,
    );
  }

  const unlabeled = unlabeledCount;
  if (unlabeled > 0) {
    warnings.push(
      `${unlabeled} A–D group(s) on the PDF could not be matched to a "Question N" label — check the exam uses Question 1, Question 2, … headings.`,
    );
  }

  return { items: next, aligned, warnings };
}
