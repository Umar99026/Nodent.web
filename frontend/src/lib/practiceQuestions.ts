import type { AnswerPart, Question } from "@/lib/subjects";
import { legacyOverlaysToInlineInputs, readOverlayFromPart, coalesceAnswerPartsForInlineInputs, questionUsesInlineInputs, flattenPartAcceptedAnswers } from "@/lib/diagramLabels";
import { inferUseAiMarkingForImport } from "@/lib/questionAiMarking";
import { inferGeneralMathsAreaOfStudy } from "@/lib/generalMathsAreaTopic";
import { inferMethodsAreaOfStudy } from "@/lib/methodsAreaTopic";
import { inferSpecialistMathsAreaOfStudy } from "@/lib/specialistMathsAreaTopic";
import {
  extractMarkdownImageUrls,
  formatPartDescriptor,
  isRomanPartKey,
  normalizePartKey,
  normalizeMultipartAcceptedAnswers,
  normalizeMcqOptions,
  partLetterForIndex,
  repairMultipartQuestionStem,
  stripQuestionNumberPrefix,
} from "@/lib/questionDisplay";
import { GOOGLE_SHEETS_TOPIC_LABELS, topicTaxonomySubjectId } from "@/lib/mathSubjectTopics";
import { normalizeQuestionMathText } from "@/lib/questionMathText";
import { parseMarkBreakdown } from "@/lib/markBreakdown";
import { displayTopicLabel, isPracticeExamTopic } from "@/lib/topicDisplay";

function topicLabelListForSubject(subjectId: string): readonly string[] | undefined {
  const key = topicTaxonomySubjectId(canonicalSubjectId(subjectId));
  return GOOGLE_SHEETS_TOPIC_LABELS[key];
}

/** Trust admin-assigned topic labels that match the official subject taxonomy. */
function isAdminCanonicalTopic(subjectId: string, topic: string): boolean {
  const list = topicLabelListForSubject(subjectId);
  if (!list?.length) return false;
  const norm = topic.trim().toLowerCase();
  return list.some((t) => t.toLowerCase() === norm);
}

function inferPracticeTopic(
  subjectId: string,
  topicLabel: string,
  questionText: string,
  passage?: string,
): string {
  const sid = canonicalSubjectId(subjectId);
  if (isAdminCanonicalTopic(sid, topicLabel)) return topicLabel.trim();
  if (sid === "methods") {
    return inferMethodsAreaOfStudy(topicLabel, questionText, passage);
  }
  if (sid === "general-maths") {
    return inferGeneralMathsAreaOfStudy(topicLabel, questionText, passage);
  }
  if (sid === "demo") {
    return inferGeneralMathsAreaOfStudy(topicLabel, questionText, passage);
  }
  if (sid === "specialist-maths") {
    return inferSpecialistMathsAreaOfStudy(topicLabel, questionText, passage);
  }
  return topicLabel;
}

/**
 * Sheet / DB rows often use a human label; Practice URLs use baseSubjects `id`
 * (e.g. `methods`). Map common variants to the canonical id.
 */
const SUBJECT_ID_ALIASES: Record<string, string> = {
  "mathematical methods": "methods",
  "mathematical-methods": "methods",
  "math methods": "methods",
  mm: "methods",
  "general mathematics": "general-maths",
  "general maths": "general-maths",
  "general-mathematics": "general-maths",
  "further mathematics": "further-maths",
  "further maths": "further-maths",
  "specialist mathematics": "specialist-maths",
  "specialist maths": "specialist-maths",
};

export function canonicalSubjectId(raw: string): string {
  const s = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
  return SUBJECT_ID_ALIASES[s] ?? s;
}

function normalizeTopicLabel(raw: unknown): string {
  const topic = String(raw ?? "").trim();
  if (!topic) return "General";
  // Hide legacy placeholder topic names from old PDF test imports.
  if (/^(?:test(?:\s*pdf)?|pdf\s*test)$/i.test(topic)) return "General";
  if (isPracticeExamTopic(topic)) return "Practice exam";
  return topic;
}

function cleanQuestionText(raw: unknown): string {
  return normalizeQuestionMathText(raw);
}

function parseJsonArrayFromString(s: string): unknown[] | undefined {
  const trimmed = s.trim();
  if (!trimmed) return undefined;
  const tryParse = (t: string) => {
    try {
      const p = JSON.parse(t) as unknown;
      return Array.isArray(p) ? p : undefined;
    } catch {
      return undefined;
    }
  };
  let r = tryParse(trimmed);
  if (r) return r;
  const fixed = trimmed
    .replace(/[\u201c\u201d\u201e]/g, '"')
    .replace(/[\u2018\u2019]/g, "'");
  r = tryParse(fixed);
  if (r) return r;
  // Python-style ['a','b'] pasted from Sheets — not valid JSON
  if (/^\s*\[/.test(trimmed) && /'/.test(trimmed)) {
    r = tryParse(trimmed.replace(/'/g, '"'));
    if (r) return r;
  }
  return undefined;
}

/** Trim, strip wrapping quotes, fix protocol-relative and bare-host URLs (common in Sheets). */
export function normalizeImageUrl(s: string): string {
  let t = String(s ?? "").trim();
  if (
    (t.startsWith('"') && t.endsWith('"')) ||
    (t.startsWith("'") && t.endsWith("'"))
  ) {
    t = t.slice(1, -1).trim();
  }
  if (!t) return t;
  if (t.startsWith("//")) return `https:${t}`;
  if (/^https?:\/\//i.test(t)) return t;
  if (/^data:image/i.test(t)) {
    // Pasted/imported data URLs sometimes include whitespace/newlines.
    // Browsers can fail to render these, so normalize aggressively.
    return t.replace(/\s+/g, "");
  }
  // Site-relative public assets (must not become https://questions/...)
  if (t.startsWith("/")) return t;
  if (t.startsWith("questions/")) return `/${t}`;

  // Pasted host or host/path without scheme (e.g. cdn.example.com/img.png)
  const slashIdx = t.indexOf("/");
  const host = slashIdx === -1 ? t : t.slice(0, slashIdx);
  if (/^[a-z0-9][a-z0-9+.-]*\.[a-z]{2,}$/i.test(host)) {
    return `https://${t.replace(/^\/+/, "")}`;
  }
  return `/${t.replace(/^\/+/, "")}`;
}

/** Resolve image src for img tags — keeps /questions/... on the app origin. */
export function resolveQuestionImageSrc(url: string): string {
  const t = normalizeImageUrl(url);
  if (!t) return "";
  if (/^https?:\/\//i.test(t) || /^data:/i.test(t) || t.startsWith("//")) return t;
  return t.startsWith("/") ? t : `/${t.replace(/^\/+/, "")}`;
}

export function normalizeImageUrls(
  urls: string[] | undefined,
): string[] | undefined {
  if (!urls?.length) return urls;
  const out = urls.map((u) => normalizeImageUrl(String(u))).filter(Boolean);
  return out.length ? out : undefined;
}

function parseStringArray(val: unknown): string[] {
  const toDisplayString = (entry: unknown): string => {
    if (typeof entry === "string") return entry.trim();
    if (typeof entry === "number" || typeof entry === "boolean") return String(entry);
    if (entry && typeof entry === "object") {
      const row = entry as Record<string, unknown>;
      const preferred = [row.answer, row.value, row.text, row.label];
      for (const candidate of preferred) {
        if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
        if (typeof candidate === "number" || typeof candidate === "boolean")
          return String(candidate);
      }
      try {
        return JSON.stringify(entry);
      } catch {
        return String(entry);
      }
    }
    return String(entry ?? "").trim();
  };

  const sanitize = (arr: string[]) =>
    arr
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s !== "[object Object]");

  if (Array.isArray(val)) return sanitize(val.map(toDisplayString));
  if (typeof val === "string" && val.trim()) {
    const trimmed = val.trim();
    const arr = parseJsonArrayFromString(trimmed);
    if (arr) return sanitize(arr.map(toDisplayString));
    // Single URL in a cell (no JSON array) — common in Sheets
    if (
      /^https?:\/\//i.test(trimmed) ||
      trimmed.startsWith("data:image") ||
      trimmed.startsWith("//")
    ) {
      return [normalizeImageUrl(trimmed)];
    }
    // Bare domain/path (no spaces) — treat as one URL
    if (
      /^[a-z0-9][a-z0-9+.-]*\.[a-z]{2,}(\/|$)/i.test(trimmed) &&
      !/\s/.test(trimmed)
    ) {
      return [normalizeImageUrl(trimmed)];
    }
  }
  return [];
}

function parseInlineInputs(raw: unknown): AnswerPart["inlineInputs"] {
  if (!Array.isArray(raw)) return undefined;
  const boxes = raw
    .map((it, idx) => {
      if (!it || typeof it !== "object") return null;
      const row = it as Record<string, unknown>;
      const placeholder = String(row.placeholder ?? "").trim() || undefined;
      const acceptedAnswer = String(row.acceptedAnswer ?? row.accepted_answer ?? "").trim() || undefined;
      const unit = String(row.unit ?? "").trim() || undefined;
      const marksRaw = Number(row.marks);
      const marks =
        Number.isFinite(marksRaw) && marksRaw > 0 ? Math.round(marksRaw) : undefined;
      return {
        key: String(row.key ?? idx + 1).trim() || String(idx + 1),
        label: String(row.label ?? idx + 1).trim() || String(idx + 1),
        ...(placeholder ? { placeholder } : {}),
        ...(acceptedAnswer ? { acceptedAnswer } : {}),
        ...(unit ? { unit } : {}),
        ...(marks ? { marks } : {}),
      };
    })
    .filter((box): box is NonNullable<typeof box> => box != null);
  return boxes.length ? boxes : undefined;
}

function parseLabelOverlays(raw: unknown): AnswerPart["labelOverlays"] {
  if (!Array.isArray(raw)) return undefined;
  const overlays = raw
    .map((it, idx) => {
      if (!it || typeof it !== "object") return null;
      const row = it as Record<string, unknown>;
      const overlay = readOverlayFromPart(row);
      if (!overlay) return null;
      const placeholder = String(row.placeholder ?? "").trim() || undefined;
      const acceptedAnswer = String(row.acceptedAnswer ?? row.accepted_answer ?? "").trim() || undefined;
      const marksRaw = Number(row.marks);
      const marks =
        Number.isFinite(marksRaw) && marksRaw > 0 ? Math.round(marksRaw) : undefined;
      return {
        key: String(row.key ?? idx + 1).trim() || String(idx + 1),
        label: String(row.label ?? idx + 1).trim() || String(idx + 1),
        ...(placeholder ? { placeholder } : {}),
        ...(acceptedAnswer ? { acceptedAnswer } : {}),
        ...(marks ? { marks } : {}),
        ...overlay,
      };
    })
    .filter((overlay): overlay is NonNullable<typeof overlay> => overlay != null);
  return overlays.length ? overlays : undefined;
}

function parseAnswerParts(val: unknown, stemHint?: string): AnswerPart[] | undefined {
  const toParts = (arr: unknown[]): AnswerPart[] =>
    arr
      .map((it, idx) => {
        if (!it || typeof it !== "object") return null;
        const row = it as Record<string, unknown>;
        const labelRaw = cleanQuestionText(row.label);
        const typeRaw = String(row.type ?? "").trim().toLowerCase();
        const type =
          typeRaw === "number" || typeRaw === "text"
            ? (typeRaw as "number" | "text")
            : undefined;
        const placeholder = String(row.placeholder ?? "").trim() || undefined;
        const imageUrl =
          String(row.imageUrl ?? row.image_url ?? "").trim() || undefined;
        const marksRaw = Number(row.marks);
        const marks =
          Number.isFinite(marksRaw) && marksRaw > 0 ? Math.round(marksRaw) : undefined;
        const overlay = readOverlayFromPart(row);
        const labelOverlays =
          parseLabelOverlays(row.labelOverlays ?? row.label_overlays) ??
          undefined;
        const inlineInputs =
          parseInlineInputs(row.inlineInputs ?? row.inline_inputs) ??
          legacyOverlaysToInlineInputs(labelOverlays) ??
          undefined;
        if (!labelRaw && !inlineInputs?.length && !labelOverlays?.length && !overlay) {
          return null;
        }
        const keyRaw = String(row.key ?? "").trim().toLowerCase();
        const key =
          keyRaw && (/^[a-z]$/.test(keyRaw) || isRomanPartKey(keyRaw))
            ? keyRaw
            : partLetterForIndex(idx);
        return {
          key,
          label: labelRaw || "Answer",
          ...(type ? { type } : {}),
          ...(placeholder ? { placeholder } : {}),
          ...(imageUrl ? { imageUrl } : {}),
          ...(marks ? { marks } : {}),
          ...(overlay ?? {}),
          ...(inlineInputs ? { inlineInputs } : {}),
          ...(labelOverlays && !inlineInputs ? { labelOverlays } : {}),
        };
      })
      .filter((p): p is AnswerPart => p != null);

  let parts: AnswerPart[] | undefined;
  if (Array.isArray(val)) {
    const direct = toParts(val);
    parts = direct.length ? direct : undefined;
  } else if (typeof val === "string" && val.trim()) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) {
        const fromJson = toParts(parsed);
        parts = fromJson.length ? fromJson : undefined;
      }
    } catch {
      parts = undefined;
    }
  }

  if (!parts?.length) return undefined;
  parts = coalesceAnswerPartsForInlineInputs(parts);
  if (parts.length === 1) {
    const only = parts[0]!;
    const key = normalizePartKey(only.key, 0);
    const label = formatPartDescriptor(key, only.label ?? "");
    return [{ ...only, key, label }];
  }
  return parts.map((p, idx) => {
    const key = normalizePartKey(p.key, idx);
    const base = String(p.label ?? "").trim();
    const label = base
      ? formatPartDescriptor(key, base)
      : `${key}${isRomanPartKey(key) ? "." : ")"}`;
    return { ...p, key, label };
  });
}

function inferAnswerPartsFromQuestion(
  questionText: string,
  acceptedAnswersCount: number,
): AnswerPart[] | undefined {
  if (acceptedAnswersCount < 2) return undefined;

  const eToken = questionText.match(/\bE\s*\([^)]*\)/i)?.[0]?.replace(/\s+/g, "");
  const sdToken = questionText.match(/\bsd\s*\([^)]*\)/i)?.[0]?.replace(/\s+/g, "");
  const prToken = questionText.match(/\b(?:Pr|P)\s*\([^)]*\)/i)?.[0]?.replace(/\s+/g, "");
  if (eToken && sdToken && prToken && acceptedAnswersCount >= 3) {
    return [
      { key: "a", label: formatPartDescriptor("a", eToken), type: "number" },
      { key: "b", label: formatPartDescriptor("b", sdToken), type: "number" },
      { key: "c", label: formatPartDescriptor("c", prToken), type: "number" },
    ];
  }

  const directiveParts = parseDirectiveParts(questionText);
  if (directiveParts.length >= 2) {
    return directiveParts.map((text, idx) => {
      const letter = partLetterForIndex(idx);
      return { key: letter, label: formatPartDescriptor(letter, text) };
    });
  }

  return undefined;
}

function parseDirectiveParts(questionText: string): string[] {
  const actionRegex =
    /\b(find|determine|calculate|compute|evaluate|state)\b\s+([\s\S]*?)(?:[.?!]|$)/i;
  const m = questionText.match(actionRegex);
  if (!m?.[2]) return [];
  const body = m[2].replace(/\s+/g, " ").trim();
  if (!body) return [];
  const chunks = body
    .split(/\s*,\s*then\s+|\s+then\s+|\s*,\s*and\s+|\s+and\s+/i)
    .map((x) => x.trim().replace(/^[,;:\-]+/, "").replace(/[;:,.]+$/g, ""))
    .filter(Boolean);
  if (chunks.length < 2) return [];
  return chunks;
}

function applyMultipartAcceptedAnswers<
  T extends { acceptedAnswers?: string[]; answerParts?: AnswerPart[] },
>(row: T): T {
  const parts = row.answerParts?.filter((p) => p?.label?.trim()) ?? [];
  if (parts.length < 2 || !row.acceptedAnswers?.length) return row;
  return {
    ...row,
    acceptedAnswers: normalizeMultipartAcceptedAnswers(row.acceptedAnswers, parts.length),
  };
}

function resolveUseAiMarkingForLoad(
  explicit: boolean | undefined,
  input: {
    hasInlineInputBoxes: boolean;
    typeRaw: string;
    questionText: string;
    answerParts?: AnswerPart[];
    acceptedAnswers?: string[];
    subjectId: string;
  },
): { useAiMarking: boolean } {
  if (input.hasInlineInputBoxes) return { useAiMarking: false };
  if (explicit !== undefined) return { useAiMarking: explicit };
  const partLabels =
    input.answerParts?.map((p) => String(p.label ?? "").trim()).filter(Boolean) ?? [];
  const accepted =
    input.acceptedAnswers?.map((a) => String(a ?? "").trim()).filter(Boolean) ?? [];
  return {
    useAiMarking: inferUseAiMarkingForImport({
      type: input.typeRaw,
      questionText: input.questionText,
      partLabels,
      acceptedAnswers: accepted,
      subjectId: input.subjectId,
    }),
  };
}

/**
 * Bootstrap groups questions by `subject_id`. URLs use canonical ids (`methods`,
 * `general-maths`, `specialist-maths`); sheet rows sometimes use different casing.
 */
export function getRawCustomQuestionsForSubject(
  map: Record<string, unknown[]> | undefined,
  subjectId: string,
): unknown[] {
  if (!map || !subjectId) return [];
  const want = canonicalSubjectId(subjectId);
  const merged: unknown[] = [];
  for (const [k, arr] of Object.entries(map)) {
    if (canonicalSubjectId(k) !== want || !Array.isArray(arr)) continue;
    merged.push(...arr);
  }
  return merged;
}

/**
 * Maps bootstrap / localStorage custom question rows (admin uses short_answer, long_answer, letter MCQ answers)
 * into the shapes Practice / Quiz components expect (short, long, option text for MCQ).
 */
export function normalizeCustomQuestion(raw: unknown, subjectIdHint?: string): Question | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;

  const topicLabel = normalizeTopicLabel(q.topic);

  let imageUrls: string[] | undefined;
  if (Array.isArray(q.imageUrls)) {
    imageUrls = normalizeImageUrls(
      (q.imageUrls as unknown[]).map(String),
    );
  } else {
    const a = parseStringArray(q.image_urls);
    const b = parseStringArray(q.imageUrls);
    imageUrls = normalizeImageUrls(a.length ? a : b.length ? b : undefined);
  }

  const passageRaw = cleanQuestionText(q.passage);
  const passageEarly = passageRaw ? passageRaw : undefined;
  if (passageEarly) {
    const fromPassage = extractMarkdownImageUrls(passageEarly);
    if (fromPassage.length) {
      imageUrls = normalizeImageUrls([...(imageUrls ?? []), ...fromPassage]);
    }
  }

  const questionTextRaw = cleanQuestionText(q.question);
  let questionText =
    questionTextRaw ||
    (imageUrls?.length || passageEarly ? "See figure." : "");
  if (!questionText) return null;

  let answerImageUrls: string[] | undefined;
  if (Array.isArray((q as any).answerImageUrls)) {
    answerImageUrls = normalizeImageUrls(
      ((q as any).answerImageUrls as unknown[]).map(String),
    );
  } else {
    const a = parseStringArray((q as any).answer_image_urls);
    const b = parseStringArray((q as any).answer_image_urls_json);
    const c = parseStringArray((q as any).answerImageUrls);
    answerImageUrls = normalizeImageUrls(
      a.length ? a : b.length ? b : c.length ? c : undefined,
    );
  }
  const groupIdRaw = q.group_id ?? q.groupId;
  const groupId =
    typeof groupIdRaw === "string" && groupIdRaw.trim()
      ? groupIdRaw.trim()
      : undefined;
  const marks = typeof q.marks === "number" ? q.marks : undefined;
  const guidanceRaw = cleanQuestionText(q.guidance);
  let passage = passageEarly;
  const guidance = guidanceRaw ? guidanceRaw : undefined;
  const useAiMarkingRaw = (q as { useAiMarking?: unknown; use_ai_marking?: unknown })
    .useAiMarking ?? (q as { use_ai_marking?: unknown }).use_ai_marking;
  const useAiMarking =
    useAiMarkingRaw === false || useAiMarkingRaw === 0
      ? false
      : useAiMarkingRaw === true || useAiMarkingRaw === 1
        ? true
        : undefined;

  const sid = canonicalSubjectId(
    String(subjectIdHint ?? q.subject_id ?? q.subjectId ?? ""),
  );
  const topic = inferPracticeTopic(sid, topicLabel, questionText, passage);
  const id =
    typeof q.id === "number"
      ? q.id
      : typeof q.id === "string" && /^\d+$/.test(q.id)
        ? Number(q.id)
        : undefined;
  const answerParts =
    parseAnswerParts((q as any).answerParts, questionText) ??
    parseAnswerParts((q as any).answer_parts, questionText) ??
    parseAnswerParts((q as any).answer_parts_json, questionText);
  const inferredAnswerParts = inferAnswerPartsFromQuestion(
    questionText,
    parseStringArray(q.acceptedAnswers).length ||
      parseStringArray(q.accepted_answers).length ||
      (String(q.answer ?? "").trim() ? 1 : 0),
  );
  const resolvedAnswerParts = answerParts ?? inferredAnswerParts;
  const markBreakdown =
    parseMarkBreakdown((q as { markBreakdown?: unknown }).markBreakdown) ??
    parseMarkBreakdown((q as { mark_breakdown?: unknown }).mark_breakdown) ??
    parseMarkBreakdown((q as { mark_breakdown_json?: unknown }).mark_breakdown_json);
  const markBreakdownField = markBreakdown ? { markBreakdown } : {};
  if (resolvedAnswerParts && resolvedAnswerParts.length >= 2) {
    questionText = repairMultipartQuestionStem(questionText, resolvedAnswerParts);
    if (!questionText.trim()) {
      questionText =
        questionTextRaw ||
        (imageUrls?.length || passageEarly ? "See figure." : "");
    }
  } else {
    questionText = stripQuestionNumberPrefix(questionText);
  }
  const hasInlineInputBoxes = questionUsesInlineInputs(resolvedAnswerParts);

  const aiMarkingCtx = {
    hasInlineInputBoxes,
    questionText,
    answerParts: resolvedAnswerParts,
    subjectId: sid,
  };

  const typeRaw = String(q.type ?? "")
    .trim()
    .toLowerCase();

  const writtenUploadTypes = new Set([
    "extended",
    "extended_response",
    "drawing",
    "visual",
    "diagram",
    "graph",
    "sketch",
    "long_response",
  ]);
  if (writtenUploadTypes.has(typeRaw)) {
    let acceptedAnswers: string[] | undefined = parseStringArray(
      q.acceptedAnswers,
    );
    if (!acceptedAnswers?.length)
      acceptedAnswers = parseStringArray(q.accepted_answers);
    if (!acceptedAnswers?.length) acceptedAnswers = undefined;
    const answer =
      typeof q.answer === "string" && q.answer.trim() ? q.answer : undefined;
    return {
      type: "long",
      topic,
      question: questionText,
      acceptedAnswers,
      answer,
      guidance,
      imageUrls,
      answerImageUrls,
      marks,
      passage,
      id,
      ...((answerParts ?? inferredAnswerParts)?.length
        ? { answerParts: answerParts ?? inferredAnswerParts }
        : {}),
      ...(groupId ? { groupId } : {}),
      ...markBreakdownField,
      ...resolveUseAiMarkingForLoad(useAiMarking, {
        ...aiMarkingCtx,
        typeRaw,
        acceptedAnswers,
      }),
    };
  }

  if (typeRaw === "mcq") {
    let options = parseStringArray(q.options);
    if (!options.length) options = parseStringArray(q.options_json);
    options = normalizeMcqOptions(
      options.map((opt) => cleanQuestionText(opt)).filter(Boolean),
    );
    let answer = String(q.answer ?? "").trim();
    if (/^[A-Za-z]$/.test(answer) && options.length) {
      const i = answer.toUpperCase().charCodeAt(0) - "A".charCodeAt(0);
      if (i >= 0 && i < options.length) answer = options[i];
    }
    if (!options.length) return null;
    return {
      type: "mcq",
      topic,
      question: questionText,
      options,
      answer,
      imageUrls,
      answerImageUrls,
      marks,
      passage,
      id,
      ...((answerParts ?? inferredAnswerParts)?.length
        ? { answerParts: answerParts ?? inferredAnswerParts }
        : {}),
      ...(groupId ? { groupId } : {}),
      ...markBreakdownField,
    };
  }

  if (typeRaw === "short" || typeRaw === "short_answer") {
    let acceptedAnswers = parseStringArray(q.acceptedAnswers);
    if (!acceptedAnswers.length)
      acceptedAnswers = parseStringArray(q.accepted_answers);
    if (!acceptedAnswers.length) {
      const single = String(q.answer ?? "").trim();
      if (single) acceptedAnswers = [single];
    }
    if (!acceptedAnswers.length) {
      return {
        type: "long" as const,
        topic,
        question: questionText,
        guidance:
          guidance ??
          "Add accepted answers in the sheet (accepted_answers_json) or in Admin for short-answer auto-marking.",
        imageUrls,
        answerImageUrls,
        marks,
        passage,
        id,
        ...((answerParts ?? inferredAnswerParts)?.length
          ? { answerParts: answerParts ?? inferredAnswerParts }
          : {}),
        ...(groupId ? { groupId } : {}),
      ...markBreakdownField,
        ...resolveUseAiMarkingForLoad(useAiMarking, {
          ...aiMarkingCtx,
          typeRaw,
          acceptedAnswers: [],
        }),
      };
    }
    return applyMultipartAcceptedAnswers({
      type: "short" as const,
      topic,
      question: questionText,
      acceptedAnswers,
      imageUrls,
      answerImageUrls,
      marks,
      passage,
      id,
      ...((answerParts ?? inferredAnswerParts)?.length
        ? { answerParts: answerParts ?? inferredAnswerParts }
        : {}),
      ...(groupId ? { groupId } : {}),
      ...markBreakdownField,
      ...resolveUseAiMarkingForLoad(useAiMarking, {
        ...aiMarkingCtx,
        typeRaw,
        acceptedAnswers,
      }),
    });
  }

  if (typeRaw === "long" || typeRaw === "long_answer") {
    let acceptedAnswers: string[] | undefined = parseStringArray(
      q.acceptedAnswers,
    );
    if (!acceptedAnswers?.length)
      acceptedAnswers = parseStringArray(q.accepted_answers);
    if (!acceptedAnswers?.length) acceptedAnswers = undefined;
    const answer =
      typeof q.answer === "string" && q.answer.trim() ? q.answer : undefined;
    if (hasInlineInputBoxes && resolvedAnswerParts?.length) {
      const fromParts = flattenPartAcceptedAnswers(resolvedAnswerParts);
      return applyMultipartAcceptedAnswers({
        type: "short" as const,
        topic,
        question: questionText,
        acceptedAnswers: fromParts.length ? fromParts : acceptedAnswers ?? [],
        imageUrls,
        answerImageUrls,
        marks,
        passage,
        id,
        answerParts: resolvedAnswerParts,
        ...(groupId ? { groupId } : {}),
      ...markBreakdownField,
        useAiMarking: false,
      });
    }
    return applyMultipartAcceptedAnswers({
      type: "long" as const,
      topic,
      question: questionText,
      acceptedAnswers,
      answer,
      guidance,
      imageUrls,
      answerImageUrls,
      marks,
      passage,
      id,
      ...((answerParts ?? inferredAnswerParts)?.length
        ? { answerParts: answerParts ?? inferredAnswerParts }
        : {}),
      ...(groupId ? { groupId } : {}),
      ...markBreakdownField,
      ...resolveUseAiMarkingForLoad(useAiMarking, {
        ...aiMarkingCtx,
        typeRaw,
        acceptedAnswers: acceptedAnswers ?? (answer ? [answer] : []),
      }),
    });
  }

  return null;
}

function questionStemKey(q: Question): string {
  return String(q.question ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function dedupeQuestionsByStem(questions: Question[]): Question[] {
  const seen = new Set<string>();
  const out: Question[] = [];
  for (const q of questions) {
    const key =
      q.id != null
        ? `id:${q.id}`
        : `stem:${questionStemKey(q) || `row:${out.length}`}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(q);
  }
  return out;
}

export function normalizeCustomQuestionsList(
  rawList: unknown[],
  subjectId?: string,
): Question[] {
  const normalized = (rawList ?? [])
    .map((row) => normalizeCustomQuestion(row, subjectId))
    .filter((q): q is Question => q != null);
  return dedupeQuestionsByStem(normalized);
}

/** Canonical VCE topic label used for practice filters (matches dropdown / overview). */
export function canonicalPracticeTopic(
  subjectId: string,
  q: Pick<Question, "topic" | "question" | "passage">,
): string {
  const sid = canonicalSubjectId(subjectId);
  const label = normalizeTopicLabel(q.topic);
  return inferPracticeTopic(sid, label, String(q.question ?? ""), q.passage);
}

export function questionMatchesPracticeTopic(
  subjectId: string,
  q: Question,
  topicFilter: string,
): boolean {
  const want = String(topicFilter ?? "").trim();
  if (!want || want === "all") return true;
  return canonicalPracticeTopic(subjectId, q) === want;
}

export function topicHasQuestionsInBank(
  topic: string,
  subjectId: string,
  questions: Question[],
): boolean {
  const t = String(topic ?? "").trim();
  if (!t || t === "all") return true;
  return questions.some((q) => questionMatchesPracticeTopic(subjectId, q, t));
}

/**
 * Practice / quiz bank — single source: admin `custom_questions` in the database.
 * (Legacy built-ins are synced into that table from Admin on first load.)
 */
export function practiceQuestionsForSubject(
  rawList: unknown[],
  subjectId: string,
): Question[] {
  const sid = canonicalSubjectId(subjectId);
  return normalizeCustomQuestionsList(rawList ?? [], sid);
}
