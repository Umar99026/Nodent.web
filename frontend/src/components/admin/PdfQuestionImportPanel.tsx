import { useMemo, useRef, useState } from "react";
import { apiFetchAdmin, ApiError, API_UNREACHABLE_MESSAGE, isFetchTimeoutError } from "@/lib/api";
import { API_PATHS } from "@/lib/constants";
import { QuestionImageGrid, PassageBlock } from "@/components/quiz/QuestionStimulus";
import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
import {
  isMeaningfulCrop,
  PdfPageCropEditor,
} from "@/components/admin/PdfPageCropEditor";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { topicLabelsForSubject } from "@/lib/pdfTopicInfer";
import { formatPartDescriptor, formatSinglePartLabel, normalizeMcqOptions, partLetterForIndex, stripMainPartPrefix, stripMcqOptionPrefix } from "@/lib/questionDisplay";
import { cropImageDataUrl, FULL_CROP, type CropRect } from "@/lib/pdfImageCrop";
import {
  detectLetterSubparts,
  extractMcqOptionsFromText,
  type PdfParsedQuestion,
} from "@/lib/pdfQuestionImport";
import { parseNodentPdfToQuestions } from "@/lib/nodentPdfImport";
import { purgeCustomQuestionsForSubject } from "@/lib/questionBankCache";
import { normalizeQuestionMathText } from "@/lib/questionMathText";
import { inferUseAiMarkingForImport } from "@/lib/questionAiMarking";
import { isBrokenMathStem } from "@/lib/questionDisplay";
import { cn } from "@/lib/utils";
import { FileUp, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

type QuestionType = "mcq" | "short_answer" | "long_answer";

type PartDraft = {
  label: string;
  descriptor: string;
  placeholder: string;
  acceptedAnswer: string;
  marks: number;
  imageDataUrl?: string;
};

type DraftRow = PdfParsedQuestion & {
  selected: boolean;
  topic: string;
  type: QuestionType;
  marks: number;
  crop: CropRect;
  parts: PartDraft[];
  cropping: boolean;
  questionId?: string;
  metaSubjectId?: string;
  sourceImageDataUrl?: string;
  fromNodent?: boolean;
  mcqOptions: string[];
  correctAnswer: string;
  cropApplied: boolean;
  useImage: boolean;
  passage?: string;
  /** Smart (AI) marking for written questions — toggled per row in preview. */
  useAiMarking: boolean;
  pageQuestionIndex?: number;
  pageQuestionCount?: number;
};

function ImportMathPreview({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const trimmed = text.trim();
  if (!trimmed || trimmed === "See figure.") return null;
  return (
    <div
      className={cn(
        "rounded-md border border-black/10 bg-muted/25 px-3 py-2.5",
        className,
      )}
    >
      <RichQuestionContent
        text={trimmed}
        className="prose prose-base max-w-none prose-p:my-1 sm:prose-lg"
      />
    </div>
  );
}

const MCQ_LETTERS = ["A", "B", "C", "D"] as const;

function defaultMcqOptions(): string[] {
  return ["", "", "", ""];
}

function aiMarkingForDraft(
  type: QuestionType,
  question: string,
  parts: PartDraft[],
  subjectId: string,
): boolean {
  if (type === "mcq") return false;
  const stemText = [question, ...parts.map((p) => p.descriptor)].join("\n");
  const accepted = parts.map((p) => p.acceptedAnswer.trim()).filter(Boolean);
  return inferUseAiMarkingForImport({
    type,
    questionText: stemText,
    partLabels: parts.map((p) => p.descriptor),
    acceptedAnswers: accepted,
    subjectId,
  });
}

function draftRowDefaults(
  partial: Omit<
    DraftRow,
    "selected" | "cropping" | "cropApplied" | "mcqOptions" | "correctAnswer" | "useImage" | "useAiMarking"
  > & {
    selected?: boolean;
    cropping?: boolean;
    cropApplied?: boolean;
    useImage?: boolean;
    useAiMarking?: boolean;
    mcqOptions?: string[];
    correctAnswer?: string;
  },
  subjectId: string,
): DraftRow {
  const { mcqOptions, correctAnswer, selected, cropping, cropApplied, useImage, useAiMarking, ...rest } =
    partial;
  return {
    ...rest,
    selected: selected ?? true,
    cropping: cropping ?? false,
    cropApplied: cropApplied ?? false,
    useImage: useImage ?? true,
    useAiMarking:
      useAiMarking ?? aiMarkingForDraft(rest.type, rest.question, rest.parts, subjectId),
    mcqOptions: mcqOptions ?? defaultMcqOptions(),
    correctAnswer: correctAnswer ?? "",
  };
}

function mcqFieldsFromParsed(
  q: {
    question: string;
    rawText?: string;
    mcqOptions?: string[];
    mcqCorrectAnswer?: string;
  },
  fallbackType: QuestionType,
): {
  type: QuestionType;
  mcqOptions: string[];
  correctAnswer: string;
  question: string;
} {
  let options = q.mcqOptions?.length === 4 ? [...q.mcqOptions] : null;
  let correctAnswer = (q.mcqCorrectAnswer ?? "").trim().toUpperCase();
  let question = q.question;

  if (!options?.every((o) => o.trim())) {
    for (const source of [q.rawText, q.question].filter(Boolean)) {
      const extracted = extractMcqOptionsFromText(source!);
      if (extracted.options?.length === 4 && extracted.options.every((o) => o.trim())) {
        options = [...extracted.options];
        question = extracted.stem.trim() || question;
        if (!correctAnswer && extracted.correctAnswer) {
          correctAnswer = extracted.correctAnswer;
        }
        break;
      }
      if (
        options &&
        options.filter((o) => o.trim()).length >= 3 &&
        !options[3]?.trim() &&
        extracted.options?.[3]?.trim()
      ) {
        options[3] = extracted.options[3]!;
        if (!correctAnswer && extracted.correctAnswer) {
          correctAnswer = extracted.correctAnswer;
        }
      }
    }
  }

  if (options?.every((o) => o.trim())) {
    return {
      type: "mcq",
      mcqOptions: normalizeMcqOptions(options),
      correctAnswer,
      question,
    };
  }

  // Partial options (e.g. A–C in metadata, D from PDF) — still treat as MCQ draft
  if (options && options.filter((o) => o.trim()).length >= 3) {
    const padded = [...options];
    while (padded.length < 4) padded.push("");
    return {
      type: "mcq",
      mcqOptions: normalizeMcqOptions(padded),
      correctAnswer,
      question,
    };
  }

  return {
    type: fallbackType,
    mcqOptions: defaultMcqOptions(),
    correctAnswer: "",
    question,
  };
}

function getRowPreviewImageUrls(row: DraftRow): string[] {
  if (!row.useImage) return [];
  const useSource = Boolean(row.sourceImageDataUrl && !row.cropApplied);
  const primary = useSource ? row.sourceImageDataUrl! : row.imageDataUrl;
  let urls: string[];
  if (row.imageDataUrls?.length) {
    urls = row.imageDataUrls.map((url, idx) =>
      idx === 0 && useSource ? row.sourceImageDataUrl! : url,
    );
  } else {
    urls = primary ? [primary] : [];
  }
  const seen = new Set<string>();
  return urls.filter((u) => {
    const key = u.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Shared PDF figures: only the first question on a page shows the stimulus in the list. */
function isPrimaryStimulusRow(row: DraftRow, rows: DraftRow[]): boolean {
  if (!row.useImage) return false;
  const firstOnPage = rows.find((r) => r.pageNumber === row.pageNumber && r.useImage);
  return firstOnPage?.id === row.id;
}

function applySharedPageCrop(
  rows: DraftRow[],
  row: DraftRow,
  cropped: string,
  urls?: string[],
): DraftRow[] {
  return rows.map((r) => {
    const sharesPageFigure =
      r.pageNumber === row.pageNumber && r.useImage && row.useImage;
    if (!sharesPageFigure && r.id !== row.id) return r;
    const nextUrls = urls ?? r.imageDataUrls;
    return {
      ...r,
      imageDataUrl: cropped,
      ...(nextUrls ? { imageDataUrls: nextUrls } : {}),
      ...(sharesPageFigure && !r.sourceImageDataUrl
        ? { sourceImageDataUrl: row.sourceImageDataUrl ?? row.imageDataUrl }
        : {}),
      crop: FULL_CROP,
      cropping: false,
      cropApplied: true,
    };
  });
}

type SubjectOption = { id: string; name: string };

type Props = {
  subjects: SubjectOption[];
  defaultSubjectId?: string;
  onImported?: () => Promise<void> | void;
};

function emptyPartsForMcq(): PartDraft[] {
  return [];
}

function defaultPart(index: number, marks = 1): PartDraft {
  const letter = partLetterForIndex(index);
  return {
    label: letter,
    descriptor: "",
    placeholder: "Type your answer…",
    acceptedAnswer: "",
    marks,
  };
}

function partsFromParsed(q: {
  detectedParts?: Array<{
    label: string;
    descriptor: string;
    marks?: number;
    imageDataUrl?: string;
  }>;
}): PartDraft[] {
  if (q.detectedParts && q.detectedParts.length >= 2) {
    return q.detectedParts.map((p, idx) => {
      const letter = partLetterForIndex(idx);
      return {
        label: letter,
        descriptor: formatPartDescriptor(letter, p.descriptor),
        placeholder: "Type your answer…",
        acceptedAnswer: "",
        marks: p.marks && p.marks > 0 ? p.marks : 1,
        imageDataUrl: p.imageDataUrl,
      };
    });
  }
  return [defaultPart(0)];
}

function totalMarksForRow(parts: PartDraft[], fallback: number): number {
  if (parts.length >= 2) {
    const sum = parts.reduce((s, p) => s + Math.max(1, Math.round(p.marks || 1)), 0);
    return sum > 0 ? sum : fallback;
  }
  return Math.max(1, Math.round(parts[0]?.marks ?? fallback));
}

function buildImportQuestion(row: DraftRow, imagePrimary: boolean): string {
  const stem = stripMainPartPrefix(normalizeQuestionMathText(row.question.trim()));
  const partLines = row.parts
    .map((p) => p.descriptor.trim())
    .filter(Boolean);
  const isMultipart = row.parts.length >= 2;
  const pageFallback = row.questionId
    ? row.questionId.replace(/_/g, " ")
    : `Question from page ${row.pageNumber}`;

  if (row.fromNodent || row.questionId) {
    if (isMultipart) {
      if (stem && !isBrokenMathStem(stem)) return stem;
      if (row.useImage) return "See figure.";
      if (stem && !isBrokenMathStem(stem)) return stem;
      return pageFallback;
    }
    if (stem) return stem;
    if (partLines.length) return partLines.join("\n");
    if (row.useImage) return "See figure.";
    return pageFallback;
  }

  if (stem && stem !== "See figure.") return stem;
  if (imagePrimary && row.useImage) return "See figure.";
  if (partLines.length >= 2) return partLines.join("\n");
  return pageFallback;
}

function partPreviewText(parts: PartDraft[], descriptor: string, index: number): string {
  if (parts.length >= 2) {
    return formatPartDescriptor(partLetterForIndex(index), descriptor);
  }
  return formatSinglePartLabel(descriptor) || descriptor.trim();
}

function buildAnswerPartsPayload(parts: PartDraft[]) {
  const multi = parts.length >= 2;
  return parts.map((p, i) => {
    const letter = partLetterForIndex(i);
    const rawDescriptor = p.descriptor.trim();
    const body = stripMainPartPrefix(rawDescriptor);
    const descriptor = multi
      ? body
        ? formatPartDescriptor(letter, body)
        : `${letter})`
      : body || rawDescriptor || "Answer";
    return {
      key: multi ? letter : "a",
      label: descriptor,
      placeholder: p.placeholder.trim() || "Type your answer…",
      marks: Math.max(1, Math.round(p.marks || 1)),
      ...(p.imageDataUrl ? { imageUrl: p.imageDataUrl } : {}),
    };
  });
}

export function PdfQuestionImportPanel({
  subjects,
  defaultSubjectId = "",
  onImported,
}: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const demoSubjectId = subjects.find((s) => s.id === "demo")?.id;
  const initialSubject =
    defaultSubjectId ||
    (import.meta.env.DEV && demoSubjectId ? demoSubjectId : "") ||
    subjects[0]?.id ||
    "";
  const [subjectId, setSubjectId] = useState(initialSubject);
  const [imagePrimary, setImagePrimary] = useState(false);
  const [defaultTopic, setDefaultTopic] = useState("General");
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState("");
  const [parseDiagnostics, setParseDiagnostics] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [croppingRowId, setCroppingRowId] = useState<string | null>(null);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [expandedPreview, setExpandedPreview] = useState<string | null>(null);

  const topicOptions = useMemo(() => {
    const labels = topicLabelsForSubject(subjectId);
    return labels.length ? [...labels] : ["General"];
  }, [subjectId]);

  const selectedCount = rows.filter((r) => r.selected).length;

  const processNodentPdf = async (file: File) => {
    setParsing(true);
    setParseProgress("Loading PDF…");
    setRows([]);
    setParseDiagnostics([]);
    try {
      const { questions, errors } = await parseNodentPdfToQuestions(file, {
        imagePrimary,
        onProgress: (page, total) => {
          setParseProgress(`Processing page ${page} of ${total}…`);
        },
      });
      setParseDiagnostics(errors);
      if (!questions.length) {
        const sample = errors.slice(0, 5).join(" · ");
        console.warn("[nodent-import] 0 questions", { errors, file: file.name });
        toast.error(
          sample ||
            "No questions parsed. Each page needs ---NODENT--- blocks with question_id.",
          { duration: 10000 },
        );
        return;
      }
      if (errors.length) {
        toast.message(`${questions.length} question(s) loaded (${errors.length} page warning(s)).`, {
          duration: 5000,
        });
        console.warn("[nodent-import]", errors);
      }

      const metaSubject = questions.find((q) => q.subjectId)?.subjectId;
      if (
        metaSubject &&
        metaSubject !== subjectId &&
        subjects.some((s) => s.id === metaSubject)
      ) {
        toast.message(
          `PDF metadata references "${metaSubject}" — questions will import into "${subjectId}" (your subject selection).`,
          { duration: 6000 },
        );
      }

      setRows(
        questions.map((q) => {
          const labels = topicLabelsForSubject(q.subjectId || subjectId);
          const topic = labels.includes(q.topic) ? q.topic : defaultTopic;
          const mcq = mcqFieldsFromParsed(
            {
              question: q.question,
              mcqOptions: q.mcqOptions,
              mcqCorrectAnswer: q.correctAnswer,
            },
            q.type,
          );
          return draftRowDefaults({
            id: q.id,
            questionId: q.questionId,
            metaSubjectId: q.subjectId || undefined,
            pageNumber: q.pageNumber,
            pageQuestionIndex: q.pageQuestionIndex,
            pageQuestionCount: q.pageQuestionCount,
            question: mcq.question,
            passage: q.passage,
            marks:
              mcq.type === "mcq"
                ? 1
                : q.parts.length >= 2
                  ? totalMarksForRow(q.parts, q.marks)
                  : q.marks,
            imageDataUrl: q.imageDataUrl,
            sourceImageDataUrl: q.sourceImageDataUrl,
            crop: q.crop,
            topic,
            type: mcq.type,
            parts: mcq.type === "mcq" ? emptyPartsForMcq() : q.parts,
            fromNodent: true,
            useImage: q.useImage !== false,
            mcqOptions: mcq.mcqOptions,
            correctAnswer: mcq.correctAnswer,
          }, subjectId);
        }),
      );
      toast.success(
        `Loaded ${questions.length} question(s). Metadata stripped — review figures and import.`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not read NODENT PDF.";
      toast.error(msg);
      console.error("[nodent-import]", e);
    } finally {
      setParsing(false);
      setParseProgress("");
    }
  };

  const clearSubjectQuestions = async () => {
    if (!subjectId) return;
    if (!window.confirm(`Delete ALL questions in subject "${subjectId}"? This cannot be undone.`)) {
      return;
    }
    setClearing(true);
    try {
      const res = await apiFetchAdmin<{ deleted: number }>(
        API_PATHS.admin.questionsDeleteBySubject,
        {
          method: "POST",
          body: JSON.stringify({ subjectId }),
        },
      );
      purgeCustomQuestionsForSubject(subjectId);
      setRows([]);
      setExpandedPreview(null);
      toast.success(`Removed ${res.deleted ?? 0} question(s) from ${subjectId}.`);
      await onImported?.();
    } catch (e) {
      toast.error(e instanceof ApiError ? e.message : "Could not clear subject.");
    } finally {
      setClearing(false);
    }
  };

  const importSelected = async () => {
    const chosen = rows.filter((r) => r.selected);
    if (!chosen.length) {
      toast.error("Select at least one question to import.");
      return;
    }
    if (!subjectId) {
      toast.error("Choose a subject first.");
      return;
    }

    const mcqIncomplete = chosen.filter(
      (r) =>
        r.type === "mcq" &&
        (r.mcqOptions.length < 4 ||
          r.mcqOptions.some((o) => !o.trim()) ||
          !r.correctAnswer.trim()),
    );
    if (mcqIncomplete.length) {
      toast.error(
        "MCQ rows need all four options (A–D) filled and a correct answer selected.",
      );
      return;
    }

    const invalidRows = chosen
      .map((r, idx) => {
        const question = buildImportQuestion(r, imagePrimary).trim();
        if (!question) {
          return `Row ${idx + 1}: question text is empty — add a stem or part labels.`;
        }
        return null;
      })
      .filter((msg): msg is string => msg != null);
    if (invalidRows.length) {
      toast.error(invalidRows[0]!, { duration: 8000 });
      if (invalidRows.length > 1) {
        console.warn("[pdf-import] validation", invalidRows);
      }
      return;
    }

    setImporting(true);
    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];
    const CHUNK = 2;

    try {
      for (let start = 0; start < chosen.length; start += CHUNK) {
        const chunk = chosen.slice(start, start + CHUNK);
        const payload = {
          questions: chunk.map((r) => {
            const question = buildImportQuestion(r, imagePrimary);

            const rawImages: string[] = !r.useImage
              ? []
              : r.imageDataUrls?.length
                ? r.imageDataUrls
                : r.imageDataUrl
                  ? [r.imageDataUrl]
                  : r.sourceImageDataUrl
                    ? [r.sourceImageDataUrl]
                    : [];
            const imageUrls = rawImages.map((url, idx) => {
              if (idx !== 0) return url;
              if (r.cropApplied) return r.imageDataUrl;
              return r.sourceImageDataUrl ?? url;
            });

            if (r.type === "mcq") {
              return {
                subjectId,
                type: "mcq" as const,
                topic: r.topic || "General",
                question,
                passage: r.passage?.trim() || undefined,
                imageUrls,
                marks: Math.max(1, Math.round(r.marks) || 1),
                options: normalizeMcqOptions(r.mcqOptions.map((o) => o.trim())),
                correctAnswer: r.correctAnswer.trim(),
              };
            }

            const parts = r.parts.filter(
              (p) => p.descriptor.trim() || p.placeholder.trim() || p.acceptedAnswer.trim(),
            );
            const multi = parts.length >= 2;
            const accepted = parts
              .map((p) => p.acceptedAnswer.trim())
              .filter(Boolean);
            const questionMarks = multi
              ? totalMarksForRow(parts, r.marks)
              : Math.max(1, Math.round(r.marks));

            const answerParts =
              parts.length > 0 ? buildAnswerPartsPayload(parts) : undefined;

            let type = r.type;
            if (r.useAiMarking) {
              type = "long_answer";
            } else if (multi || accepted.length >= 2) {
              if (r.type !== "long_answer") type = "short_answer";
            } else if (accepted.length === 1 && r.type !== "long_answer") {
              type = "short_answer";
            }

            return {
              subjectId,
              type,
              topic: r.topic || "General",
              question,
              passage: r.passage?.trim() || undefined,
              imageUrls,
              marks: questionMarks,
              useAiMarking: r.useAiMarking,
              acceptedAnswers:
                accepted.length > 0
                  ? accepted
                  : type === "long_answer"
                    ? ["See marking guide"]
                    : undefined,
              answerParts,
            };
          }),
        };

        try {
          const res = await apiFetchAdmin<{
            imported: number;
            skipped?: number;
            errors?: { index: number; message: string }[];
          }>(API_PATHS.admin.questionsBulk, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          imported += Number(res?.imported ?? 0);
          skipped += Number(res?.skipped ?? 0);
          if (res?.errors?.length) {
            errors.push(
              ...res.errors.map(
                (err) => `Row ${start + err.index + 1}: ${err.message}`,
              ),
            );
          }
        } catch (e) {
          const msg =
            e instanceof ApiError
              ? e.message
              : isFetchTimeoutError(e)
                ? API_UNREACHABLE_MESSAGE
                : "Import failed.";
          errors.push(`Batch at row ${start + 1}: ${msg}`);
        }
      }

      if (imported > 0) {
        purgeCustomQuestionsForSubject(subjectId);
        await onImported?.();
        setRows([]);
        if (fileRef.current) fileRef.current.value = "";
      }

      if (errors.length) {
        toast.error(
          imported > 0
            ? `Imported ${imported}, but ${errors.length} failed. See console for details.`
            : errors[0] ?? "Import failed.",
          { duration: 10000 },
        );
        console.error("[pdf-import]", errors);
      } else if (imported === 0 && skipped > 0) {
        toast.error(
          `No new questions imported — ${skipped} already exist in "${subjectId}" (duplicate text). Clear the subject or edit the question text.`,
          { duration: 12000 },
        );
      } else if (imported === 0) {
        toast.error("No questions were imported. Check that rows are selected and the API is running.", {
          duration: 10000,
        });
      } else if (skipped > 0) {
        toast.success(
          `Imported ${imported} question(s) into "${subjectId}" (${skipped} duplicate(s) skipped).`,
        );
      } else {
        toast.success(`Imported ${imported} question(s) into "${subjectId}".`);
      }
    } finally {
      setImporting(false);
    }
  };

  const updateRow = (id: string, patch: Partial<DraftRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const finishCropping = async (row: DraftRow) => {
    if (!row.cropping) {
      updateRow(row.id, { cropping: true });
      return;
    }
    setCroppingRowId(row.id);
    const cropSource = row.sourceImageDataUrl ?? row.imageDataUrl;
    try {
      if (isMeaningfulCrop(row.crop)) {
        const cropped = await cropImageDataUrl(cropSource, row.crop);
        const urls = row.imageDataUrls?.length
          ? row.imageDataUrls.map((url, idx) => (idx === 0 ? cropped : url))
          : undefined;
        setRows((prev) => applySharedPageCrop(prev, row, cropped, urls));
        const shared =
          (row.pageQuestionCount ?? 1) > 1 ? ` (shared with ${row.pageQuestionCount} on page)` : "";
        toast.success(`Page ${row.pageNumber}: crop applied${shared}.`);
      } else {
        updateRow(row.id, { cropping: false });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not apply crop.";
      toast.error(msg);
    } finally {
      setCroppingRowId(null);
    }
  };

  const updatePart = (rowId: string, partIndex: number, patch: Partial<PartDraft>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const parts = r.parts.map((p, i) => (i === partIndex ? { ...p, ...patch } : p));
        const marks =
          parts.length >= 2 ? totalMarksForRow(parts, r.marks) : r.marks;
        return { ...r, parts, marks };
      }),
    );
  };

  return (
    <Card className="surface-card">
      <CardHeader>
        <CardTitle className="font-display text-lg">Import questions</CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload a PDF, crop figures, set answers, then import.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Subject</Label>
            <Select value={subjectId} onValueChange={(v) => v && setSubjectId(v)}>
              <SelectTrigger className="bg-white/60">
                <SelectValue placeholder="Choose subject" />
              </SelectTrigger>
              <SelectContent>
                {subjects.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {rows.some((r) => r.metaSubjectId && r.metaSubjectId !== subjectId) ? (
              <p className="text-xs text-amber-800">
                PDF metadata says{" "}
                <span className="font-medium">{rows.find((r) => r.metaSubjectId)?.metaSubjectId}</span>
                {" — "}importing into <span className="font-medium">{subjectId}</span> (your selection).
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Default topic</Label>
            <Select value={defaultTopic} onValueChange={(v) => v && setDefaultTopic(v)}>
              <SelectTrigger className="bg-white/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {topicOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={imagePrimary}
            onChange={(e) => setImagePrimary(e.target.checked)}
          />
          Image-first (minimal question text — students mainly see the cropped figure)
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            disabled={importing}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              toast.message(`Reading ${f.name}…`);
              void processNodentPdf(f);
              e.currentTarget.value = "";
            }}
          />
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            disabled={importing}
            onClick={() => fileRef.current?.click()}
          >
            {parsing ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
            {parsing ? parseProgress || "Processing…" : "Choose PDF"}
          </Button>

          {rows.length > 0 ? (
            <>
              <Button
                type="button"
                variant="accent"
                disabled={importing || selectedCount === 0}
                className="gap-2"
                onClick={() => void importSelected()}
              >
                {importing ? <Loader2 className="size-4 animate-spin" /> : null}
                Import {selectedCount} selected
              </Button>
              <Button type="button" variant="outline" disabled={importing} onClick={() => setRows([])}>
                Clear preview
              </Button>
            </>
          ) : null}

          {subjectId ? (
            <Button
              type="button"
              variant="outline"
              className="gap-2 text-red-700 hover:text-red-800"
              disabled={clearing || importing}
              onClick={() => void clearSubjectQuestions()}
            >
              {clearing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Clear all {subjectId} questions
            </Button>
          ) : null}
        </div>

        {parseDiagnostics.length > 0 && rows.length === 0 ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium">Import finished with no questions.</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
              {parseDiagnostics.slice(0, 8).map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
            {parseDiagnostics.length > 8 ? (
              <p className="mt-2 text-xs text-amber-800">
                …and {parseDiagnostics.length - 8} more page(s). Open browser console for page 1 text sample.
              </p>
            ) : null}
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="space-y-4">
            {rows.map((row) => (
              <div
                key={row.id}
                className="rounded-xl border border-black/10 bg-white/70 p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={row.selected}
                      onChange={(e) => updateRow(row.id, { selected: e.target.checked })}
                    />
                    {row.questionId ? (
                      <span className="font-mono text-xs">{row.questionId}</span>
                    ) : row.pageNumbers && row.pageNumbers.length > 1 ? (
                      `Pages ${row.pageNumbers.join(", ")}`
                    ) : row.pageQuestionCount && row.pageQuestionCount > 1 ? (
                      `Page ${row.pageNumber} · Q ${row.pageQuestionIndex}/${row.pageQuestionCount}`
                    ) : (
                      `Page ${row.pageNumber}`
                    )}
                    {!row.useImage ? (
                      <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        No image
                      </span>
                    ) : row.pageQuestionCount && row.pageQuestionCount > 1 ? (
                      <span className="ml-1 rounded bg-brand/10 px-1.5 py-0.5 text-[10px] font-medium text-brand-dark">
                        Shared figure
                      </span>
                    ) : null}
                    {row.type !== "mcq" && row.useAiMarking ? (
                      <span className="ml-1 rounded bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-800 dark:text-violet-200">
                        AI marking
                      </span>
                    ) : null}
                    {row.parts.length >= 2 ? (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({row.parts.length} parts · {totalMarksForRow(row.parts, row.marks)} marks)
                      </span>
                    ) : (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        ({row.marks} {row.marks === 1 ? "mark" : "marks"})
                      </span>
                    )}
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant={row.useImage ? "outline" : "secondary"}
                      onClick={() =>
                        updateRow(row.id, {
                          useImage: !row.useImage,
                          cropping: false,
                        })
                      }
                    >
                      {row.useImage ? "No stimulus image" : "Include image"}
                    </Button>
                    {row.type !== "mcq" ? (
                      <Button
                        type="button"
                        size="sm"
                        variant={row.useAiMarking ? "default" : "outline"}
                        onClick={() =>
                          updateRow(row.id, { useAiMarking: !row.useAiMarking })
                        }
                      >
                        {row.useAiMarking ? "Smart marking on" : "Smart marking off"}
                      </Button>
                    ) : null}
                    {row.useImage ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={croppingRowId === row.id}
                      onClick={() => void finishCropping(row)}
                    >
                      {croppingRowId === row.id ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : null}
                      {row.cropping ? "Done cropping" : "Crop image"}
                    </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setExpandedPreview((cur) => (cur === row.id ? null : row.id))
                      }
                    >
                      {expandedPreview === row.id ? "Hide preview" : "Quiz preview"}
                    </Button>
                  </div>
                </div>

                {row.useImage && row.cropping ? (
                  <div className="mt-3">
                    <PdfPageCropEditor
                      imageDataUrl={row.sourceImageDataUrl ?? row.imageDataUrl}
                      crop={row.crop}
                      onCropChange={(c) => updateRow(row.id, { crop: c })}
                      onApply={(cropped) => {
                        setCroppingRowId(null);
                        const urls = row.imageDataUrls?.length
                          ? row.imageDataUrls.map((url, idx) =>
                              idx === 0 ? cropped : url,
                            )
                          : undefined;
                        setRows((prev) => applySharedPageCrop(prev, row, cropped, urls));
                        toast.success(`Page ${row.pageNumber}: crop applied.`);
                      }}
                      onCancel={() => {
                        setCroppingRowId(null);
                        updateRow(row.id, { cropping: false });
                      }}
                    />
                  </div>
                ) : row.useImage ? (
                  isPrimaryStimulusRow(row, rows) ? (
                  <div className="mt-3 space-y-2">
                    {getRowPreviewImageUrls(row).map((url, ii) => (
                      <div
                        key={`${row.id}-img-${ii}`}
                        className="overflow-hidden rounded-lg border border-black/10"
                      >
                        <img
                          src={url}
                          alt={`PDF page figure ${ii + 1}`}
                          className="max-h-72 w-full bg-muted/20 object-contain"
                        />
                      </div>
                    ))}
                    {(row.pageQuestionCount ?? 1) > 1 ? (
                      <p className="text-xs text-muted-foreground">
                        Shared figure for all {row.pageQuestionCount} questions on page {row.pageNumber}.
                      </p>
                    ) : null}
                  </div>
                  ) : (row.pageQuestionCount ?? 1) > 1 ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      Uses the shared figure from page {row.pageNumber} (shown on Q 1/{row.pageQuestionCount}).
                    </p>
                  ) : null
                ) : null}

                <div className="mt-4 grid gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label>Topic</Label>
                    <Select
                      value={row.topic}
                      onValueChange={(v) => v && updateRow(row.id, { topic: v })}
                    >
                      <SelectTrigger className="bg-white/60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {topicOptions.map((t) => (
                          <SelectItem key={t} value={t}>
                            {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Type</Label>
                    <Select
                      value={row.type}
                      onValueChange={(v) => {
                        if (!v) return;
                        const nextType = v as QuestionType;
                        if (nextType === "mcq") {
                          const extracted = extractMcqOptionsFromText(row.question);
                          const hasOptions =
                            extracted.options?.length === 4 &&
                            extracted.options.every((o) => o.trim());
                          updateRow(row.id, {
                            type: "mcq",
                            marks: 1,
                            parts: emptyPartsForMcq(),
                            useAiMarking: false,
                            ...(hasOptions
                              ? {
                                  mcqOptions: [...extracted.options!],
                                  correctAnswer:
                                    extracted.correctAnswer || row.correctAnswer,
                                  question: extracted.stem.trim() || row.question,
                                }
                              : {
                                  mcqOptions:
                                    row.mcqOptions.some((o) => o.trim())
                                      ? row.mcqOptions
                                      : defaultMcqOptions(),
                                }),
                          });
                          return;
                        }
                        updateRow(row.id, {
                          type: nextType,
                          useAiMarking: aiMarkingForDraft(
                            nextType,
                            row.question,
                            row.parts,
                            subjectId,
                          ),
                        });
                      }}
                    >
                      <SelectTrigger className="bg-white/60">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="long_answer">Long answer</SelectItem>
                        <SelectItem value="short_answer">Short answer</SelectItem>
                        <SelectItem value="mcq">Multiple choice</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {row.type === "mcq" || row.parts.length < 2 ? (
                    <div className="space-y-1.5">
                      <Label>Marks</Label>
                      <Input
                        type="number"
                        min={1}
                        value={row.marks}
                        onChange={(e) =>
                          updateRow(row.id, {
                            marks: Math.max(1, Number(e.target.value) || 1),
                          })
                        }
                        className="bg-white/60"
                      />
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 space-y-2">
                  <Label>Stimulus / passage (shared context, LaTeX ok)</Label>
                  <Textarea
                    value={row.passage ?? ""}
                    onChange={(e) => updateRow(row.id, { passage: e.target.value })}
                    rows={4}
                    className="bg-white text-sm font-mono"
                    placeholder="e.g. The function $f$ is defined by $f(x)=x^2+1$ for $x\in\mathbb{R}$."
                  />
                  <ImportMathPreview text={row.passage ?? ""} />
                </div>

                <div className="mt-4 space-y-2">
                  <Label>Question text (optional if image-first)</Label>
                  <Textarea
                    value={row.question}
                    onChange={(e) => updateRow(row.id, { question: e.target.value })}
                    onBlur={() => {
                      const question = row.question;
                      const patch: Partial<DraftRow> = {};
                      const mcq = extractMcqOptionsFromText(question);
                      if (mcq.options?.every((o) => o.trim())) {
                        patch.type = "mcq";
                        patch.mcqOptions = [...mcq.options];
                        patch.correctAnswer = mcq.correctAnswer || row.correctAnswer;
                        patch.question = mcq.stem.trim() || question;
                        patch.marks = 1;
                        patch.parts = emptyPartsForMcq();
                      } else if (row.parts.length === 1) {
                        const { parts } = detectLetterSubparts(question);
                        if (parts.length >= 2) {
                          patch.parts = partsFromParsed({ detectedParts: parts });
                        }
                      }
                      if (Object.keys(patch).length) updateRow(row.id, patch);
                    }}
                    rows={4}
                    className="bg-white text-sm font-mono"
                    placeholder="Leave as “See figure.” or add LaTeX, e.g. $f(x)=x^2$"
                  />
                  <ImportMathPreview text={row.question} />
                </div>

                {row.type === "mcq" ? (
                  <div className="mt-4 space-y-3">
                    <Label>Options</Label>
                    {MCQ_LETTERS.map((letter, i) => (
                      <div key={letter} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium">
                            {letter}
                          </span>
                          <Input
                            placeholder={`Option ${letter}`}
                            value={row.mcqOptions[i] ?? ""}
                            onChange={(e) => {
                              const next = [...row.mcqOptions];
                              while (next.length < 4) next.push("");
                              next[i] = e.target.value;
                              updateRow(row.id, { mcqOptions: next });
                            }}
                            className="bg-white/80 text-sm font-mono"
                          />
                        </div>
                        <ImportMathPreview text={stripMcqOptionPrefix(row.mcqOptions[i] ?? "", letter)} className="ml-9" />
                      </div>
                    ))}
                    <div className="space-y-1.5">
                      <Label>Correct answer</Label>
                      <Select
                        value={row.correctAnswer}
                        onValueChange={(v) => v && updateRow(row.id, { correctAnswer: v })}
                      >
                        <SelectTrigger className="bg-white/60">
                          <SelectValue placeholder="Select correct option" />
                        </SelectTrigger>
                        <SelectContent>
                          {MCQ_LETTERS.map((letter, i) => (
                            <SelectItem
                              key={letter}
                              value={letter}
                              disabled={!row.mcqOptions[i]?.trim()}
                            >
                              {letter}
                              {row.mcqOptions[i]?.trim()
                                ? `: ${row.mcqOptions[i]!.trim()}`
                                : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ) : (
                <div className="mt-4 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <Label>Answer parts</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() =>
                        updateRow(row.id, {
                          parts: [...row.parts, defaultPart(row.parts.length)],
                        })
                      }
                    >
                      <Plus className="size-3.5" />
                      Add part
                    </Button>
                  </div>
                  {row.parts.map((part, pi) => (
                    <div
                      key={`${row.id}-part-${pi}`}
                      className="grid gap-2 rounded-lg border border-black/10 bg-white p-3 sm:grid-cols-2"
                    >
                      {part.imageDataUrl ? (
                        <div className="sm:col-span-2 overflow-hidden rounded-md border border-black/10">
                          <img
                            src={part.imageDataUrl}
                            alt={`Part ${part.label} figure`}
                            className="max-h-48 w-full bg-muted/20 object-contain"
                          />
                          <p className="px-2 py-1 text-[11px] text-muted-foreground">
                            Figure for part {part.label}
                          </p>
                        </div>
                      ) : null}
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">Part label (shown to student)</Label>
                        <Input
                          value={part.descriptor}
                          onChange={(e) => updatePart(row.id, pi, { descriptor: e.target.value })}
                          onBlur={() => {
                            const next = part.descriptor.replace(
                              /\(\s*\d+\s*marks?\s*\)/gi,
                              "",
                            ).trim();
                            if (next !== part.descriptor) {
                              updatePart(row.id, pi, { descriptor: next });
                            }
                          }}
                          placeholder="e.g. a) Find the mean"
                          className="bg-white/80 text-sm font-mono"
                        />
                        <ImportMathPreview
                          text={partPreviewText(row.parts, part.descriptor, pi)}
                        />
                      </div>
                      {row.parts.length >= 2 ? (
                        <div className="space-y-1.5">
                          <Label className="text-xs">Marks</Label>
                          <Input
                            type="number"
                            min={1}
                            value={part.marks}
                            onChange={(e) =>
                              updatePart(row.id, pi, {
                                marks: Math.max(1, Number(e.target.value) || 1),
                              })
                            }
                            className="bg-white/80 text-sm"
                          />
                        </div>
                      ) : null}
                      <div className="space-y-1.5">
                        <Label className="text-xs">Input placeholder (grey hint)</Label>
                        <Input
                          value={part.placeholder}
                          onChange={(e) => updatePart(row.id, pi, { placeholder: e.target.value })}
                          placeholder="e.g. Enter your answer in dollars"
                          className="bg-white/80 text-sm"
                        />
                      </div>
                      <div className="space-y-1.5 sm:col-span-2">
                        <Label className="text-xs">Correct answer</Label>
                        <Input
                          value={part.acceptedAnswer}
                          onChange={(e) =>
                            updatePart(row.id, pi, { acceptedAnswer: e.target.value })
                          }
                          placeholder="e.g. 42 or $12.50"
                          className="bg-white/80 text-sm"
                        />
                      </div>
                      {row.parts.length > 1 ? (
                        <div className="sm:col-span-2">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="text-red-700"
                            onClick={() =>
                              updateRow(row.id, {
                                parts: row.parts.filter((_, i) => i !== pi),
                              })
                            }
                          >
                            <Trash2 className="mr-1 size-3.5" />
                            Remove part
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                )}

                {expandedPreview === row.id ? (
                  <div className="mt-4 rounded-lg border border-brand/20 bg-brand/5 p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-dark">
                      How students will see it
                    </p>
                    <div className="rounded-lg border border-black/10 bg-white p-4">
                      {row.passage?.trim() ? (
                        <PassageBlock passage={row.passage} />
                      ) : null}
                      {row.question.trim() && row.question !== "See figure." ? (
                        <div className={row.passage?.trim() ? "mt-4" : undefined}>
                          <RichQuestionContent
                            text={row.question}
                            className="prose prose-base max-w-none sm:prose-lg"
                          />
                        </div>
                      ) : null}
                      {isPrimaryStimulusRow(row, rows) ? (
                        <QuestionImageGrid
                          urls={getRowPreviewImageUrls(row)}
                          title="Source material"
                        />
                      ) : (row.pageQuestionCount ?? 1) > 1 && row.useImage ? (
                        <p className="text-xs text-muted-foreground">
                          Shared stimulus shown with Q 1 on page {row.pageNumber}.
                        </p>
                      ) : null}
                      <div className="mt-4 space-y-3 border-t border-black/10 pt-4">
                        {row.type === "mcq" ? (
                          <div className="space-y-2">
                            {MCQ_LETTERS.map((letter, i) => (
                              <div
                                key={`${row.id}-preview-mcq-${letter}`}
                                className={cn(
                                  "rounded-lg border px-3 py-2 text-sm",
                                  row.correctAnswer === letter
                                    ? "border-brand/40 bg-brand/5"
                                    : "border-black/10 bg-muted/20",
                                )}
                              >
                                <span className="font-medium">{letter}.</span>{" "}
                                <RichQuestionContent
                                  text={
                                    stripMcqOptionPrefix(
                                      row.mcqOptions[i]?.trim() || `Option ${letter}`,
                                      letter,
                                    )
                                  }
                                  className="prose prose-sm inline max-w-none prose-p:my-0"
                                />
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                        {row.parts.length >= 2 ? (
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {row.parts.length} answer inputs on one page
                          </p>
                        ) : null}
                        {row.parts.map((part, pi) => (
                          <div key={`${row.id}-preview-part-${pi}`} className="space-y-2">
                            {part.imageDataUrl ? (
                              <QuestionImageGrid urls={[part.imageDataUrl]} />
                            ) : null}
                            <div className="font-display text-[1.18rem] leading-relaxed text-foreground sm:text-[1.45rem]">
                              <RichQuestionContent
                                text={partPreviewText(row.parts, part.descriptor, pi)}
                                className="prose prose-base max-w-none prose-p:my-0 sm:prose-lg"
                              />
                            </div>
                            <Input
                              disabled
                              placeholder={part.placeholder || "Type your answer…"}
                              className="bg-muted/30"
                            />
                          </div>
                        ))}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
