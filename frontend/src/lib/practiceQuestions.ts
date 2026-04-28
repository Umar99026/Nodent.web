import type { Question } from "@/lib/subjects";

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
  if (Array.isArray(val)) return val.map(String);
  if (typeof val === "string" && val.trim()) {
    const trimmed = val.trim();
    const arr = parseJsonArrayFromString(trimmed);
    if (arr) return arr.map(String);
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
export function normalizeCustomQuestion(raw: unknown): Question | null {
  if (!raw || typeof raw !== "object") return null;
  const q = raw as Record<string, unknown>;

  const topic = normalizeTopicLabel(q.topic);
  const questionText = String(q.question ?? "").trim();
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
  const passage =
    typeof q.passage === "string" && q.passage.trim() ? q.passage : undefined;
  const guidance =
    typeof q.guidance === "string" && q.guidance.trim() ? q.guidance : undefined;
  const id =
    typeof q.id === "number"
      ? q.id
      : typeof q.id === "string" && /^\d+$/.test(q.id)
        ? Number(q.id)
        : undefined;

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
      ...(groupId ? { groupId } : {}),
    };
  }

  if (typeRaw === "mcq") {
    let options = parseStringArray(q.options);
    if (!options.length) options = parseStringArray(q.options_json);
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
      ...(groupId ? { groupId } : {}),
    };
  }

  return null;
}

export function normalizeCustomQuestionsList(rawList: unknown[]): Question[] {
  return (rawList ?? [])
    .map(normalizeCustomQuestion)
    .filter((q): q is Question => q != null);
}
