import type { QuestionDraft } from "@/lib/createAssessmentDraft";
import type { MultipartPartDraft } from "@/components/admin/MultipartAnswerPartsEditor";
import { partitionAnswerParts, partHasOverlay, partUsesFigureLabels } from "@/lib/diagramLabels";
import {
  detectLetterSubparts,
  stripExamBoilerplate,
} from "@/lib/pdfQuestionImport";
import { stripMarksAnnotations } from "@/lib/questionDisplay";
import { normalizeQuestionMathText } from "@/lib/questionMathText";
import { normalizeAcceptedAnswerForStorage } from "@/lib/utils";

export type ParsedAnswerPart = {
  key: string;
  /** VCAA sub-part number when label is like "b) 1" or "d) 3". */
  subIndex?: number | null;
  /** Part question text (e.g. "a) Find the median"). Used to match omitted/reordered parts. */
  label: string;
  answer: string;
  /** Order in the pasted document (0-based). */
  order: number;
};

export type ParsedAnswerQuestion = {
  questionNumber: number;
  /** Shared stem / intro for this question (optional). */
  questionText?: string;
  mcqAnswer?: string;
  parts: ParsedAnswerPart[];
  singleAnswer?: string;
};

function stripAnswerBoilerplate(raw: string): string {
  let t = String(raw ?? "").trim();
  const linePatterns = [
    /^page\s+\d+\s+of\s+\d+.*$/i,
    /^\d{4}\s+vce\b.*$/i,
    /^\d{4}\s+.*\bexamination\b.*$/i,
    /^©\s*vcaa.*$/i,
    /^do\s+not\s+write\b.*$/i,
    /^(?:general|mathematical|specialist|further)\s+mathematics\b.*$/i,
    /^question\s+\d+\b.*$/i,
    /^\d+\s*marks?\s*$/i,
    /^section\s+[a-z]\b.*$/i,
  ];
  for (const re of linePatterns) {
    if (re.test(t)) return "";
  }
  t = t
    .replace(/\b\d{4}\s+vce\s+general\s+mathematics\s*\d*\b/gi, "")
    .replace(/\b\d{4}\s+vce\s+[^.\n]{0,60}\bexamination\s*\d*\b/gi, "")
    .replace(/\bpage\s+\d+\s+of\s+\d+\b/gi, "")
    .trim();
  return t;
}

/** VCAA-style prefixes: "1b.i." "Q1b)" "b.i." before the actual answer. */
function stripSolutionPartPrefix(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/^\s*(?:question\s*)?\d+\s*/i, "")
    .replace(
      /^\s*([a-z])(?:\s*[.)]|(?:\.(?:i{1,3}|iv|v|vi{0,3}|ix|x|xi{0,3}|[a-z]))+)\s*[.)]?\s*/i,
      "",
    )
    .replace(/^\s*\(?[a-z]\)\s*/i, "")
    .trim();
}

function isBoilerplateAnswer(text: string): boolean {
  const t = String(text ?? "").trim();
  if (!t) return true;
  if (stripAnswerBoilerplate(t) === "") return true;
  if (/\b\d{4}\s+vce\b/i.test(t)) return true;
  if (/\bgeneral\s+mathematics\b/i.test(t) && t.length < 80) return true;
  if (/\bexamination\s*\d*/i.test(t) && !/^-?\d/.test(t)) return true;
  if (/^page\s+\d+/i.test(t)) return true;
  return false;
}

function isValidAnswerKey(key: string): boolean {
  return key.length === 1 && key >= "a" && key <= "z";
}

function cleanAnswerText(raw: string): string {
  let t = stripSolutionPartPrefix(stripMarksAnnotations(raw));
  t = stripAnswerBoilerplate(t);
  if (!t) return "";
  t = normalizeQuestionMathText(
    t
      .replace(/^(?:solution|solutions|answer|answers|ans|working)\s*[:\-–—]\s*/i, "")
      .replace(/^(?:Question|QUESTION|Q)\s*\d+\s*[.):\-–—]?\s*(?:\(\s*\d+\s*marks?\s*\))?\s*/i, "")
      .replace(/^\s*\d+\s*[.)]\s*/, "")
      .trim(),
  );
  t = stripAnswerBoilerplate(t);
  return t.trim();
}

function sanitizeAnswerForApply(answer: string | undefined): string {
  const cleaned = cleanAnswerText(answer ?? "");
  if (!cleaned || isBoilerplateAnswer(cleaned)) return "";
  return normalizeAcceptedAnswerForStorage(cleaned);
}

function normalizeMatchText(raw: string): string {
  return String(raw ?? "")
    .toLowerCase()
    .replace(/\[\[(?:QUESTION|TEXT|ANSWER|PART|STEM)\]\]/gi, "")
    .replace(/^(?:part|question|text|label)\s*[:\-–—]\s*/i, "")
    .replace(/^[a-z]\)\s*/i, "")
    .replace(/[^\w\s%/$.=+-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function matchTextScore(left: string, right: string): number {
  const a = normalizeMatchText(left);
  const b = normalizeMatchText(right);
  if (!a || !b) return 0;
  if (a === b) return 1;
  if (a.includes(b) || b.includes(a)) return 0.92;
  const tokensB = b.split(" ").filter((token) => token.length > 2);
  if (!tokensB.length) return 0;
  const tokensA = new Set(a.split(" ").filter((token) => token.length > 2));
  const hits = tokensB.filter((token) => tokensA.has(token)).length;
  return hits / tokensB.length;
}

function parseMcqAnswer(text: string): string | undefined {
  const explicit = text.match(
    /(?:correct(?:\s+answer)?|answer)\s*[:\-–—]\s*([A-D])\b/i,
  )?.[1];
  if (explicit) return explicit.toUpperCase();
  const lone = text.match(/(?:^|\n)\s*([A-D])\s*(?:\n|$|[.)])/);
  if (lone?.[1]) return lone[1].toUpperCase();
  return undefined;
}

function parsePartLabelMeta(label: string): { key: string; subIndex: number | null } {
  const trimmed = String(label ?? "").trim();
  const match = trimmed.match(/^([a-z])\)\s*(?:(\d+|[ivxlcdm]+)\.?\s*)?(.*)$/i);
  if (!match?.[1]) {
    return { key: trimmed.charAt(0)?.toLowerCase() || "a", subIndex: null };
  }
  const key = match[1].toLowerCase();
  let subIndex: number | null = null;
  const subRaw = match[2]?.trim();
  if (subRaw) {
    if (/^\d+$/.test(subRaw)) subIndex = Number.parseInt(subRaw, 10);
    else if (/^i{1,3}$/i.test(subRaw)) subIndex = subRaw.toLowerCase().length;
    else if (/^iv$/i.test(subRaw)) subIndex = 4;
  }
  return { key, subIndex };
}

function draftPartKey(part: MultipartPartDraft, index: number): string {
  return (part.key?.trim() || String.fromCharCode(97 + index)).toLowerCase();
}

/** Prefer letter from part label (b.i, b) 1) over auto-incremented key. */
function slotKeyFromPart(part: MultipartPartDraft, partIndex: number): string {
  const label = part.label?.trim() ?? "";
  if (label) {
    const { key } = parsePartLabelMeta(label);
    if (isValidAnswerKey(key) && /^[a-z]\s*[.)]/i.test(label)) {
      return key;
    }
    const vcaa = label.match(/^([a-z])\s*\.\s*(i{1,3}|iv)\b/i);
    if (vcaa?.[1]) return vcaa[1].toLowerCase();
  }
  return draftPartKey(part, partIndex);
}

function groupParsedPartsByKey(parsedParts: ParsedAnswerPart[]): Map<string, ParsedAnswerPart[]> {
  const groups = new Map<string, ParsedAnswerPart[]>();
  const ordered = [...parsedParts].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const part of ordered) {
    const key = part.key.toLowerCase();
    const list = groups.get(key) ?? [];
    list.push(part);
    groups.set(key, list);
  }
  return groups;
}

function mapParsedPartsToSlots(
  slots: AnswerFillSlot[],
  parsedParts: ParsedAnswerPart[],
): Array<{ slotId: string; index: number; acceptedAnswer: string }> {
  const byKey = groupParsedPartsByKey(parsedParts);
  const keyUsage = new Map<string, number>();
  const mapped: Array<{ slotId: string; index: number; acceptedAnswer: string }> = [];

  for (const slot of slots) {
    const key = (slot.key ?? "a").toLowerCase();
    const usage = keyUsage.get(key) ?? 0;
    const candidate = byKey.get(key)?.[usage];
    keyUsage.set(key, usage + 1);
    const answer = sanitizeAnswerForApply(candidate?.answer);
    if (answer) {
      mapped.push({ slotId: slot.slotId, index: slot.index, acceptedAnswer: answer });
    }
  }

  return mapped;
}

function tryApplyParsedToSlots(
  question: QuestionDraft,
  slots: AnswerFillSlot[],
  parsedParts: ParsedAnswerPart[],
): QuestionDraft | null {
  const answers = parsedParts.filter((part) => sanitizeAnswerForApply(part.answer));
  if (!answers.length) return null;

  if (answers.length === slots.length) {
    const positional = applyAnswersToFillSlots(
      question,
      slots,
      answers.map((part, index) => ({
        slotId: slots[index]!.slotId,
        index,
        acceptedAnswer: part.answer,
      })),
    );
    if (countFilledAnswerSlots(positional) >= Math.ceil(slots.length * 0.6)) {
      return positional;
    }
  }

  const byKey = mapParsedPartsToSlots(slots, answers);
  if (!byKey.length) return null;

  const keyed = applyAnswersToFillSlots(question, slots, byKey);
  if (countFilledAnswerSlots(keyed) >= Math.ceil(slots.length * 0.5)) {
    return keyed;
  }

  return null;
}

/** Nodent-tagged blocks: [[QUESTION]], [[PART a]], [[TEXT]], [[ANSWER]] */
function parseStructuredAnswerBlock(text: string): {
  questionText?: string;
  parts: ParsedAnswerPart[];
} {
  const parts: ParsedAnswerPart[] = [];
  const questionMatch = text.match(
    /\[\[QUESTION\]\]\s*([\s\S]*?)(?=\[\[PART|\[\[TEXT\]\]|\[\[ANSWER\]\]|$)/i,
  );
  const questionText = questionMatch?.[1]?.trim();

  // Primary: [[TEXT]] + [[ANSWER]] pairs — ignores broken [[PART]] tags from GPT.
  const pairRe =
    /\[\[TEXT\]\]\s*([^\n]+)\s*\n\s*\[\[ANSWER\]\]\s*([^\n]+)/gi;
  let pairMatch: RegExpExecArray | null;
  let order = 0;
  while ((pairMatch = pairRe.exec(text)) !== null) {
    const label = (pairMatch[1] ?? "").trim();
    const answer = sanitizeAnswerForApply(pairMatch[2] ?? "");
    if (!label || !answer) continue;
    const { key, subIndex } = parsePartLabelMeta(label);
    parts.push({ key, subIndex, label, answer, order: order++ });
  }
  if (!parts.length) {
    const pairReNextLine =
      /\[\[TEXT\]\]\s*([^\n]+)\s*\n\s*\[\[ANSWER\]\]\s*\n\s*([^\n]+)/gi;
    while ((pairMatch = pairReNextLine.exec(text)) !== null) {
      const label = (pairMatch[1] ?? "").trim();
      const answer = sanitizeAnswerForApply(pairMatch[2] ?? "");
      if (!label || !answer) continue;
      const { key, subIndex } = parsePartLabelMeta(label);
      parts.push({ key, subIndex, label, answer, order: order++ });
    }
  }
  if (parts.length) return { questionText, parts };

  const partBlocks = text.split(/\[\[PART\s*([a-z0-9]+)\]\]/gi);
  if (partBlocks.length > 1) {
    order = 0;
    for (let i = 1; i < partBlocks.length; i += 2) {
      const tagKey = (partBlocks[i] ?? "").toLowerCase();
      const body = partBlocks[i + 1] ?? "";
      const label =
        body.match(/\[\[TEXT\]\]\s*([^\n]+)/i)?.[1]?.trim() ??
        body.match(/(?:^|\n)\s*Question\s*[:\-–—]\s*([^\n]+)/i)?.[1]?.trim() ??
        `${tagKey})`;
      const answer =
        body.match(/\[\[ANSWER\]\]\s*([^\n]+)/i)?.[1]?.trim() ??
        body.match(/(?:^|\n)\s*Answer\s*[:\-–—]\s*([^\n]+)/i)?.[1]?.trim() ??
        "";
      const cleaned = sanitizeAnswerForApply(answer);
      if (!cleaned) continue;
      const { key, subIndex } = parsePartLabelMeta(label);
      const effectiveKey = isValidAnswerKey(key) ? key : tagKey.charAt(0) ?? "a";
      parts.push({
        key: effectiveKey,
        subIndex,
        label,
        answer: cleaned,
        order: order++,
      });
    }
    if (parts.length) return { questionText, parts };
  }

  const textAnswerRe =
    /(?:^|\n)\s*(?:Part\s*)?([a-z])\s*[.):]?\s*\n\s*(?:\[\[TEXT\]\]\s*|Question\s*[:\-–—]\s*)?([^\n]+)\s*\n\s*(?:\[\[ANSWER\]\]\s*|Answer\s*[:\-–—]\s*)([^\n]+)/gi;
  order = 0;
  while ((pairMatch = textAnswerRe.exec(text)) !== null) {
    const key = (pairMatch[1] ?? "").toLowerCase();
    const label = (pairMatch[2] ?? `${key})`).trim();
    const answer = sanitizeAnswerForApply(pairMatch[3] ?? "");
    if (answer) {
      const { subIndex } = parsePartLabelMeta(label);
      parts.push({ key, subIndex, label, answer, order: order++ });
    }
  }

  return { questionText, parts };
}

function romanSubIndex(raw: string): number | null {
  const token = raw.trim().toLowerCase();
  if (/^i{1,3}$/.test(token)) return token.length;
  if (token === "iv") return 4;
  if (token === "v") return 5;
  if (/^vi{0,3}$/.test(token)) return 5 + (token.length - 1);
  if (token === "ix") return 9;
  if (/^x/i.test(token)) return 10;
  if (/^\d+$/.test(token)) return Number.parseInt(token, 10);
  return null;
}

/** VCAA solutions: "1b.i. 11.42 g", "b) 14.1 g", "a. 2" */
function parseVceSolutionParts(text: string): ParsedAnswerPart[] {
  const cleaned = stripExamBoilerplate(text);
  const parts: ParsedAnswerPart[] = [];

  for (const line of cleaned.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = trimmed.match(
      /^(?:(?:question\s*)?\d+\s*)?([a-z])(?:\.(i{1,3}|iv|v|vi{0,3}|ix|x|xi{0,3}|\d+|[a-z]))*\s*[.)]?\s+(.+)$/i,
    );
    if (!match?.[1] || !match[3]) continue;

    const key = match[1].toLowerCase();
    if (!isValidAnswerKey(key)) continue;

    const subRaw = match[2]?.trim();
    const subIndex = subRaw ? romanSubIndex(subRaw) : null;
    const answer = sanitizeAnswerForApply(match[3]);
    if (!answer) continue;

    parts.push({
      key,
      subIndex,
      label: subRaw ? `${key}.${subRaw})` : `${key})`,
      answer,
      order: parts.length,
    });
  }

  return parts;
}

function isLikelyMatrixFalsePositive(key: string, rawAnswer: string): boolean {
  const answer = rawAnswer.trim();
  if (!/^[kmxyz]$/i.test(key)) return false;
  return /^[=[]/.test(answer);
}

/**
 * VCAA-style answer keys: "1a. 2", "1b.i. 11.42 g", "Q2c volume" — including one-line PDF extracts.
 * Returns answers grouped by question number, in document order.
 */
export function parseVcaaAnswerKeyByQuestion(text: string): Map<number, ParsedAnswerPart[]> {
  const cleaned = stripExamBoilerplate(text).replace(/\r\n/g, "\n");
  const byQuestion = new Map<number, ParsedAnswerPart[]>();
  if (!cleaned.trim()) return byQuestion;

  const pushPart = (qNum: number, key: string, subRaw: string | undefined, rawAnswer: string) => {
    if (!Number.isFinite(qNum) || qNum < 1 || qNum > 60 || !isValidAnswerKey(key)) return;
    if (isLikelyMatrixFalsePositive(key, rawAnswer)) return;
    const answer = sanitizeAnswerForApply(rawAnswer);
    if (!answer) return;
    const list = byQuestion.get(qNum) ?? [];
    list.push({
      key,
      subIndex: subRaw ? romanSubIndex(subRaw) : null,
      label: subRaw ? `${key}.${subRaw})` : `${key})`,
      answer,
      order: list.length,
    });
    byQuestion.set(qNum, list);
  };

  // Table rows: "1 a 2", "1 b.i 11.42 g", "1a 2"
  for (const line of cleaned.split(/\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^Question\s+\d/i.test(trimmed)) continue;
    if (/^\[\[/.test(trimmed)) continue;

    const tableRow = trimmed.match(
      /^(?:Q(?:uestion)?\s*)?(\d{1,2})\s+([a-z])(?:\.(i{1,3}|iv))?\s+(.+)$/i,
    );
    if (tableRow?.[1] && tableRow[2] && tableRow[4]) {
      pushPart(
        Number(tableRow[1]),
        tableRow[2].toLowerCase(),
        tableRow[3]?.toLowerCase(),
        tableRow[4],
      );
      continue;
    }

    const gluedRow = trimmed.match(
      /^(?:Q(?:uestion)?\s*)?(\d{1,2})\s*([a-z])(?:\.(i{1,3}|iv))?\s*[.:)]?\s+(.+)$/i,
    );
    if (gluedRow?.[1] && gluedRow[2] && gluedRow[4]) {
      pushPart(
        Number(gluedRow[1]),
        gluedRow[2].toLowerCase(),
        gluedRow[3]?.toLowerCase(),
        gluedRow[4],
      );
    }
  }

  if (byQuestion.size > 0) return byQuestion;

  const headerRe =
    /(?:^|[\n;]|\s)(?:Q(?:uestion)?\s*)?(\d{1,2})\s*([a-z])(?:\.(i{1,3}|iv))?\s*(?:\.\s+|\)\s+|\s+(?!\s))/gi;

  type Hit = {
    qNum: number;
    key: string;
    subIndex: number | null;
    subRaw?: string;
    start: number;
    answerStart: number;
  };
  const hits: Hit[] = [];
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(cleaned)) !== null) {
    const qNum = Number(m[1]);
    const key = (m[2] ?? "").toLowerCase();
    if (!Number.isFinite(qNum) || qNum < 1 || qNum > 60 || !isValidAnswerKey(key)) continue;
    const subRaw = m[3]?.toLowerCase();
    hits.push({
      qNum,
      key,
      subIndex: subRaw ? romanSubIndex(subRaw) : null,
      subRaw,
      start: m.index,
      answerStart: m.index + m[0].length,
    });
  }

  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i]!;
    const answerEnd = i + 1 < hits.length ? hits[i + 1]!.start : cleaned.length;
    let rawAnswer = cleaned.slice(hit.answerStart, answerEnd).trim();
    rawAnswer = rawAnswer.replace(/^[;|]\s*/, "").replace(/[;\s]+$/, "").trim();
    pushPart(hit.qNum, hit.key, hit.subRaw, rawAnswer);
  }

  return byQuestion;
}

function parseAnswerPartsLoose(text: string): ParsedAnswerPart[] {
  const vcaaByQ = parseVcaaAnswerKeyByQuestion(text);
  const flat = [...vcaaByQ.values()].flat();
  if (flat.length) return flat;

  const vce = parseVceSolutionParts(text);
  if (vce.length) return vce;

  const cleaned = stripExamBoilerplate(text);
  const parts: ParsedAnswerPart[] = [];

  const pairedRe =
    /(?:^|\n)\s*\(?([a-z])\)?\s*[.)]\s*([^\n]+?)\s*\n\s*Answer\s*[:\-–—]\s*([^\n]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = pairedRe.exec(cleaned)) !== null) {
    const key = (match[1] ?? "").toLowerCase();
    const label = (match[2] ?? `${key})`).trim();
    const answer = sanitizeAnswerForApply(match[3] ?? "");
    if (answer) {
      const { subIndex } = parsePartLabelMeta(label);
      parts.push({ key, subIndex, label, answer, order: parts.length });
    }
  }
  if (parts.length) return parts;

  const patterns = [
    /(?:^|\n)\s*\(([a-z])\)\s*([^\n]+)/gi,
    /(?:^|\n)\s*([a-z])\s*[.)]\s*([^\n]+)/gi,
  ];

  for (const pattern of patterns) {
    parts.length = 0;
    while ((match = pattern.exec(cleaned)) !== null) {
      const key = (match[1] ?? "").toLowerCase();
      if (!isValidAnswerKey(key)) continue;
      const raw = (match[2] ?? "").trim();
      const answer = sanitizeAnswerForApply(raw);
      if (answer) {
        parts.push({
          key,
          label: `${key}) ${raw}`,
          answer,
          order: parts.length,
        });
      }
    }
    if (parts.length) break;
  }

  return parts;
}

export function extractQuestionNumberFromId(id: string): number | null {
  const s = String(id ?? "").trim();
  if (!s) return null;
  const qMatch =
    s.match(/(?:^|[-_.])q(\d{1,2})(?:[-_.]|$)/i) ??
    s.match(/^q(\d{1,2})$/i) ??
    s.match(/^(\d{1,2})$/);
  if (!qMatch?.[1]) return null;
  const n = Number(qMatch[1]);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

/** Split GPT / Nodent answer keys on "Question 1", "Question 2", … */
export function splitAnswerKeyByQuestionHeaders(text: string): Map<number, string> {
  const cleaned = String(text ?? "").replace(/\r\n/g, "\n");
  const result = new Map<number, string>();
  const matches = [...cleaned.matchAll(/(?:^|\n)\s*Question\s+(\d{1,2})\s*(?:\n|$)/gi)];
  if (!matches.length) return result;

  for (let i = 0; i < matches.length; i++) {
    const num = Number(matches[i]![1]);
    if (!Number.isFinite(num)) continue;
    const start = (matches[i]!.index ?? 0) + matches[i]![0].length;
    const end =
      i + 1 < matches.length ? (matches[i + 1]!.index ?? cleaned.length) : cleaned.length;
    const block = cleaned.slice(start, end).trim();
    if (block) result.set(num, block);
  }
  return result;
}

function prefixLocalPartLinesForQuestion(block: string, qNum: number): string {
  return block
    .split(/\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (/^(?:Question|Q(?:uestion)?)\s*\d/i.test(trimmed)) return line;
      if (/^(?:Q(?:uestion)?\s*)?\d{1,2}\s*[a-z]/i.test(trimmed)) return line;
      if (/^(?:Q(?:uestion)?\s*)?\d{1,2}[a-z]/i.test(trimmed)) return line;
      if (/^Answer\s*:/i.test(trimmed)) return line;
      if (/^\[\[/.test(trimmed)) return line;
      const local = trimmed.match(/^([a-z])(?:\.(i{1,3}|iv))?\.\s+(.+)$/i);
      if (local) return `${qNum}${trimmed}`;
      const paren = trimmed.match(/^([a-z])\)\s+(.+)$/i);
      if (paren?.[1] && paren[2]) return `${qNum}${paren[1]}. ${paren[2]}`;
      return line;
    })
    .join("\n");
}

function parseAnswerKeyBlock(
  block: string,
  qNum: number,
): { mcqAnswer?: string; parts: ParsedAnswerPart[] } {
  const mcqAnswer = parseMcqAnswer(block);

  const structured = parseStructuredAnswerBlock(block);
  if (structured.parts.length) {
    return { mcqAnswer: mcqAnswer ?? undefined, parts: structured.parts };
  }

  const prefixed = prefixLocalPartLinesForQuestion(block, qNum);
  const vcaaParts = parseVcaaAnswerKeyByQuestion(prefixed).get(qNum) ?? [];
  if (vcaaParts.length) {
    return { mcqAnswer: mcqAnswer ?? undefined, parts: vcaaParts };
  }

  const directVcaa = parseVcaaAnswerKeyByQuestion(block).get(qNum) ?? [];
  if (directVcaa.length) {
    return { mcqAnswer: mcqAnswer ?? undefined, parts: directVcaa };
  }

  if (mcqAnswer) {
    return { mcqAnswer, parts: [] };
  }

  return { parts: [] };
}

/** Parse a full GPT-formatted answer key document. */
export function parseAnswerKeyDocument(text: string): Map<number, ParsedAnswerQuestion> {
  const result = new Map<number, ParsedAnswerQuestion>();
  const byHeader = splitAnswerKeyByQuestionHeaders(text);

  if (byHeader.size > 0) {
    for (const [qNum, block] of byHeader) {
      const { mcqAnswer, parts } = parseAnswerKeyBlock(block, qNum);
      if (parts.length || mcqAnswer) {
        result.set(qNum, { questionNumber: qNum, parts, mcqAnswer });
      }
    }
    return result;
  }

  const structured = parseStructuredAnswerBlock(text);
  if (structured.parts.length) {
    result.set(1, { questionNumber: 1, parts: structured.parts });
    return result;
  }

  for (const [qNum, parts] of parseVcaaAnswerKeyByQuestion(text)) {
    if (parts.length) {
      result.set(qNum, { questionNumber: qNum, parts });
    }
  }
  return result;
}

function parseAnswerBlock(text: string): Omit<ParsedAnswerQuestion, "questionNumber"> {
  const mcqAnswer = parseMcqAnswer(text);

  const structured = parseStructuredAnswerBlock(text);
  if (structured.parts.length) {
    return {
      mcqAnswer,
      questionText: structured.questionText,
      parts: structured.parts,
    };
  }

  const byDoc = parseAnswerKeyDocument(text);
  if (byDoc.size === 1) {
    const only = [...byDoc.values()][0]!;
    return { mcqAnswer: only.mcqAnswer ?? mcqAnswer, parts: only.parts };
  }
  if (byDoc.size > 1) {
    const flat = [...byDoc.values()].flatMap((q) => q.parts);
    if (flat.length) return { mcqAnswer, parts: flat };
  }

  const vcaaByQ = parseVcaaAnswerKeyByQuestion(text);
  const vcaaFlat = [...vcaaByQ.values()].flat();
  if (vcaaFlat.length) {
    return { mcqAnswer, parts: vcaaFlat };
  }

  const looseParts = parseAnswerPartsLoose(text);
  if (looseParts.length) {
    return { mcqAnswer, parts: looseParts };
  }

  const { parts } = detectLetterSubparts(text);
  if (parts.length) {
    return {
      mcqAnswer,
      parts: parts
        .map((part, index) => ({
          key: part.label.toLowerCase(),
          label: part.descriptor || `${part.label})`,
          answer: sanitizeAnswerForApply(part.body),
          order: index,
        }))
        .filter((part) => part.answer),
    };
  }

  const stemMatch = text.match(
    /(?:^|\n)\s*(?:\[\[QUESTION\]\]|QUESTION|Question text|Stem)\s*[:\-–—]?\s*([\s\S]*?)(?=\n\s*(?:Part|[a-z]\)|\[\[PART))/i,
  );

  const lines = stripExamBoilerplate(text)
    .split(/\n+/)
    .map((line) => sanitizeAnswerForApply(line))
    .filter(Boolean);

  if (lines.length === 1) {
    const inlineVcaa = parseVcaaAnswerKeyByQuestion(text);
    const inlineParts = [...inlineVcaa.values()].flat();
    if (inlineParts.length) {
      return { mcqAnswer, parts: inlineParts };
    }
    const lone = sanitizeAnswerForApply(lines[0]!);
    if (lone && lone.length < 200) {
      return {
        mcqAnswer,
        questionText: stemMatch?.[1]?.trim(),
        parts: [],
        singleAnswer: lone,
      };
    }
    return { mcqAnswer, questionText: stemMatch?.[1]?.trim(), parts: [] };
  }

  if (lines.length > 1 && !mcqAnswer) {
    return {
      mcqAnswer,
      questionText: stemMatch?.[1]?.trim(),
      parts: lines.map((answer, index) => ({
        key: String.fromCharCode(97 + index),
        label: `${String.fromCharCode(97 + index)})`,
        answer,
        order: index,
      })),
    };
  }

  const singleAnswer = sanitizeAnswerForApply(text);
  return {
    mcqAnswer,
    questionText: stemMatch?.[1]?.trim(),
    parts: [],
    singleAnswer: singleAnswer || undefined,
  };
}

function splitOverlayAnswers(answerText: string): string[] {
  return answerText
    .split(/\n+|;\s*|\|\s*/)
    .map((line) => sanitizeAnswerForApply(line.replace(/^\d+[.)]\s*/, "")))
    .filter(Boolean);
}

function flattenParsedAnswers(parsed: ParsedAnswerQuestion): string[] {
  if (parsed.parts.length) return parsed.parts.map((part) => part.answer).filter(Boolean);
  if (parsed.singleAnswer) return splitOverlayAnswers(parsed.singleAnswer);
  return [];
}

function questionUsesMultipartLayout(question: QuestionDraft): boolean {
  return (
    question.multipartEnabled ||
    question.answerParts.length >= 2 ||
    question.answerParts.some(
      (part) =>
        Boolean(part.imageUrl?.trim()) ||
        Boolean(part.label?.trim()) ||
        partUsesFigureLabels(part),
    )
  );
}

function isMinimalPartLabel(label: string): boolean {
  return /^[a-z]\)?\s*$/i.test(String(label ?? "").trim());
}

/** Match draft parts to parsed parts by question text, not just letter index. */
export function matchParsedPartsToDraft(
  draftParts: MultipartPartDraft[],
  parsedParts: ParsedAnswerPart[],
): Map<number, ParsedAnswerPart> {
  const assignments = new Map<number, ParsedAnswerPart>();
  const usedParsed = new Set<number>();

  const candidates: Array<{ draftIndex: number; parsedIndex: number; score: number }> = [];
  draftParts.forEach((draftPart, draftIndex) => {
    parsedParts.forEach((parsedPart, parsedIndex) => {
      const labelScore = matchTextScore(draftPart.label, parsedPart.label);
      const key = (draftPart.key?.trim() || String.fromCharCode(97 + draftIndex)).toLowerCase();
      const keyMatch = parsedPart.key === key;
      const minimalLabel = isMinimalPartLabel(parsedPart.label);
      if (!keyMatch && labelScore < 0.55) return;
      const score = keyMatch && minimalLabel ? 0.9 : labelScore + (keyMatch ? 0.2 : 0);
      if (score >= 0.55) {
        candidates.push({ draftIndex, parsedIndex, score });
      }
    });
  });

  candidates
    .sort((a, b) => b.score - a.score)
    .forEach(({ draftIndex, parsedIndex, score }) => {
      if (assignments.has(draftIndex) || usedParsed.has(parsedIndex)) return;
      if (score < 0.55) return;
      assignments.set(draftIndex, parsedParts[parsedIndex]!);
      usedParsed.add(parsedIndex);
    });

  draftParts.forEach((draftPart, draftIndex) => {
    if (assignments.has(draftIndex)) return;
    const key = draftPartKey(draftPart, draftIndex);
    const parsedIndex = parsedParts.findIndex(
      (parsedPart, index) =>
        !usedParsed.has(index) && parsedPart.key === key && isValidAnswerKey(parsedPart.key),
    );
    if (parsedIndex >= 0) {
      assignments.set(draftIndex, parsedParts[parsedIndex]!);
      usedParsed.add(parsedIndex);
    }
  });

  // Same letter, in order: b)1 then b)2 → first b part, then second b part.
  for (const letter of "abcdefghijklmnopqrstuvwxyz") {
    const draftIndices = draftParts
      .map((_, index) => index)
      .filter((index) => !assignments.has(index) && draftPartKey(draftParts[index]!, index) === letter);
    const parsedIndices = parsedParts
      .map((_, index) => index)
      .filter((index) => !usedParsed.has(index) && parsedParts[index]!.key === letter)
      .sort((a, b) => (parsedParts[a]!.order ?? a) - (parsedParts[b]!.order ?? b));
    for (let i = 0; i < Math.min(draftIndices.length, parsedIndices.length); i++) {
      assignments.set(draftIndices[i]!, parsedParts[parsedIndices[i]!]!);
      usedParsed.add(parsedIndices[i]!);
    }
  }

  const unassignedDraft = draftParts.map((_, index) => index).filter((index) => !assignments.has(index));
  const unassignedParsed = parsedParts
    .map((_, index) => index)
    .filter((index) => !usedParsed.has(index))
    .sort((a, b) => (parsedParts[a]!.order ?? a) - (parsedParts[b]!.order ?? b));
  if (
    unassignedDraft.length > 0 &&
    unassignedDraft.length === unassignedParsed.length
  ) {
    unassignedDraft.forEach((draftIndex, index) => {
      assignments.set(draftIndex, parsedParts[unassignedParsed[index]!]!);
    });
  }

  return assignments;
}

function applyMatchedAnswer(part: MultipartPartDraft, matched: ParsedAnswerPart | undefined): string {
  return sanitizeAnswerForApply(matched?.answer) || part.acceptedAnswer || "";
}

type AnswerSlot = {
  partIndex: number;
  overlayIndex?: number;
};

function listAnswerSlots(question: QuestionDraft): AnswerSlot[] {
  const slots: AnswerSlot[] = [];
  const { stimulusOverlays, multipartParts, multipartIndices } = partitionAnswerParts(
    question.answerParts,
  );

  if (question.labelDiagramEnabled) {
    question.answerParts.forEach((part, partIndex) => {
      if (stimulusOverlays.includes(part)) slots.push({ partIndex });
    });
  }

  multipartParts.forEach((part, index) => {
    const partIndex = multipartIndices[index]!;
    if (partUsesFigureLabels(part) && part.labelOverlays?.length) {
      part.labelOverlays.forEach((_, overlayIndex) => slots.push({ partIndex, overlayIndex }));
    } else {
      slots.push({ partIndex });
    }
  });

  return slots;
}

export function countDraftAnswerSlots(question: QuestionDraft): number {
  return buildAnswerFillSlots(question).length;
}

function applyAnswersBySlotOrder(
  question: QuestionDraft,
  parsedParts: ParsedAnswerPart[],
): QuestionDraft {
  const slots = buildAnswerFillSlots(question);
  if (!slots.length || slots.length !== parsedParts.length) return question;
  return applyAnswersToFillSlots(
    question,
    slots,
    parsedParts.map((part, index) => ({
      slotId: String(index),
      index,
      acceptedAnswer: part.answer,
    })),
  );
}

function applyParsedPartsToDraftParts(
  draftParts: MultipartPartDraft[],
  parsedParts: ParsedAnswerPart[],
): MultipartPartDraft[] {
  if (parsedParts.length === draftParts.length && parsedParts.length > 0) {
    const byLabel = matchParsedPartsToDraft(draftParts, parsedParts);
    let strongMatches = 0;
    byLabel.forEach((matched, draftIndex) => {
      if (matchTextScore(draftParts[draftIndex]!.label, matched.label) >= 0.55) {
        strongMatches += 1;
      }
    });
    if (strongMatches < Math.ceil(parsedParts.length / 2)) {
      return draftParts.map((part, index) => {
        const matched = parsedParts[index];
        if (partUsesFigureLabels(part) && part.labelOverlays?.length) {
          const overlayAnswers = matched?.answer ? splitOverlayAnswers(matched.answer) : [];
          return {
            ...part,
            labelOverlays: part.labelOverlays.map((overlay, overlayIndex) => ({
              ...overlay,
              acceptedAnswer:
                sanitizeAnswerForApply(overlayAnswers[overlayIndex]) ||
                overlay.acceptedAnswer ||
                "",
            })),
          };
        }
        return {
          ...part,
          acceptedAnswer: applyMatchedAnswer(part, matched),
        };
      });
    }
  }

  const byLabel = matchParsedPartsToDraft(draftParts, parsedParts);
  return draftParts.map((part, index) => {
    const matched = byLabel.get(index);
    if (partUsesFigureLabels(part) && part.labelOverlays?.length) {
      const overlayAnswers = matched?.answer ? splitOverlayAnswers(matched.answer) : [];
      return {
        ...part,
        labelOverlays: part.labelOverlays.map((overlay, overlayIndex) => ({
          ...overlay,
          acceptedAnswer:
            sanitizeAnswerForApply(overlayAnswers[overlayIndex]) ||
            overlay.acceptedAnswer ||
            "",
        })),
      };
    }
    return {
      ...part,
      acceptedAnswer: applyMatchedAnswer(part, matched),
    };
  });
}

export function applyParsedAnswerToQuestion(
  question: QuestionDraft,
  parsed: ParsedAnswerQuestion | undefined,
): QuestionDraft {
  if (!parsed) return question;

  const flatAnswers = flattenParsedAnswers(parsed);
  const { stimulusOverlays, multipartParts, multipartIndices } = partitionAnswerParts(
    question.answerParts,
  );

  if (question.type === "mcq") {
    if (parsed.mcqAnswer) return { ...question, correctAnswer: parsed.mcqAnswer };
    if (flatAnswers.length === 1) {
      const letter = flatAnswers[0]!.trim().toUpperCase();
      if (/^[A-D]$/.test(letter)) return { ...question, correctAnswer: letter };
    }
  }

  if (parsed.parts.length) {
    const slotCount = countDraftAnswerSlots(question);
    if (slotCount > 0 && slotCount === parsed.parts.length) {
      const byOrder = applyAnswersBySlotOrder(question, parsed.parts);
      if (JSON.stringify(byOrder) !== JSON.stringify(question)) {
        return byOrder;
      }
    }

    const nextParts = [...question.answerParts];

    if (question.labelDiagramEnabled && stimulusOverlays.length) {
      const updatedOverlays = applyParsedPartsToDraftParts(
        stimulusOverlays,
        parsed.parts,
      );
      stimulusOverlays.forEach((part, index) => {
        const globalIndex = question.answerParts.indexOf(part);
        if (globalIndex >= 0) nextParts[globalIndex] = updatedOverlays[index]!;
      });
    }

    if (multipartParts.length) {
      const updatedMultipart = applyParsedPartsToDraftParts(multipartParts, parsed.parts);
      multipartParts.forEach((part, index) => {
        const globalIndex = multipartIndices[index]!;
        nextParts[globalIndex] = updatedMultipart[index]!;
      });
      return {
        ...question,
        multipartEnabled: true,
        answerParts: nextParts,
      };
    }

    if (question.labelDiagramEnabled && stimulusOverlays.length) {
      return { ...question, answerParts: nextParts };
    }
  }

  const hasFigureOverlays = question.answerParts.some((part) => partUsesFigureLabels(part));
  if (hasFigureOverlays && parsed.parts.length) {
    return {
      ...question,
      multipartEnabled: true,
      answerParts: applyParsedPartsToDraftParts(question.answerParts, parsed.parts),
    };
  }

  if (questionUsesMultipartLayout(question) && parsed.parts.length) {
    return {
      ...question,
      multipartEnabled: true,
      answerParts: applyParsedPartsToDraftParts(question.answerParts, parsed.parts),
    };
  }

  const single = sanitizeAnswerForApply(
    parsed.singleAnswer ??
      parsed.parts.map((part) => part.answer).filter(Boolean).join("\n") ??
      flatAnswers.join("\n"),
  );
  if (!single) return question;
  return { ...question, acceptedAnswers: single };
}

export function parsePastedAnswers(text: string): ParsedAnswerQuestion {
  return { questionNumber: 1, ...parseAnswerBlock(text) };
}

export function applyPastedAnswerText(
  question: QuestionDraft,
  pastedText: string,
): { question: QuestionDraft; filled: boolean; warnings: string[] } {
  const warnings: string[] = [];
  if (!pastedText.trim()) return { question, filled: false, warnings };

  const parsed = parsePastedAnswers(pastedText);
  const hasContent =
    Boolean(parsed.mcqAnswer) ||
    parsed.parts.some((part) => part.answer) ||
    Boolean(parsed.singleAnswer);
  if (!hasContent) return { question, filled: false, warnings };

  const slotCount = countDraftAnswerSlots(question);
  if (slotCount > 0 && parsed.parts.length !== slotCount) {
    warnings.push(
      `Pasted ${parsed.parts.length} answer(s) but this question has ${slotCount} answer slot(s) in Nodent. Split into parts to match (e.g. separate b)1 and b)2, d)1–d)4).`,
    );
  }

  const updated = applyParsedAnswerToQuestion(question, parsed);
  return {
    question: updated,
    filled: JSON.stringify(updated) !== JSON.stringify(question),
    warnings,
  };
}

function cleanExportLine(text: string): string {
  return String(text ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function questionUsesMultipartExport(q: QuestionDraft): boolean {
  const { multipartParts } = partitionAnswerParts(q.answerParts);
  return (
    q.multipartEnabled ||
    multipartParts.length >= 2 ||
    multipartParts.some(
      (part) =>
        Boolean(part.imageUrl?.trim()) ||
        Boolean(
          part.label?.trim() &&
            part.label.trim() !== `${(part.key?.trim() || "a")})`,
        ),
    )
  );
}

function appendPartBlock(lines: string[], key: string, text: string): void {
  lines.push("");
  lines.push(`[[PART ${key}]]`);
  lines.push(`[[TEXT]] ${text}`);
  lines.push("[[ANSWER]]");
}

function buildQuestionAnswerTemplate(q: QuestionDraft, questionNumber: number): string {
  const lines: string[] = [`Question ${questionNumber}`];

  const stemParts: string[] = [];
  if (cleanExportLine(q.question)) stemParts.push(cleanExportLine(q.question));
  if (cleanExportLine(q.passage)) stemParts.push(cleanExportLine(q.passage));
  if (q.type === "mcq") {
    const options = q.options
      .map((opt, index) => {
        const letter = String.fromCharCode(65 + index);
        const text = cleanExportLine(opt);
        return text ? `${letter}) ${text}` : "";
      })
      .filter(Boolean);
    if (options.length) stemParts.push(...options);
  }

  lines.push(
    `[[QUESTION]] ${
      stemParts.join("\n") || "(add question text in Nodent first)"
    }`,
  );

  if (q.type === "mcq") {
    lines.push("Answer:");
    return lines.join("\n");
  }

  const { stimulusOverlays, multipartParts } = partitionAnswerParts(q.answerParts);
  const hasMultipart = questionUsesMultipartExport(q);

  if (q.labelDiagramEnabled && stimulusOverlays.length) {
    stimulusOverlays.forEach((part, index) => {
      const key = (part.key?.trim() || String.fromCharCode(97 + index)).toLowerCase();
      const label = cleanExportLine(part.label ?? "") || `Input box ${index + 1}`;
      appendPartBlock(lines, key, `${key}) ${label}`);
    });
  }

  if (hasMultipart) {
    const keyCounts = new Map<string, number>();
    multipartParts.forEach((part, index) => {
      const baseKey = (part.key?.trim() || String.fromCharCode(97 + index)).toLowerCase();
      const seen = (keyCounts.get(baseKey) ?? 0) + 1;
      keyCounts.set(baseKey, seen);
      const exportKey = seen > 1 ? `${baseKey}${seen}` : baseKey;

      if (partUsesFigureLabels(part)) {
        (part.labelOverlays ?? []).forEach((overlay, overlayIndex) => {
          const overlayKey = (overlay.key?.trim() || `${exportKey}${overlayIndex + 1}`).toLowerCase();
          const label = cleanExportLine(overlay.label ?? "") || `Box ${overlayIndex + 1}`;
          appendPartBlock(lines, overlayKey, `${baseKey}) ${label}`);
        });
        return;
      }
      const partText = cleanExportLine(part.label) || `${baseKey})`;
      appendPartBlock(lines, exportKey, partText);
    });
  }

  if (!hasMultipart && !(q.labelDiagramEnabled && stimulusOverlays.length)) {
    lines.push("");
    lines.push("[[ANSWER]]");
  }

  return lines.join("\n");
}

/** Pre-filled GPT prompt from questions already built in Create — paste solutions at the bottom. */
export function buildAnswerKeyGptTemplate(
  questions: QuestionDraft[],
  options?: { assessmentTitle?: string },
): string {
  const title = options?.assessmentTitle?.trim();
  const questionBlocks = questions.map((question, index) =>
    buildQuestionAnswerTemplate(question, index + 1),
  );

  return `You are filling in accepted answers for a test already built in Nodent.

TASK:
1. Read MY TEST below — every [[TEXT]] line is fixed teacher wording. Do NOT change it.
2. Read MY SOLUTIONS at the bottom (VCAA solutions, teacher key, annotated exam, etc.).
3. Output ONLY the completed answer key in the SAME structure, with short final answers on every [[ANSWER]] line (or "Answer: B" for MCQ).
4. Do NOT change any [[PART …]] tag or [[TEXT]] line — copy them exactly from MY TEST. Never replace question text with shorthand like "b) 1" or "d) 2".
5. Remove boilerplate (page headers, "2023 VCE…", long working). Skip solution parts not in MY TEST.
6. If MY TEST has one part per letter but solutions have sub-parts (b.i, b.ii, d.i–d.iv), still only fill the parts listed in MY TEST.

${title ? `Assessment: ${title}\n` : ""}MY TEST (structure only — fill in answers from solutions):
---
${questionBlocks.join("\n\n")}
---

MY SOLUTIONS (paste below this line):

`;
}

export type AiFillAnswersResult = {
  correctAnswer?: string;
  acceptedAnswers?: string;
  parts: Array<{
    slotId?: string;
    index: number;
    acceptedAnswer?: string;
    overlays?: Array<{ index: number; acceptedAnswer?: string }>;
  }>;
  message?: string;
};

type AnswerFillSlot = {
  slotId: string;
  index: number;
  partIndex: number;
  overlayIndex?: number;
  key: string;
  label: string;
  marks?: number;
};

function isPlaceholderPart(part: MultipartPartDraft, partIndex: number): boolean {
  const key = draftPartKey(part, partIndex);
  const label = part.label?.trim() ?? "";
  if (part.imageUrl?.trim()) return false;
  if (partUsesFigureLabels(part)) return false;
  if (part.acceptedAnswer?.trim()) return false;
  return !label || label === `${key})` || label === `${key}`;
}

function questionUsesRealMultipart(
  question: QuestionDraft,
  multipartParts: MultipartPartDraft[],
  multipartIndices: number[],
): boolean {
  if (question.multipartEnabled) return multipartParts.length > 0;
  return multipartParts.some((part, index) => !isPlaceholderPart(part, multipartIndices[index]!));
}

function sharedStemForQuestion(question: QuestionDraft): string {
  return [question.question, question.passage].filter(Boolean).join("\n\n").trim();
}

function buildAnswerFillSlots(question: QuestionDraft): AnswerFillSlot[] {
  const slots: AnswerFillSlot[] = [];
  const stem = sharedStemForQuestion(question);
  const { stimulusOverlays, multipartParts, multipartIndices } = partitionAnswerParts(
    question.answerParts,
  );

  if (question.type === "mcq") {
    const options = question.options
      .map((opt, index) => {
        const letter = String.fromCharCode(65 + index);
        const text = opt.trim();
        return text ? `${letter}) ${text}` : "";
      })
      .filter(Boolean);
    return [
      {
        slotId: "0",
        index: 0,
        partIndex: 0,
        key: "mcq",
        label: [stem, ...options].filter(Boolean).join("\n"),
        marks: question.marks,
      },
    ];
  }

  const useMultipart = questionUsesRealMultipart(question, multipartParts, multipartIndices);
  let slotIndex = 0;

  if (question.labelDiagramEnabled) {
    question.answerParts.forEach((part, partIndex) => {
      if (!stimulusOverlays.includes(part)) return;
      const key = part.key?.trim() || String.fromCharCode(97 + partIndex);
      slots.push({
        slotId: String(slotIndex),
        index: slotIndex++,
        partIndex,
        key,
        label: [stem, part.label?.trim() || `Input ${key}`].filter(Boolean).join("\n\n"),
        marks: part.marks,
      });
    });
  }

  if (useMultipart) {
    const partKeys = multipartParts.map((part, idx) =>
      slotKeyFromPart(part, multipartIndices[idx]!),
    );
    const keyTotals = partKeys.reduce<Map<string, number>>((acc, key) => {
      acc.set(key, (acc.get(key) ?? 0) + 1);
      return acc;
    }, new Map());
    const keySeen = new Map<string, number>();

    multipartParts.forEach((part, idx) => {
      const partIndex = multipartIndices[idx]!;
      const key = partKeys[idx]!;
      const partLabel = part.label?.trim() || `${key})`;
      const keyOrdinal = (keySeen.get(key) ?? 0) + 1;
      keySeen.set(key, keyOrdinal);
      const keyHint =
        (keyTotals.get(key) ?? 0) > 1
          ? ` (sub-part ${keyOrdinal} of ${keyTotals.get(key)})`
          : "";

      if (partUsesFigureLabels(part) && part.labelOverlays?.length) {
        part.labelOverlays.forEach((overlay, overlayIndex) => {
          slots.push({
            slotId: String(slotIndex),
            index: slotIndex++,
            partIndex,
            overlayIndex,
            key,
            label: `${partLabel}${keyHint} — input box ${overlay.label?.trim() || overlayIndex + 1}`,
            marks: overlay.marks ?? part.marks,
          });
        });
        return;
      }

      slots.push({
        slotId: String(slotIndex),
        index: slotIndex++,
        partIndex,
        key,
        label: stem ? `${stem}\n\n${partLabel}${keyHint}` : `${partLabel}${keyHint}`,
        marks: part.marks,
      });
    });
  } else if (!slots.length) {
    slots.push({
      slotId: "0",
      index: 0,
      partIndex: 0,
      key: "a",
      label: stem || "Main question",
      marks: question.marks,
    });
  }

  return slots;
}

function countFilledAnswerSlots(question: QuestionDraft): number {
  let count = 0;
  if (question.type === "mcq") {
    return question.correctAnswer?.trim() ? 1 : 0;
  }
  const { multipartParts, multipartIndices } = partitionAnswerParts(question.answerParts);
  const useMultipart = questionUsesRealMultipart(question, multipartParts, multipartIndices);

  if (question.labelDiagramEnabled) {
    count += question.answerParts.filter(
      (part) => partHasOverlay(part) && part.acceptedAnswer?.trim(),
    ).length;
  }

  if (useMultipart) {
    for (const part of multipartParts) {
      if (partUsesFigureLabels(part) && part.labelOverlays?.length) {
        count += part.labelOverlays.filter((overlay) => overlay.acceptedAnswer?.trim()).length;
      } else if (part.acceptedAnswer?.trim()) {
        count += 1;
      }
    }
  } else if (question.acceptedAnswers?.trim()) {
    count = 1;
  }

  return count;
}

function applyAnswersToFillSlots(
  question: QuestionDraft,
  slots: AnswerFillSlot[],
  answers: Array<{ slotId?: string; index: number; acceptedAnswer?: string }>,
): QuestionDraft {
  const bySlotId = new Map(answers.filter((a) => a.slotId).map((a) => [a.slotId!, a]));
  const nextParts = question.answerParts.map((part) => ({
    ...part,
    labelOverlays: part.labelOverlays?.map((overlay) => ({ ...overlay })),
  }));

  for (const slot of slots) {
    const answer =
      bySlotId.get(slot.slotId)?.acceptedAnswer ??
      answers.find((entry) => entry.index === slot.index)?.acceptedAnswer;
    const cleaned = sanitizeAnswerForApply(answer);
    if (!cleaned) continue;

    const part = nextParts[slot.partIndex];
    if (!part) continue;

    if (slot.overlayIndex != null && part.labelOverlays?.length) {
      nextParts[slot.partIndex] = {
        ...part,
        labelOverlays: part.labelOverlays.map((overlay, overlayIndex) =>
          overlayIndex === slot.overlayIndex ? { ...overlay, acceptedAnswer: cleaned } : overlay,
        ),
      };
    } else {
      nextParts[slot.partIndex] = { ...part, acceptedAnswer: cleaned };
    }
  }

  return {
    ...question,
    multipartEnabled: question.multipartEnabled || slots.length >= 2,
    answerParts: nextParts,
  };
}

function tryRuleBasedFill(
  question: QuestionDraft,
  solutionsText: string,
): { question: QuestionDraft; filled: boolean; message?: string } | null {
  const slots = buildAnswerFillSlots(question);
  const parsed = parsePastedAnswers(solutionsText);
  const answers = parsed.parts.filter((part) => sanitizeAnswerForApply(part.answer));

  if (!answers.length && !parsed.mcqAnswer && !parsed.singleAnswer) return null;

  if (question.type === "mcq" && parsed.mcqAnswer) {
    const updated = { ...question, correctAnswer: parsed.mcqAnswer };
    return { question: updated, filled: true, message: "Matched MCQ answer from solutions." };
  }

  const slotApplied = tryApplyParsedToSlots(question, slots, answers);
  if (slotApplied) {
    const filled = countFilledAnswerSlots(slotApplied);
    return {
      question: slotApplied,
      filled: filled > 0,
      message: `Matched ${filled} of ${slots.length} answers from solutions.`,
    };
  }

  const { multipartParts, multipartIndices } = partitionAnswerParts(question.answerParts);
  if (!questionUsesRealMultipart(question, multipartParts, multipartIndices)) {
    const single = sanitizeAnswerForApply(
      parsed.singleAnswer ?? answers.map((part) => part.answer).join("\n"),
    );
    if (single) {
      return {
        question: { ...question, acceptedAnswers: single },
        filled: true,
        message: "Matched single answer from solutions.",
      };
    }
    return null;
  }

  const updatedParts = applyParsedPartsToDraftParts(multipartParts, answers);
  const nextParts = [...question.answerParts];
  multipartParts.forEach((_, index) => {
    const globalIndex = multipartIndices[index]!;
    nextParts[globalIndex] = updatedParts[index]!;
  });
  const updated = {
    ...question,
    multipartEnabled: true,
    answerParts: nextParts,
  };
  const filled = countFilledAnswerSlots(updated);
  if (filled >= Math.min(answers.length, slots.length) * 0.5) {
    return {
      question: updated,
      filled: true,
      message: `Matched ${filled} of ${slots.length} answers by part label.`,
    };
  }

  return null;
}

export function buildAiFillAnswersPayload(question: QuestionDraft) {
  const slots = buildAnswerFillSlots(question);
  const stem = sharedStemForQuestion(question);
  return {
    type: question.type,
    question: question.question,
    passage: question.passage,
    sharedStem: stem,
    options: question.options,
    slots: slots.map(({ slotId, index, key, label, marks }) => ({
      slotId,
      index,
      key,
      label,
      marks,
    })),
  };
}

export function applyAiFillAnswersResult(
  question: QuestionDraft,
  result: AiFillAnswersResult,
): QuestionDraft {
  const slots = buildAnswerFillSlots(question);
  const nextParts = question.answerParts.map((part) => ({
    ...part,
    labelOverlays: part.labelOverlays?.map((overlay) => ({ ...overlay })),
  }));

  for (const partResult of result.parts) {
    const slot =
      (partResult.slotId
        ? slots.find((entry) => entry.slotId === partResult.slotId)
        : undefined) ?? slots[partResult.index];
    if (!slot) continue;

    const part = nextParts[slot.partIndex];
    if (!part) continue;

    if (partResult.overlays?.length && part.labelOverlays?.length) {
      nextParts[slot.partIndex] = {
        ...part,
        labelOverlays: part.labelOverlays.map((overlay, overlayIndex) => {
          const match = partResult.overlays?.find((entry) => entry.index === overlayIndex);
          const cleaned = sanitizeAnswerForApply(match?.acceptedAnswer);
          return cleaned ? { ...overlay, acceptedAnswer: cleaned } : overlay;
        }),
      };
    } else if (partResult.acceptedAnswer) {
      const cleaned = sanitizeAnswerForApply(partResult.acceptedAnswer);
      if (!cleaned) continue;
      if (slot.overlayIndex != null && part.labelOverlays?.length) {
        nextParts[slot.partIndex] = {
          ...part,
          labelOverlays: part.labelOverlays.map((overlay, overlayIndex) =>
            overlayIndex === slot.overlayIndex
              ? { ...overlay, acceptedAnswer: cleaned }
              : overlay,
          ),
        };
      } else {
        nextParts[slot.partIndex] = {
          ...part,
          acceptedAnswer: cleaned,
        };
      }
    }
  }

  const useMultipart = slots.length >= 2;
  return {
    ...question,
    multipartEnabled: question.multipartEnabled || useMultipart,
    correctAnswer: result.correctAnswer ?? question.correctAnswer,
    acceptedAnswers:
      result.acceptedAnswers ??
      (slots.length === 1 && result.parts[0]?.acceptedAnswer
        ? result.parts[0].acceptedAnswer
        : question.acceptedAnswers),
    answerParts: nextParts,
  };
}

export async function fillDraftAnswersWithAi(
  question: QuestionDraft,
  solutionsText: string,
): Promise<{ question: QuestionDraft; filled: boolean; message?: string }> {
  const slots = buildAnswerFillSlots(question);

  const ruleBased = tryRuleBasedFill(question, solutionsText);
  if (ruleBased?.filled) {
    const filled = countFilledAnswerSlots(ruleBased.question);
    if (filled >= Math.max(1, Math.ceil(slots.length * 0.85))) {
      return ruleBased;
    }
  }

  const parsed = parsePastedAnswers(solutionsText);
  const parsedAnswers = parsed.parts.filter((part) => sanitizeAnswerForApply(part.answer));
  const reconciled = tryApplyParsedToSlots(question, slots, parsedAnswers);

  if (reconciled && countFilledAnswerSlots(reconciled) > 0) {
    return {
      question: reconciled,
      filled: true,
      message: `Matched ${countFilledAnswerSlots(reconciled)} of ${slots.length} answers from solutions.`,
    };
  }

  if (ruleBased?.filled) {
    return ruleBased;
  }

  return {
    question,
    filled: false,
    message: "Could not match answers from that solutions text — try manual paste.",
  };
}
