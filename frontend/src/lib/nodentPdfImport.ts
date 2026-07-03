import {
  cropImageDataUrl,
  FULL_CROP,
  isMeaningfulCropRect,
  type CropRect,
} from "@/lib/pdfImageCrop";
import {
  extractPageText,
  extractMcqOptionsFromText,
  openPdfDocument,
  PDF_RENDER_STANDARD,
  renderPageToDataUrl,
} from "@/lib/pdfQuestionImport";
import { partKeyFromLabel, studentFacingPartText } from "@/lib/questionDisplay";
import { normalizeQuestionMathText } from "@/lib/questionMathText";
import {
  clampOverlay,
  partHasOverlay,
  type DiagramLabelPart,
} from "@/lib/diagramLabels";

export type NodentQuestionType = "mcq" | "short_answer" | "long_answer";

export type NodentPartMeta = {
  key: string;
  marks: number;
  label: string;
  answer: string;
  placeholder: string;
  /** This sub-part has its own figure (crop from PDF page). */
  useImage?: boolean;
  crop?: CropRect;
  imagePage?: number;
  /** Place draggable input boxes on this part's figure. */
  needsInputBoxes?: boolean;
  labelOverlays?: DiagramLabelPart[];
};

export type NodentPageMeta = {
  questionId: string;
  subjectId: string;
  type: NodentQuestionType;
  topic: string;
  marks: number;
  question: string;
  passage?: string;
  parts: NodentPartMeta[];
  mcqOptions?: string[];
  correctAnswer?: string;
  /** When false, import without stimulus image. */
  useImage: boolean;
  /** Figure crop as fractions of the page image (0–1). */
  crop?: CropRect;
  /** Place input boxes on the main stimulus figure. */
  needsInputBoxes?: boolean;
  labelDiagramEnabled?: boolean;
  labelOverlays?: DiagramLabelPart[];
};

export type NodentParsedQuestion = {
  id: string;
  questionId: string;
  subjectId: string;
  pageNumber: number;
  /** Every PDF page for this question_id (in order). */
  pageNumbers?: number[];
  question: string;
  marks: number;
  topic: string;
  type: NodentQuestionType;
  imageDataUrl: string;
  imageDataUrls?: string[];
  sourceImageDataUrl?: string;
  sourceImageDataUrls?: string[];
  crop: CropRect;
  parts: Array<{
    label: string;
    descriptor: string;
    placeholder: string;
    acceptedAnswer: string;
    marks: number;
    imageDataUrl?: string;
    cropApplied?: boolean;
    needsInputBoxes?: boolean;
    labelOverlays?: DiagramLabelPart[];
  }>;
  mcqOptions?: string[];
  correctAnswer?: string;
  useImage: boolean;
  passage?: string;
  pageQuestionIndex?: number;
  pageQuestionCount?: number;
  labelDiagramEnabled?: boolean;
  labelOverlays?: DiagramLabelPart[];
  cropApplied?: boolean;
};

const IMAGE_FLAG_VALUES = new Set([
  "true",
  "false",
  "yes",
  "no",
  "0",
  "1",
  "none",
  "off",
  "on",
  "without",
  "with",
  "text_only",
  "text-only",
  "no_image",
  "with_image",
]);

function isImageFlagValue(raw: string): boolean {
  return IMAGE_FLAG_VALUES.has(raw.trim().toLowerCase());
}

function parsePassageFromFields(fields: Map<string, string>): string | undefined {
  for (const key of ["passage", "context", "stimulus_text", "stimulus_passage"] as const) {
    const val = fields.get(key)?.trim();
    if (val) return normalizeQuestionMathText(val);
  }
  const stimulus = fields.get("stimulus")?.trim();
  if (stimulus && !isImageFlagValue(stimulus)) {
    return normalizeQuestionMathText(stimulus);
  }
  return undefined;
}

function stripNodentBlocks(text: string): string {
  return normalizeNodentText(text).replace(/---NODENT---[\s\S]*?---END---/gi, "");
}

function normalizeNodentText(text: string): string {
  return text
    .replace(/\u2013|\u2014|\u2212/g, "-")
    .replace(/\uFF1A/g, ":")
    .replace(/-{2,}\s*\n\s*NODENT\s*\n\s*-{2,}/gi, "---NODENT---")
    .replace(/-{2,}\s*\n\s*END\s*\n\s*-{2,}/gi, "---END---")
    .replace(/-{2,}\s*NODENT\s*-{2,}/gi, "---NODENT---")
    .replace(/-{2,}\s*END\s*-{2,}/gi, "---END---");
}

function normalizeFieldKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

function looksLikeFieldLine(line: string): boolean {
  const colon = line.indexOf(":");
  if (colon <= 0) return false;
  const key = normalizeFieldKey(line.slice(0, colon));
  return /^[a-z][a-z0-9_]*$/.test(key);
}

function parseFieldMap(block: string): Map<string, string> {
  const fields = new Map<string, string>();
  const normalized = block.replace(/\r\n/g, "\n").replace(/\uFF1A/g, ":");
  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i]!;
    if (/^---(?:END|NODENT)---$/i.test(trimmed)) continue;
    const colon = trimmed.indexOf(":");
    if (colon < 0) continue;
    const key = normalizeFieldKey(trimmed.slice(0, colon));
    if (!key) continue;
    let val = trimmed.slice(colon + 1).trim();
    while (!val && i + 1 < lines.length) {
      const next = lines[i + 1]!;
      if (looksLikeFieldLine(next) || /^---/i.test(next)) break;
      val = next;
      i++;
    }
    if (!fields.has(key) || val) fields.set(key, val);
  }

  // PDF text often glues multiple key: value pairs on one line — pick up any we missed.
  const fieldRe = /\b([a-z][a-z0-9_]*)\s*:\s*/gi;
  const hits: { key: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = fieldRe.exec(normalized)) !== null) {
    hits.push({
      key: m[1]!.toLowerCase(),
      start: m.index,
      end: m.index + m[0].length,
    });
  }
  for (let i = 0; i < hits.length; i++) {
    const hit = hits[i]!;
    const nextStart = hits[i + 1]?.start ?? normalized.length;
    const val = normalized.slice(hit.end, nextStart).trim();
    if (!fields.has(hit.key) && val) fields.set(hit.key, val);
  }

  if (!fields.has("question_id")) {
    const idMatch = normalized.match(/\bquestion[_\s-]?id\s*:\s*(\S+)/i);
    if (idMatch?.[1]) fields.set("question_id", idMatch[1]);
  }

  return fields;
}

function normalizeType(raw: string): NodentQuestionType {
  const t = raw.trim().toLowerCase();
  if (t === "mcq" || t === "multiple_choice") return "mcq";
  if (t === "short" || t === "short_answer") return "short_answer";
  return "long_answer";
}

function normalizeCorrectLetter(raw: string): string {
  const t = raw.trim().toUpperCase();
  if (/^[A-D]$/.test(t)) return t;
  const m = t.match(/^([A-D])\b/);
  return m?.[1] ?? "";
}

function unwrapBracketOption(raw: string): string {
  let t = raw.trim();
  while (t.startsWith("[") && t.endsWith("]")) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

function parseBracketOptionList(raw: string): string[] {
  const groups = [...raw.matchAll(/\[([^\]]+)\]/g)].map((m) =>
    normalizeQuestionMathText(unwrapBracketOption(m[1] ?? "")),
  );
  return groups.filter(Boolean);
}

function parseMcqOptionsFromFields(fields: Map<string, string>): {
  options: string[];
  correctAnswer: string;
} {
  const letters = ["a", "b", "c", "d"] as const;
  let options = letters.map((l) =>
    unwrapBracketOption(
      normalizeQuestionMathText(
        fields.get(`option_${l}`) ??
          fields.get(`option ${l.toUpperCase()}`) ??
          fields.get(`option${l.toUpperCase()}`) ??
          "",
      ),
    ),
  );

  const optionsLine = fields.get("options") ?? fields.get("options_json") ?? "";
  if (optionsLine && options.some((o) => !o.trim())) {
    const bracketOpts = parseBracketOptionList(optionsLine);
    if (bracketOpts.length >= 4) {
      options = bracketOpts.slice(0, 4);
    }
  }

  const optionsJson = fields.get("options_json") ?? fields.get("options");
  if (optionsJson && options.some((o) => !o.trim()) && !optionsLine.includes("[")) {
    try {
      const parsed = JSON.parse(optionsJson) as unknown;
      if (Array.isArray(parsed) && parsed.length >= 4) {
        options = parsed.slice(0, 4).map((x) => normalizeQuestionMathText(String(x)));
      }
    } catch {
      const split = optionsJson
        .split(/\s*\|\s*|\s*;\s*|\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (split.length >= 4) {
        options = split.slice(0, 4).map((x) => unwrapBracketOption(normalizeQuestionMathText(x)));
      }
    }
  }

  // GPT sometimes mislabels option D as "placeholder" or "part_a_placeholder"
  if (!options[3]?.trim()) {
    for (const key of ["option_d", "placeholder", "part_a_placeholder"] as const) {
      const stray = fields.get(key)?.trim();
      if (stray) {
        options[3] = unwrapBracketOption(normalizeQuestionMathText(stray));
        break;
      }
    }
  }

  options = options.map((o) => unwrapBracketOption(o));

  const hasOptions = options.some((o) => o.trim());
  const correctAnswer = normalizeCorrectLetter(
    fields.get("correct_answer") ??
      fields.get("correct") ??
      (hasOptions ? "" : (fields.get("answer") ?? "")),
  );
  return { options, correctAnswer: hasOptions ? correctAnswer : "" };
}

function hasMcqOptionFields(fields: Map<string, string>): boolean {
  if (["a", "b", "c", "d"].some((l) => Boolean(fields.get(`option_${l}`)?.trim()))) {
    return true;
  }
  const optionsLine = fields.get("options") ?? "";
  return parseBracketOptionList(optionsLine).length >= 4;
}

function parseUseImage(fields: Map<string, string>): boolean {
  const raw = (
    fields.get("use_image") ??
    fields.get("include_image") ??
    fields.get("image") ??
    ""
  ).trim();
  if (raw) {
    if (isImageFlagValue(raw)) {
      return !["false", "no", "0", "none", "off", "without", "text_only", "text-only", "no_image"].includes(
        raw.toLowerCase(),
      );
    }
    return true;
  }
  const stimulus = fields.get("stimulus")?.trim() ?? "";
  if (stimulus && isImageFlagValue(stimulus)) {
    return !["false", "no", "0", "none", "off", "without", "text_only", "text-only", "no_image"].includes(
      stimulus.toLowerCase(),
    );
  }
  return true;
}

/** All ---NODENT--- … ---END--- block bodies in document order. */
export function extractNodentBlockBodies(text: string): string[] {
  const normalized = normalizeNodentText(text);
  const bodies: string[] = [];

  for (const m of normalized.matchAll(/---NODENT---([\s\S]*?)---END---/gi)) {
    const body = m[1]?.trim();
    if (body) bodies.push(body);
    if (bodies.length >= 12) break;
  }
  if (bodies.length) return bodies;

  // GPT sometimes omits ---END---; split on the next block or end of page text.
  for (const part of normalized.split(/---NODENT---/i).slice(1)) {
    const withoutEnd = part.replace(/---END---[\s\S]*/i, "").trim();
    const nextMarker = withoutEnd.search(/---NODENT---/i);
    const body = (nextMarker >= 0 ? withoutEnd.slice(0, nextMarker) : withoutEnd).trim();
    if (body) bodies.push(body);
    if (bodies.length >= 12) break;
  }
  if (bodies.length) return bodies;

  // Some PDFs omit ---NODENT--- but still terminate with ---END---.
  for (const m of normalized.matchAll(
    /(?:^|[\n\r])([\s\S]*?\bquestion_id\s*:[\s\S]*?)---END---/gi,
  )) {
    const body = m[1]?.trim();
    if (!body || /---NODENT---/i.test(body)) continue;
    bodies.push(body);
    if (bodies.length >= 12) break;
  }

  return bodies;
}

function normalizeQuestionId(raw: string): string {
  const trimmed = raw
    .trim()
    .replace(/---[\s\S]*$/i, "")
    .trim();
  const standard = trimmed.match(/^([a-z][\w.-]*-q\d+)/i);
  if (standard?.[1]) return standard[1];
  const token = trimmed.match(/^(\S+)/);
  return token?.[1] ?? trimmed;
}

function clampCropFraction(n: number): number {
  return Math.min(1, Math.max(0, n));
}

function parseCropFromFields(fields: Map<string, string>): CropRect | undefined {
  const x = Number(fields.get("crop_x") ?? fields.get("figure_crop_x"));
  const y = Number(fields.get("crop_y") ?? fields.get("figure_crop_y"));
  const w = Number(fields.get("crop_w") ?? fields.get("figure_crop_w"));
  const h = Number(fields.get("crop_h") ?? fields.get("figure_crop_h"));
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return undefined;
  const rect: CropRect = {
    x: clampCropFraction(x),
    y: clampCropFraction(y),
    w: clampCropFraction(w),
    h: clampCropFraction(h),
  };
  return isMeaningfulCropRect(rect) ? rect : undefined;
}

function boolMetaField(raw: string | undefined): boolean {
  const t = (raw ?? "").trim().toLowerCase();
  return ["true", "yes", "1", "on"].includes(t);
}

function defaultBoxLayout(index: number): DiagramLabelPart {
  const cols = 3;
  const col = index % cols;
  const row = Math.floor(index / cols);
  const w = 16;
  const h = 7;
  return {
    key: String(index + 1),
    ...clampOverlay({
      overlayX: 4 + col * (w + 3),
      overlayY: 8 + row * (h + 4),
      overlayW: w,
      overlayH: h,
    }),
  };
}

/** Assign grid positions to boxes missing coordinates; pad to expectedCount if given. */
export function finalizeInputBoxes(
  boxes: InputBoxDraft[],
  expectedCount = 0,
): DiagramLabelPart[] {
  const withCoords = boxes.map((box, i) => {
    if (partHasOverlay(box)) {
      return {
        ...box,
        key: box.key?.trim() || String(i + 1),
      };
    }
    const layout = defaultBoxLayout(i);
    return {
      ...layout,
      ...box,
      key: box.key?.trim() || layout.key,
      ...clampOverlay({
        overlayX: layout.overlayX,
        overlayY: layout.overlayY,
        overlayW: box.overlayW ?? layout.overlayW,
        overlayH: box.overlayH ?? layout.overlayH,
      }),
    };
  });

  const target = Math.max(withCoords.length, expectedCount);
  const result = [...withCoords];
  while (result.length < target) {
    const layout = defaultBoxLayout(result.length);
    result.push({
      ...layout,
      label: `Box ${result.length + 1}`,
      acceptedAnswer: "",
      marks: 1,
    });
  }
  return result;
}

function parseInputBoxCount(fields: Map<string, string>): number {
  const n = Number(fields.get("input_box_count") ?? fields.get("box_count"));
  return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
}

function parsePartCropFromFields(fields: Map<string, string>, letter: string): CropRect | undefined {
  const x = Number(fields.get(`part_${letter}_crop_x`) ?? fields.get(`part_${letter}_figure_crop_x`));
  const y = Number(fields.get(`part_${letter}_crop_y`) ?? fields.get(`part_${letter}_figure_crop_y`));
  const w = Number(fields.get(`part_${letter}_crop_w`) ?? fields.get(`part_${letter}_figure_crop_w`));
  const h = Number(fields.get(`part_${letter}_crop_h`) ?? fields.get(`part_${letter}_figure_crop_h`));
  if (![x, y, w, h].every((n) => Number.isFinite(n))) return undefined;
  const rect: CropRect = {
    x: clampCropFraction(x),
    y: clampCropFraction(y),
    w: clampCropFraction(w),
    h: clampCropFraction(h),
  };
  return isMeaningfulCropRect(rect) ? rect : undefined;
}

function parsePartUseImage(fields: Map<string, string>, letter: string): boolean {
  if (boolMetaField(fields.get(`part_${letter}_use_image`))) return true;
  if (boolMetaField(fields.get(`part_${letter}_has_figure`))) return true;
  if (boolMetaField(fields.get(`part_${letter}_has_stimulus`))) return true;
  if (parsePartCropFromFields(fields, letter)) return true;
  return parsePartInputBoxesFromFields(fields, letter).length > 0;
}

function parsePartNeedsInputBoxes(
  fields: Map<string, string>,
  letter: string,
  boxes: InputBoxDraft[],
): boolean {
  if (boxes.length > 0) return true;
  if (boolMetaField(fields.get(`part_${letter}_needs_input_boxes`))) return true;
  if (boolMetaField(fields.get(`part_${letter}_input_boxes`))) return true;
  if (boolMetaField(fields.get(`part_${letter}_on_figure`))) return true;
  const count = Number(fields.get(`part_${letter}_input_box_count`));
  return Number.isFinite(count) && count > 0;
}

type InputBoxDraft = Partial<DiagramLabelPart> & { key: string };

function parsePartInputBoxesFromFields(
  fields: Map<string, string>,
  letter: string,
): InputBoxDraft[] {
  const prefix = `part_${letter}_box_`;
  const boxIds = new Set<string>();
  for (const key of fields.keys()) {
    if (!key.startsWith(prefix)) continue;
    const rest = key.slice(prefix.length);
    const id = rest.split("_")[0];
    if (id) boxIds.add(id);
  }

  const sorted = [...boxIds].sort((a, b) => {
    const an = Number(a);
    const bn = Number(b);
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return a.localeCompare(b);
  });

  const boxes: InputBoxDraft[] = [];
  for (const id of sorted) {
    const p = `${prefix}${id}_`;
    const label = fields.get(`${p}label`)?.trim() ?? "";
    const answer = fields.get(`${p}answer`)?.trim() ?? "";
    const unit = fields.get(`${p}unit`)?.trim() ?? "";
    const x = Number(fields.get(`${p}x`));
    const y = Number(fields.get(`${p}y`));
    const w = Number(fields.get(`${p}w`) ?? 18);
    const h = Number(fields.get(`${p}h`) ?? 8);
    const marks = Number(fields.get(`${p}marks`));
    if (!label && !answer && !Number.isFinite(x)) continue;
    const base: InputBoxDraft = {
      key: id,
      label: label || id,
      placeholder: fields.get(`${p}placeholder`)?.trim() || "",
      acceptedAnswer: answer,
      marks: Number.isFinite(marks) && marks > 0 ? Math.round(marks) : 1,
      ...(unit ? { unit } : {}),
    };
    if (Number.isFinite(x) && Number.isFinite(y)) {
      boxes.push({
        ...base,
        ...clampOverlay({
          overlayX: x,
          overlayY: y,
          overlayW: Number.isFinite(w) ? w : 18,
          overlayH: Number.isFinite(h) ? h : 8,
        }),
      });
    } else {
      boxes.push(base);
    }
  }
  return boxes;
}

function parseInputBoxesFromFields(fields: Map<string, string>): InputBoxDraft[] {
  const boxIds = new Set<string>();
  for (const key of fields.keys()) {
    const num = key.match(/^box_(\d+)_/);
    if (num?.[1]) boxIds.add(num[1]!);
    const letter = key.match(/^box_([a-z])_/);
    if (letter?.[1]) boxIds.add(letter[1]!);
  }

  const sorted = [...boxIds].sort((a, b) => {
    const an = Number(a);
    const bn = Number(b);
    if (Number.isFinite(an) && Number.isFinite(bn)) return an - bn;
    return a.localeCompare(b);
  });

  const boxes: InputBoxDraft[] = [];
  for (const id of sorted) {
    const prefix = `box_${id}_`;
    const label = fields.get(`${prefix}label`)?.trim() ?? "";
    const answer = fields.get(`${prefix}answer`)?.trim() ?? "";
    const unit = fields.get(`${prefix}unit`)?.trim() ?? "";
    const x = Number(fields.get(`${prefix}x`));
    const y = Number(fields.get(`${prefix}y`));
    const w = Number(fields.get(`${prefix}w`) ?? 18);
    const h = Number(fields.get(`${prefix}h`) ?? 8);
    const marks = Number(fields.get(`${prefix}marks`));
    if (!label && !answer && !Number.isFinite(x)) continue;
    const base: InputBoxDraft = {
      key: id,
      label: label || id,
      placeholder: fields.get(`${prefix}placeholder`)?.trim() || "",
      acceptedAnswer: answer,
      marks: Number.isFinite(marks) && marks > 0 ? Math.round(marks) : 1,
      ...(unit ? { unit } : {}),
    };
    if (Number.isFinite(x) && Number.isFinite(y)) {
      boxes.push({
        ...base,
        ...clampOverlay({
          overlayX: x,
          overlayY: y,
          overlayW: Number.isFinite(w) ? w : 18,
          overlayH: Number.isFinite(h) ? h : 8,
        }),
      });
    } else {
      boxes.push(base);
    }
  }

  const declared = parseInputBoxCount(fields);
  if (declared > boxes.length) {
    for (let i = boxes.length; i < declared; i++) {
      const n = i + 1;
      boxes.push({
        key: String(n),
        label: fields.get(`box_${n}_label`)?.trim() || `Box ${n}`,
        acceptedAnswer: fields.get(`box_${n}_answer`)?.trim() || "",
        marks: 1,
      });
    }
  }

  return boxes;
}

function parseLabelDiagramFromFields(
  fields: Map<string, string>,
  boxes: DiagramLabelPart[],
): boolean {
  if (boolMetaField(fields.get("needs_input_boxes"))) return true;
  if (boolMetaField(fields.get("figure_has_blanks"))) return true;
  const raw = (fields.get("label_diagram") ?? fields.get("input_boxes") ?? "").trim().toLowerCase();
  if (["true", "yes", "1", "on", "table", "matrix", "diagram"].includes(raw)) return true;
  if (["false", "no", "0", "off"].includes(raw)) return false;
  return boxes.length > 0 || parseInputBoxCount(fields) > 0;
}

function parseNodentMetadataBlock(blockBody: string): NodentPageMeta | null {
  const fields = parseFieldMap(blockBody);
  const questionId = normalizeQuestionId(fields.get("question_id") ?? "");
  if (!questionId) return null;

  const totalMarks = Math.max(1, Math.round(Number(fields.get("marks")) || 0));
  const type = normalizeType(fields.get("type") ?? "short_answer");
  const topic = fields.get("topic") ?? "General";
  const question = normalizeQuestionMathText(fields.get("question") ?? "");
  const passage = parsePassageFromFields(fields);
  const useImage = parseUseImage(fields);
  const crop = parseCropFromFields(fields);
  const rawBoxes = parseInputBoxesFromFields(fields);
  const boxCount = parseInputBoxCount(fields);
  const labelOverlays = finalizeInputBoxes(rawBoxes, boxCount);
  const needsInputBoxes = parseLabelDiagramFromFields(fields, labelOverlays);
  const labelDiagramEnabled = needsInputBoxes;

  const mcqParsed = parseMcqOptionsFromFields(fields);
  const isMcq =
    type === "mcq" || hasMcqOptionFields(fields) || mcqParsed.options.every((o) => o.trim());

  if (isMcq && mcqParsed.options.some((o) => o.trim())) {
    const marks = Math.max(1, Math.round(Number(fields.get("marks")) || 1));
    return {
      questionId,
      subjectId: fields.get("subject_id") ?? "",
      type: "mcq",
      topic,
      marks,
      question,
      passage,
      parts: [],
      mcqOptions: mcqParsed.options,
      correctAnswer: mcqParsed.correctAnswer,
      useImage,
      crop,
      needsInputBoxes,
      labelDiagramEnabled,
      labelOverlays: needsInputBoxes ? labelOverlays : undefined,
    };
  }

  if (type === "mcq") {
    const marks = Math.max(1, Math.round(Number(fields.get("marks")) || 1));
    return {
      questionId,
      subjectId: fields.get("subject_id") ?? "",
      type: "mcq",
      topic,
      marks,
      question,
      passage,
      parts: [],
      mcqOptions: mcqParsed.options,
      correctAnswer: mcqParsed.correctAnswer,
      useImage,
      crop,
      needsInputBoxes,
      labelDiagramEnabled,
      labelOverlays: needsInputBoxes ? labelOverlays : undefined,
    };
  }

  const partLetters = new Set<string>();
  for (const key of fields.keys()) {
    const m = key.match(/^part_([a-z])_/);
    if (m?.[1]) partLetters.add(m[1]);
  }

  let parts: NodentPartMeta[] = [];

  if (partLetters.size > 0) {
    parts = [...partLetters]
      .sort()
      .map((letter) => {
        const partBoxes = parsePartInputBoxesFromFields(fields, letter);
        const partBoxCount = Number(fields.get(`part_${letter}_input_box_count`));
        const needsPartBoxes = parsePartNeedsInputBoxes(fields, letter, partBoxes);
        let finalizedBoxes =
          partBoxes.length || needsPartBoxes
            ? finalizeInputBoxes(
                partBoxes,
                Number.isFinite(partBoxCount) && partBoxCount > 0 ? partBoxCount : 0,
              )
            : undefined;
        const answer = fields.get(`part_${letter}_answer`) ?? "";
        if (
          needsPartBoxes &&
          finalizedBoxes &&
          finalizedBoxes.length === 0 &&
          answer.trim()
        ) {
          finalizedBoxes.push(
            ...finalizeInputBoxes([
              {
                key: "1",
                label: fields.get(`part_${letter}_label`)?.trim() || "Answer",
                acceptedAnswer: answer,
                marks: Math.max(1, Math.round(Number(fields.get(`part_${letter}_marks`)) || 1)),
              },
            ]),
          );
        } else if (
          needsPartBoxes &&
          finalizedBoxes &&
          finalizedBoxes.length === 1 &&
          !finalizedBoxes[0]?.acceptedAnswer?.trim() &&
          answer.trim()
        ) {
          finalizedBoxes[0] = { ...finalizedBoxes[0]!, acceptedAnswer: answer };
        }
        const imagePageRaw = Number(fields.get(`part_${letter}_image_page`));
        return {
          key: letter,
          marks: Math.max(1, Math.round(Number(fields.get(`part_${letter}_marks`)) || 1)),
          label: fields.get(`part_${letter}_label`) ?? "",
          answer,
          placeholder: fields.get(`part_${letter}_placeholder`) ?? "Type your answer…",
          useImage: parsePartUseImage(fields, letter),
          crop: parsePartCropFromFields(fields, letter),
          imagePage: Number.isFinite(imagePageRaw) && imagePageRaw > 0 ? imagePageRaw : undefined,
          needsInputBoxes: needsPartBoxes,
          labelOverlays: needsPartBoxes ? finalizedBoxes : undefined,
        };
      })
      .filter((p) => p.label?.trim() || p.answer?.trim() || p.useImage || p.needsInputBoxes);
  } else if (
    fields.has("part_label") ||
    fields.has("accepted_answer") ||
    fields.has("answer")
  ) {
    const key = (fields.get("part_key") ?? "a").toLowerCase();
    const answer =
      fields.get("accepted_answer") ?? fields.get("answer") ?? fields.get("correct_answer") ?? "";
    parts = [
      {
        key,
        marks: totalMarks,
        label: fields.get("part_label") ?? "Answer",
        answer,
        placeholder: fields.get("placeholder") ?? "Type your answer…",
      },
    ];
  }

  if (!parts.length && question.trim()) {
    parts = [
      {
        key: "a",
        marks: totalMarks,
        label: "Answer",
        answer: fields.get("accepted_answer") ?? fields.get("answer") ?? "",
        placeholder: fields.get("placeholder") ?? "Type your answer…",
      },
    ];
  }

  if (!parts.length) {
    parts = [
      {
        key: "a",
        marks: totalMarks,
        label: "Answer",
        answer: fields.get("accepted_answer") ?? fields.get("answer") ?? "",
        placeholder: fields.get("placeholder") ?? "Type your answer…",
      },
    ];
  }

  const marks =
    parts.length >= 2
      ? parts.reduce((sum, p) => sum + p.marks, 0) || totalMarks
      : totalMarks;

  return {
    questionId,
    subjectId: fields.get("subject_id") ?? "",
    type,
    topic,
    marks,
    question,
    passage,
    parts,
    useImage,
    crop,
    needsInputBoxes,
    labelDiagramEnabled,
    labelOverlays: needsInputBoxes ? labelOverlays : undefined,
  };
}

/** Parse every NODENT block on a page (or in pasted text). */
export function parseAllNodentMetadataBlocks(text: string): NodentPageMeta[] {
  return extractNodentBlockBodies(text)
    .map((body) => parseNodentMetadataBlock(body))
    .filter((m): m is NodentPageMeta => m != null);
}

function sortPositionedItems(items: TextItem[]): TextItem[] {
  return [...items].sort((a, b) => {
    const yDiff = b.y - a.y;
    if (Math.abs(yDiff) > 4) return yDiff > 0 ? 1 : -1;
    return a.x - b.x;
  });
}

function buildTextFromPositionedItems(items: TextItem[]): string {
  let text = "";
  let lastY: number | null = null;
  for (const item of items) {
    if (lastY !== null && Math.abs(item.y - lastY) > 7) {
      text += "\n";
    } else if (text && !text.endsWith("\n") && !text.endsWith(" ")) {
      text += " ";
    }
    text += item.str;
    lastY = item.y;
  }
  return text;
}

function estimateBodyTopY(body: string, items: TextItem[]): number {
  const idMatch = body.match(/\bquestion_id\s*:\s*(\S+)/i);
  if (idMatch?.[1]) {
    const id = idMatch[1].replace(/---.*$/, "").trim();
    const hit = items.find((it) => it.str.includes(id));
    if (hit) return hit.y;
  }
  const firstLine = body.split("\n").find((l) => l.trim())?.trim() ?? "";
  if (firstLine.length >= 8) {
    const needle = firstLine.slice(0, Math.min(20, firstLine.length));
    const hit = items.find((it) => it.str.includes(needle));
    if (hit) return hit.y;
  }
  return 0;
}

function sortBlockBodiesTopToBottom(bodies: string[], items: TextItem[]): string[] {
  if (bodies.length <= 1) return bodies;
  return [...bodies].sort(
    (a, b) => estimateBodyTopY(b, items) - estimateBodyTopY(a, items),
  );
}

type PageNodentParseResult = {
  metas: NodentPageMeta[];
  skippedBlocks: number;
};

async function parseAllNodentMetadataBlocksFromPage(
  page: import("pdfjs-dist").PDFPageProxy,
): Promise<PageNodentParseResult> {
  const items = sortPositionedItems(await extractPositionedItems(page));
  const text = normalizeNodentText(buildTextFromPositionedItems(items));
  const bodies = sortBlockBodiesTopToBottom(extractNodentBlockBodies(text), items);

  const metas: NodentPageMeta[] = [];
  let skippedBlocks = 0;
  for (const body of bodies) {
    const meta = parseNodentMetadataBlock(body);
    if (meta) {
      metas.push(meta);
    } else if (body.replace(/\s/g, "").length > 8) {
      skippedBlocks++;
    }
  }
  return { metas, skippedBlocks };
}

export function parseNodentMetadata(text: string): NodentPageMeta | null {
  return parseAllNodentMetadataBlocks(text)[0] ?? null;
}

type TextItem = { str: string; x: number; y: number };

async function extractPositionedItems(
  page: import("pdfjs-dist").PDFPageProxy,
): Promise<TextItem[]> {
  const content = await page.getTextContent();
  return (content.items as Array<{ str?: string; transform?: number[] }>)
    .filter((it) => it.str?.trim())
    .map((it) => ({
      str: it.str!.trim(),
      x: it.transform![4]!,
      y: it.transform![5]!,
    }));
}

/** Crop rectangle for the figure area below the ---NODENT--- metadata block. */
export async function estimateNodentFigureCrop(
  page: import("pdfjs-dist").PDFPageProxy,
): Promise<CropRect> {
  const viewport = page.getViewport({ scale: 1 });
  const pageH = viewport.height;
  const items = await extractPositionedItems(page);

  const metadataItems = items.filter(
    (it) =>
      it.str.includes("NODENT") ||
      it.str.includes("---END---") ||
      /^[a-z0-9_]+:/i.test(it.str),
  );

  if (!metadataItems.length) {
    return { x: 0, y: 0.28, w: 1, h: 0.72 };
  }

  let maxFromTop = 0;
  for (const item of metadataItems) {
    const fromTop = pageH - item.y;
    maxFromTop = Math.max(maxFromTop, fromTop + 14);
  }

  const y = Math.min(0.92, Math.max(0.12, maxFromTop / pageH + 0.015));
  return { x: 0, y, w: 1, h: Math.max(0.05, 1 - y) };
}

export function isNodentPdfText(text: string): boolean {
  const normalized = normalizeNodentText(text);
  if (/---\s*NODENT\s*---/i.test(normalized)) return true;
  return /\bquestion_id\s*:/i.test(normalized) && /---END---/i.test(normalized);
}

export type ParseNodentPdfOptions = {
  imagePrimary?: boolean;
  onProgress?: (page: number, total: number) => void;
};

function defaultCropForMetaCount(metaCount: number): CropRect {
  const y = Math.min(0.55, 0.1 + Math.max(1, metaCount) * 0.035);
  return { x: 0, y, w: 1, h: Math.max(0.35, 1 - y) };
}

function metaNeedsMcqFill(meta: NodentPageMeta): boolean {
  if (meta.type !== "mcq") return false;
  if (meta.mcqOptions?.length === 4 && meta.mcqOptions.every((o) => o.trim())) {
    return false;
  }
  return true;
}

function buildQuestionsFromPage(
  metas: NodentPageMeta[],
  pageNumber: number,
  pageMcqFromText: ReturnType<typeof extractMcqOptionsFromText> | null,
  imagePrimary: boolean,
  sourceImageDataUrl: string,
  crop: CropRect,
): NodentParsedQuestion[] {
  const pageQuestionCount = metas.length;
  const out: NodentParsedQuestion[] = [];

  for (let qi = 0; qi < metas.length; qi++) {
    const meta = metas[qi]!;
    let mcqOptions = meta.mcqOptions?.map((o) => o.trim());
    let correctAnswer = meta.correctAnswer ?? "";
    let questionStem = meta.question.trim();

    const isMcqRow =
      meta.type === "mcq" || Boolean(mcqOptions?.filter((o) => o.trim()).length);
    const useImage = meta.useImage;

    const stem = questionStem || `Question ${meta.questionId}`;

    const safeId = meta.questionId.replace(/[^\w.-]+/g, "_");
    const uniqueId =
      pageQuestionCount > 1
        ? `${safeId}_p${pageNumber}_q${qi + 1}`
        : `${safeId}_p${pageNumber}`;

    out.push({
      id: uniqueId,
      questionId: meta.questionId,
      subjectId: meta.subjectId,
      pageNumber,
      pageQuestionIndex: qi + 1,
      pageQuestionCount,
      question: stem,
      marks: meta.marks,
      topic: meta.topic,
      type: isMcqRow && mcqOptions?.every((o) => o.trim()) ? "mcq" : meta.type,
      useImage,
      imageDataUrl: useImage ? sourceImageDataUrl : "",
      sourceImageDataUrl: useImage ? sourceImageDataUrl || undefined : undefined,
      crop,
      parts: isMcqRow
        ? []
        : meta.parts.map((p) => ({
            label: partKeyFromLabel(p.label, p.key),
            descriptor: normalizeQuestionMathText(p.label)?.trim() || "Answer",
            placeholder: p.placeholder,
            acceptedAnswer: p.answer,
            marks: p.marks,
            ...(p.needsInputBoxes ? { needsInputBoxes: true } : {}),
            ...(p.labelOverlays?.length ? { labelOverlays: p.labelOverlays } : {}),
          })),
      ...(mcqOptions?.every((o) => o.trim())
        ? {
            mcqOptions,
            correctAnswer,
          }
        : {}),
      ...(meta.passage ? { passage: meta.passage } : {}),
      ...(meta.needsInputBoxes || meta.labelDiagramEnabled
        ? { labelDiagramEnabled: true }
        : {}),
    });
  }

  return out;
}

/** Exam order: gm-exam-q1 → 1 */
export function extractQuestionNumber(questionId: string): number | null {
  const id = questionId.trim().toLowerCase();
  const qMatch = id.match(/(?:^|[-_.])q(\d+)(?:[^0-9]|$)/);
  if (qMatch?.[1]) return parseInt(qMatch[1], 10);
  const lead = id.match(/^(\d+)/);
  if (lead?.[1]) return parseInt(lead[1], 10);
  return null;
}

export function canonicalQuestionIdKey(rawId: string): string {
  return rawId.trim().replace(/---[\s\S]*$/i, "").toLowerCase();
}

export function compareNodentQuestionOrder(
  a: Pick<NodentParsedQuestion, "questionId" | "pageNumber" | "pageNumbers" | "pageQuestionIndex">,
  b: Pick<NodentParsedQuestion, "questionId" | "pageNumber" | "pageNumbers" | "pageQuestionIndex">,
): number {
  const aNum = extractQuestionNumber(a.questionId);
  const bNum = extractQuestionNumber(b.questionId);
  if (aNum != null && bNum != null && aNum !== bNum) return aNum - bNum;
  const aFirst = a.pageNumbers?.[0] ?? a.pageNumber;
  const bFirst = b.pageNumbers?.[0] ?? b.pageNumber;
  if (aFirst !== bFirst) return aFirst - bFirst;
  return (a.pageQuestionIndex ?? 1) - (b.pageQuestionIndex ?? 1);
}

type PageAnchor = {
  pageNumber: number;
  meta: NodentPageMeta;
  metaIndexOnPage: number;
};

function pagesForQuestionGroup(
  groupAnchors: PageAnchor[],
  anchorPages: Set<number>,
  nextGroupFirstPage: number,
  totalPages: number,
): number[] {
  const idPages = [...new Set(groupAnchors.map((a) => a.pageNumber))].sort((a, b) => a - b);
  const firstAnchorPage = idPages[0]!;
  const pages = new Set<number>(idPages);

  const rangeEnd = Math.min(nextGroupFirstPage, totalPages + 1);
  for (let p = firstAnchorPage; p < rangeEnd; p++) {
    if (!anchorPages.has(p)) pages.add(p);
  }

  for (const p of idPages) {
    if (p >= nextGroupFirstPage) pages.add(p);
  }

  return [...pages].sort((a, b) => a - b);
}

function mergeGroupPageMeta(anchors: PageAnchor[]): NodentPageMeta {
  const sorted = [...anchors].sort(
    (a, b) => a.pageNumber - b.pageNumber || a.metaIndexOnPage - b.metaIndexOnPage,
  );
  const primary = sorted[0]!.meta;
  const partByKey = new Map<string, NodentPartMeta>();

  for (const anchor of sorted) {
    for (const part of anchor.meta.parts) {
      const key = (part.key || "a").toLowerCase();
      const existing = partByKey.get(key);
      if (!existing) {
        partByKey.set(key, { ...part });
        continue;
      }
      partByKey.set(key, {
        ...existing,
        label: part.label?.trim() || existing.label,
        answer: part.answer?.trim() || existing.answer,
        placeholder: part.placeholder?.trim() || existing.placeholder,
        marks: part.marks > 0 ? part.marks : existing.marks,
        useImage: part.useImage || existing.useImage,
        crop: part.crop ?? existing.crop,
        imagePage: part.imagePage ?? existing.imagePage,
        needsInputBoxes: part.needsInputBoxes || existing.needsInputBoxes,
        labelOverlays: part.labelOverlays?.length ? part.labelOverlays : existing.labelOverlays,
      });
    }
  }

  const parts = [...partByKey.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, part]) => part);

  const questionBlocks = sorted.map((a) => a.meta.question.trim()).filter(Boolean);
  const question = [...new Set(questionBlocks)].join("\n\n") || primary.question;

  const passageBlocks = sorted
    .map((a) => a.meta.passage?.trim())
    .filter((p): p is string => Boolean(p));
  const passage = passageBlocks.length
    ? [...new Set(passageBlocks)].join("\n\n")
    : primary.passage;

  return { ...primary, question, passage, parts };
}

async function buildGroupedQuestion(
  groupAnchors: PageAnchor[],
  pagesInRange: number[],
  doc: import("pdfjs-dist").PDFDocumentProxy,
  imagePrimary: boolean,
): Promise<NodentParsedQuestion> {
  const primary = groupAnchors[0]!;
  const meta = mergeGroupPageMeta(groupAnchors);
  const pageNumber = pagesInRange[0]!;

  const cropRect = meta.crop ?? FULL_CROP;
  const shouldCrop = Boolean(meta.crop && isMeaningfulCropRect(meta.crop));
  let crop = cropRect;

  const imageDataUrls: string[] = [];
  const sourceImageDataUrls: string[] = [];
  if (meta.useImage) {
    for (const p of pagesInRange) {
      const pageImg = await doc.getPage(p);
      const img = await renderPageToDataUrl(pageImg, PDF_RENDER_STANDARD);
      sourceImageDataUrls.push(img);
      imageDataUrls.push(shouldCrop ? await cropImageDataUrl(img, cropRect) : img);
    }
    if (shouldCrop) {
      crop = FULL_CROP;
    }
  }

  const pageMcqFromText = null;

  const built = buildQuestionsFromPage(
    [meta],
    pageNumber,
    pageMcqFromText,
    imagePrimary,
    sourceImageDataUrls[0] ?? "",
    crop,
  )[0]!;

  const enrichedParts = await Promise.all(
    built.parts.map(async (part, idx) => {
      const metaPart = meta.parts[idx];
      if (!metaPart) return part;

      let imageDataUrl = part.imageDataUrl;
      let cropApplied = part.cropApplied;
      const partCrop = metaPart.crop;
      const partShouldCrop = Boolean(partCrop && isMeaningfulCropRect(partCrop));

      if (metaPart.useImage) {
        const targetPage = metaPart.imagePage ?? pagesInRange[0] ?? pageNumber;
        const sourceIdx = Math.max(0, pagesInRange.indexOf(targetPage));
        const source = sourceImageDataUrls[sourceIdx] ?? sourceImageDataUrls[0];
        if (source) {
          if (partShouldCrop && partCrop) {
            imageDataUrl = await cropImageDataUrl(source, partCrop);
            cropApplied = true;
          } else {
            imageDataUrl = imageDataUrls[sourceIdx] ?? imageDataUrls[0] ?? source;
            cropApplied = Boolean(imageDataUrl);
          }
        }
      }

      return {
        ...part,
        imageDataUrl,
        cropApplied,
        ...(metaPart.needsInputBoxes ? { needsInputBoxes: true } : {}),
        ...(metaPart.labelOverlays?.length ? { labelOverlays: metaPart.labelOverlays } : {}),
      };
    }),
  );

  const safeId = meta.questionId.replace(/[^\w.-]+/g, "_");

  return {
    ...built,
    parts: enrichedParts,
    id: safeId,
    pageNumber,
    pageNumbers: pagesInRange,
    imageDataUrl: imageDataUrls[0] ?? "",
    imageDataUrls: meta.useImage ? imageDataUrls : [],
    sourceImageDataUrl: sourceImageDataUrls[0],
    sourceImageDataUrls: meta.useImage ? sourceImageDataUrls : [],
    pageQuestionIndex: 1,
    pageQuestionCount: 1,
    cropApplied: shouldCrop,
    ...(meta.labelOverlays?.length ? { labelOverlays: meta.labelOverlays } : {}),
    ...(meta.needsInputBoxes || meta.labelDiagramEnabled ? { labelDiagramEnabled: true } : {}),
  };
}

/** Parse a NODENT PDF — one row per question_id, all matching pages as croppable images. */
export async function parseNodentPdfToQuestions(
  file: File,
  { imagePrimary = true, onProgress }: ParseNodentPdfOptions = {},
): Promise<{ questions: NodentParsedQuestion[]; errors: string[] }> {
  const doc = await openPdfDocument(file);
  const total = doc.numPages;
  const errors: string[] = [];
  const anchors: PageAnchor[] = [];
  const anchorPages = new Set<number>();
  const questions: NodentParsedQuestion[] = [];

  try {
    for (let pageNumber = 1; pageNumber <= total; pageNumber++) {
      onProgress?.(pageNumber, total);
      const page = await doc.getPage(pageNumber);
      const { metas, skippedBlocks } = await parseAllNodentMetadataBlocksFromPage(page);

      if (!metas.length) {
        const text = normalizeNodentText(await extractPageText(page));
        const bodies = extractNodentBlockBodies(text);
        if (/NODENT/i.test(text) || bodies.length) {
          const hint = bodies.length
            ? " (NODENT block found but question_id missing — check key: value format)"
            : " (NODENT text found but block not closed with ---END---?)";
          errors.push(`Page ${pageNumber}: no question parsed${hint}.`);
        }
        continue;
      }

      if (skippedBlocks > 0) {
        errors.push(
          `Page ${pageNumber}: ${skippedBlocks} NODENT block(s) skipped (missing question_id).`,
        );
      }

      metas.forEach((meta, metaIndexOnPage) => {
        anchors.push({ pageNumber, meta, metaIndexOnPage });
        anchorPages.add(pageNumber);
      });
    }

    if (!anchors.length) {
      errors.push("No NODENT questions found — each question needs a ---NODENT--- block with question_id.");
      return { questions: [], errors };
    }

    const byKey = new Map<string, PageAnchor[]>();
    for (const anchor of anchors) {
      const key = canonicalQuestionIdKey(anchor.meta.questionId);
      const list = byKey.get(key) ?? [];
      list.push(anchor);
      byKey.set(key, list);
    }

    const groupKeys = [...byKey.keys()].sort((ka, kb) => {
      const aAnchor = byKey.get(ka)!.sort(
        (x, y) => x.pageNumber - y.pageNumber || x.metaIndexOnPage - y.metaIndexOnPage,
      )[0]!;
      const bAnchor = byKey.get(kb)!.sort(
        (x, y) => x.pageNumber - y.pageNumber || x.metaIndexOnPage - y.metaIndexOnPage,
      )[0]!;
      const cmp = compareNodentQuestionOrder(
        { questionId: aAnchor.meta.questionId, pageNumber: aAnchor.pageNumber },
        { questionId: bAnchor.meta.questionId, pageNumber: bAnchor.pageNumber },
      );
      if (cmp !== 0) return cmp;
      return ka.localeCompare(kb);
    });

    for (let gi = 0; gi < groupKeys.length; gi++) {
      const key = groupKeys[gi]!;
      const groupAnchors = [...byKey.get(key)!].sort(
        (a, b) => a.pageNumber - b.pageNumber || a.metaIndexOnPage - b.metaIndexOnPage,
      );
      const primary = groupAnchors[0]!;
      const nextGroupFirstPage =
        gi + 1 < groupKeys.length
          ? Math.min(...byKey.get(groupKeys[gi + 1]!)!.map((a) => a.pageNumber))
          : total + 1;

      const pagesInRange = pagesForQuestionGroup(
        groupAnchors,
        anchorPages,
        nextGroupFirstPage,
        total,
      );

      questions.push(
        await buildGroupedQuestion(groupAnchors, pagesInRange, doc, imagePrimary),
      );
    }

    questions.sort(compareNodentQuestionOrder);
  } finally {
    await doc.destroy();
  }

  return { questions, errors };
}

/** Fast check: first page has a NODENT block. */
export async function quickDetectNodentPdf(file: File): Promise<boolean> {
  const doc = await openPdfDocument(file);
  try {
    if (doc.numPages < 1) return false;
    const page = await doc.getPage(1);
    const text = await extractPageText(page);
    return isNodentPdfText(text);
  } finally {
    await doc.destroy();
  }
}

/** True when every page in the PDF has a NODENT metadata block. */
export async function detectNodentPdf(file: File): Promise<boolean> {
  const doc = await openPdfDocument(file);
  try {
    for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
      const page = await doc.getPage(pageNumber);
      const text = await extractPageText(page);
      if (!isNodentPdfText(text)) return false;
    }
    return doc.numPages > 0;
  } finally {
    await doc.destroy();
  }
}
