import type { AnswerPart, Question } from "@/lib/subjects";
import { GENERAL_MATHS_BUILTIN_QUESTIONS } from "@/lib/generalMathsBuiltinQuestions";
import { GENERAL_MATHS_BUILTIN_SHORT_TRICKY } from "@/lib/generalMathsBuiltinShortTricky";
import { inferGeneralMathsAreaOfStudy } from "@/lib/generalMathsAreaTopic";
import { inferMethodsAreaOfStudy } from "@/lib/methodsAreaTopic";
import { METHODS_BUILTIN_QUESTIONS } from "@/lib/methodsBuiltinQuestions";
import { inferSpecialistMathsAreaOfStudy } from "@/lib/specialistMathsAreaTopic";
import { SPECIALIST_MATHS_BUILTIN_QUESTIONS } from "@/lib/specialistMathsBuiltinQuestions";
import { normalizeQuestionMathText } from "@/lib/questionMathText";

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
  // Pasted host or host/path without scheme (e.g. sandbox CDN domains)
  if (/^[a-z0-9][a-z0-9+.-]*\.[a-z]{2,}/i.test(t)) {
    return `https://${t.replace(/^\/+/, "")}`;
  }
  return t;
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

function parseAnswerParts(val: unknown): AnswerPart[] | undefined {
  const toParts = (arr: unknown[]): AnswerPart[] =>
    arr
      .map((it, idx) => {
        if (!it || typeof it !== "object") return null;
        const row = it as Record<string, unknown>;
        const label = String(row.label ?? "").trim();
        const keyRaw = String(row.key ?? "").trim();
        const key = keyRaw || `part${idx + 1}`;
        if (!label) return null;
        const typeRaw = String(row.type ?? "").trim().toLowerCase();
        const type =
          typeRaw === "number" || typeRaw === "text"
            ? (typeRaw as "number" | "text")
            : undefined;
        return { key, label, ...(type ? { type } : {}) };
      })
      .filter((p): p is AnswerPart => p != null);

  if (Array.isArray(val)) {
    const direct = toParts(val);
    return direct.length ? direct : undefined;
  }
  if (typeof val === "string" && val.trim()) {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) {
        const fromJson = toParts(parsed);
        return fromJson.length ? fromJson : undefined;
      }
    } catch {
      return undefined;
    }
  }
  return undefined;
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
      { key: "part1", label: eToken, type: "number" },
      { key: "part2", label: sdToken, type: "number" },
      { key: "part3", label: prToken, type: "number" },
    ];
  }

  const directiveParts = parseDirectiveParts(questionText);
  if (directiveParts.length >= 2) {
    return directiveParts.map((label, idx) => ({ key: `part${idx + 1}`, label }));
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
  const questionText = cleanQuestionText(q.question);
  if (!questionText) return null;

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
  const passageRaw = cleanQuestionText(q.passage);
  const guidanceRaw = cleanQuestionText(q.guidance);
  const passage = passageRaw ? passageRaw : undefined;
  const guidance = guidanceRaw ? guidanceRaw : undefined;

  const sid = canonicalSubjectId(
    String(subjectIdHint ?? q.subject_id ?? q.subjectId ?? ""),
  );
  let topic = topicLabel;
  if (sid === "methods") {
    topic = inferMethodsAreaOfStudy(topicLabel, questionText, passage);
  } else if (sid === "general-maths") {
    topic = inferGeneralMathsAreaOfStudy(topicLabel, questionText, passage);
  } else if (sid === "specialist-maths") {
    topic = inferSpecialistMathsAreaOfStudy(topicLabel, questionText, passage);
  }
  const id =
    typeof q.id === "number"
      ? q.id
      : typeof q.id === "string" && /^\d+$/.test(q.id)
        ? Number(q.id)
        : undefined;
  const answerParts =
    parseAnswerParts((q as any).answerParts) ??
    parseAnswerParts((q as any).answer_parts) ??
    parseAnswerParts((q as any).answer_parts_json);
  const inferredAnswerParts = inferAnswerPartsFromQuestion(
    questionText,
    parseStringArray(q.acceptedAnswers).length ||
      parseStringArray(q.accepted_answers).length ||
      (String(q.answer ?? "").trim() ? 1 : 0),
  );

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
      ...((false && (answerParts ?? inferredAnswerParts)?.length)
        ? { answerParts: answerParts ?? inferredAnswerParts }
        : {}),
      ...(groupId ? { groupId } : {}),
    };
  }

  if (typeRaw === "mcq") {
    let options = parseStringArray(q.options);
    if (!options.length) options = parseStringArray(q.options_json);
    options = options.map((opt) => cleanQuestionText(opt)).filter(Boolean);
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
      ...((false && (answerParts ?? inferredAnswerParts)?.length)
        ? { answerParts: answerParts ?? inferredAnswerParts }
        : {}),
      ...(groupId ? { groupId } : {}),
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
        type: "long",
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
        ...((false && (answerParts ?? inferredAnswerParts)?.length)
          ? { answerParts: answerParts ?? inferredAnswerParts }
          : {}),
        ...(groupId ? { groupId } : {}),
      };
    }
    return {
      type: "short",
      topic,
      question: questionText,
      acceptedAnswers,
      imageUrls,
      answerImageUrls,
      marks,
      passage,
      id,
      ...((false && (answerParts ?? inferredAnswerParts)?.length)
        ? { answerParts: answerParts ?? inferredAnswerParts }
        : {}),
      ...(groupId ? { groupId } : {}),
    };
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
      ...((false && (answerParts ?? inferredAnswerParts)?.length)
        ? { answerParts: answerParts ?? inferredAnswerParts }
        : {}),
      ...(groupId ? { groupId } : {}),
    };
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
    const key = questionStemKey(q);
    if (!key || seen.has(key)) continue;
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
  const text = String(q.question ?? "");
  const passage = q.passage;
  if (sid === "methods") {
    return inferMethodsAreaOfStudy(label, text, passage);
  }
  if (sid === "general-maths") {
    return inferGeneralMathsAreaOfStudy(label, text, passage);
  }
  if (sid === "specialist-maths") {
    return inferSpecialistMathsAreaOfStudy(label, text, passage);
  }
  return label;
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

function builtinQuestionsForSubject(subjectId: string): Question[] {
  const sid = canonicalSubjectId(subjectId);
  if (sid === "methods") return METHODS_BUILTIN_QUESTIONS;
  if (sid === "general-maths") {
    return dedupeQuestionsByStem([
      ...GENERAL_MATHS_BUILTIN_SHORT_TRICKY,
      ...GENERAL_MATHS_BUILTIN_QUESTIONS,
    ]);
  }
  if (sid === "specialist-maths") return SPECIALIST_MATHS_BUILTIN_QUESTIONS;
  return [];
}

/** Practice / quiz bank: built-in maths sets plus admin `custom_questions` (deduped by stem). */
export function practiceQuestionsForSubject(
  rawList: unknown[],
  subjectId: string,
): Question[] {
  const sid = canonicalSubjectId(subjectId);
  const custom = normalizeCustomQuestionsList(rawList ?? [], sid);
  const builtIn = builtinQuestionsForSubject(sid);
  if (!builtIn.length) return custom;
  return dedupeQuestionsByStem([...builtIn, ...custom]);
}
