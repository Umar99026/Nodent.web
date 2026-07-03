import { useRef, useState } from "react";
import {
  CheckCircle2,
  Copy,
  ImagePlus,
  Loader2,
  Plus,
  Settings2,
  Trash2,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QuestionImageGrid } from "@/components/quiz/QuestionStimulus";
import { QuizStyleField } from "@/components/create/QuizStyleField";
import { PdfPageCropEditor } from "@/components/admin/PdfPageCropEditor";
import {
  emptyMultipartParts,
  type MultipartPartDraft,
} from "@/components/admin/MultipartAnswerPartsEditor";
import {
  compressDataUrlIfLarge,
  compressImageFileToDataUrl,
} from "@/lib/imageCompressor";
import { FULL_CROP, type CropRect } from "@/lib/pdfImageCrop";
import {
  QUESTION_TYPE_LABELS,
  questionDraftMarks,
  type QuestionDraft,
  type QuestionDraftType,
} from "@/lib/createAssessmentDraft";
import { getQuestionTypeLabel, normalizeAcceptedAnswerForStorage, normalizeAcceptedAnswersText } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { InlineInputsEditor } from "@/components/create/InlineInputsEditor";
import { createInlineInputBox } from "@/lib/diagramLabels";
import { PasteQuestionAnswers } from "@/components/create/PasteQuestionAnswers";

const QUESTION_TYPES: { value: QuestionDraftType; label: string }[] = [
  { value: "mcq", label: "Multiple Choice" },
  { value: "short_answer", label: "Short Answer" },
  { value: "long_answer", label: "Long Answer" },
];

function supportsAnswerParts(type: QuestionDraftType): boolean {
  return type === "short_answer" || type === "long_answer";
}

type QuestionDraftEditorProps = {
  draft: QuestionDraft;
  index: number;
  onChange: (draft: QuestionDraft) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  canRemove: boolean;
};

export function QuestionDraftEditor({
  draft,
  index,
  onChange,
  onRemove,
  onDuplicate,
  canRemove,
}: QuestionDraftEditorProps) {
  const [showSettings, setShowSettings] = useState(false);
  const [showFigures, setShowFigures] = useState(draft.imageUrls.length > 0);
  const [uploadingPartIndex, setUploadingPartIndex] = useState<number | null>(null);
  const [croppingImageIndex, setCroppingImageIndex] = useState<number | null>(null);
  const [cropRect, setCropRect] = useState<CropRect>(FULL_CROP);
  const cropSourceRef = useRef<Record<number, string>>({});
  const fileRef = useRef<HTMLInputElement | null>(null);

  const update = (patch: Partial<QuestionDraft>) => onChange({ ...draft, ...patch });

  const marks = questionDraftMarks(draft);
  const usesPartMarks =
    (supportsAnswerParts(draft.type) && draft.multipartEnabled) || draft.labelDiagramEnabled;

  const uploadPartImage = async (file: File, partIndex: number) => {
    if (!file.type.startsWith("image/")) return;
    setUploadingPartIndex(partIndex);
    try {
      const url = await compressImageFileToDataUrl(file, {
        maxWidth: 1000,
        maxHeight: 1000,
        quality: 0.65,
        outputType: "image/jpeg",
      });
      update({
        answerParts: draft.answerParts.map((p, i) =>
          i === partIndex ? { ...p, imageUrl: url } : p,
        ),
      });
    } finally {
      setUploadingPartIndex(null);
    }
  };

  const appendQuestionImage = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    if (draft.imageUrls.length >= 6) {
      toast.error("Maximum 6 images per question.");
      return;
    }
    try {
      const url = await compressImageFileToDataUrl(file, {
        maxWidth: 900,
        maxHeight: 900,
        quality: 0.62,
        outputType: "image/jpeg",
      });
      update({ imageUrls: draft.labelDiagramEnabled ? [url] : [...draft.imageUrls, url] });
      setShowFigures(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not process image.");
    }
  };

  const applyCrop = async (index: number, cropped: string) => {
    try {
      const compressed = await compressDataUrlIfLarge(cropped);
      update({
        imageUrls: draft.imageUrls.map((url, i) => (i === index ? compressed : url)),
      });
      setCroppingImageIndex(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not crop image.");
    }
  };

  const updatePart = (idx: number, patch: Partial<MultipartPartDraft>) => {
    update({
      answerParts: draft.answerParts.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    });
  };

  const addPart = () => {
    const letter = String.fromCharCode(97 + draft.answerParts.length);
    update({
      multipartEnabled: true,
      answerParts: [
        ...draft.answerParts,
        {
          key: letter,
          label: `${letter})`,
          marks: 1,
          placeholder: "",
          acceptedAnswer: "",
        },
      ],
    });
  };

  const removePart = (idx: number) => {
    if (draft.answerParts.length <= 2) return;
    update({ answerParts: draft.answerParts.filter((_, i) => i !== idx) });
  };

  const optionLabels = ["A", "B", "C", "D"];

  return (
    <article className="overflow-hidden rounded-xl border border-black/10 border-l-4 border-l-brand-light/60 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-black/6 bg-[#fafbfc] px-3 py-2 sm:px-4">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#0b0f19] text-xs font-bold text-white">
          {index + 1}
        </span>

        <Select
          value={draft.type}
          onValueChange={(v) => {
            const type = v as QuestionDraftType;
            update(
              type === "mcq"
                ? { type, multipartEnabled: false, labelDiagramEnabled: false }
                : { type },
            );
          }}
        >
          <SelectTrigger className="h-8 w-auto min-w-[9rem] border-black/10 bg-white text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {QUESTION_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {!usesPartMarks ? (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Input
              type="number"
              min={1}
              max={20}
              className="h-8 w-14 border-black/10 px-2 text-center text-xs"
              value={draft.marks}
              onChange={(e) =>
                update({ marks: Math.max(1, Number(e.target.value) || 1) })
              }
            />
            <span>marks</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{marks} marks total</span>
        )}

        <div className="ml-auto flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={() => setShowSettings((v) => !v)}
          >
            <Settings2 className="size-3.5" />
            {showSettings ? "Hide" : "Marking"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs"
            onClick={onDuplicate}
          >
            <Copy className="size-3.5" />
          </Button>
          {canRemove ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 text-danger hover:text-danger"
              onClick={onRemove}
            >
              <Trash2 className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      {/* Quiz-style body */}
      <div className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary" className="text-xs font-normal">
            {getQuestionTypeLabel(draft.type) || QUESTION_TYPE_LABELS[draft.type]}
          </Badge>
        </div>

        {/* Figures */}
        {draft.labelDiagramEnabled ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Diagram overlay mode is no longer supported. Use multipart parts with horizontal input boxes instead.
          </p>
        ) : draft.imageUrls.length > 0 ? (
          <div className="space-y-2">
            {croppingImageIndex != null ? (
              <PdfPageCropEditor
                imageDataUrl={
                  cropSourceRef.current[croppingImageIndex] ??
                  draft.imageUrls[croppingImageIndex] ??
                  ""
                }
                crop={cropRect}
                onCropChange={setCropRect}
                onApply={(cropped) => void applyCrop(croppingImageIndex, cropped)}
                onCancel={() => setCroppingImageIndex(null)}
              />
            ) : (
              <>
                <QuestionImageGrid urls={draft.imageUrls} title="" />
                <div className="flex flex-wrap gap-2">
                  {draft.imageUrls.map((_, i) => (
                    <div key={i} className="flex gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          cropSourceRef.current[i] = draft.imageUrls[i]!;
                          setCropRect(FULL_CROP);
                          setCroppingImageIndex(i);
                        }}
                      >
                        Crop fig. {i + 1}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-danger"
                        onClick={() =>
                          update({ imageUrls: draft.imageUrls.filter((_, j) => j !== i) })
                        }
                      >
                        <X className="size-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        ) : null}

        {!draft.labelDiagramEnabled && !showFigures && draft.imageUrls.length === 0 ? (
          <button
            type="button"
            onClick={() => {
              setShowFigures(true);
              fileRef.current?.click();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-black/15 px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:border-brand/40 hover:text-foreground"
          >
            <ImagePlus className="size-3.5" />
            Add figure or graph
          </button>
        ) : showFigures && !draft.labelDiagramEnabled && draft.imageUrls.length < 6 ? (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:underline"
          >
            <ImagePlus className="size-3.5" />
            Add another figure
          </button>
        ) : null}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void appendQuestionImage(file);
            e.currentTarget.value = "";
          }}
        />

        {!usesPartMarks ? (
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {marks} {marks === 1 ? "mark" : "marks"}
          </p>
        ) : null}

        {/* Question stem — shared intro for multipart; main wording for single-part */}
        <QuizStyleField
          value={draft.question}
          onChange={(question) => update({ question })}
          placeholder={
            draft.multipartEnabled
              ? "Shared intro (optional) — e.g. Refer to the graph below…"
              : "Type the question here…"
          }
          multiline
          rows={2}
          variant="stem"
        />

        {/* MCQ options — quiz grid */}
        {draft.type === "mcq" ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Tap a letter to set the correct answer</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {draft.options.map((opt, i) => {
                const letter = optionLabels[i]!;
                const isCorrect = draft.correctAnswer === letter;
                return (
                  <div
                    key={i}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border-2 px-3 py-2.5 transition-colors",
                      isCorrect
                        ? "border-success/50 bg-success/5"
                        : "border-border bg-white",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => update({ correctAnswer: letter })}
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                        isCorrect
                          ? "bg-success text-white"
                          : "bg-muted text-muted-foreground hover:bg-brand/15",
                      )}
                      title="Mark as correct"
                    >
                      {letter}
                    </button>
                    <QuizStyleField
                      value={opt}
                      onChange={(val) => {
                        const next = [...draft.options];
                        next[i] = val;
                        update({ options: next });
                      }}
                      placeholder={`Option ${letter}`}
                      variant="option"
                      className="flex-1"
                    />
                    {isCorrect ? (
                      <CheckCircle2 className="size-4 shrink-0 text-success" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Multipart parts — quiz layout */}
        {supportsAnswerParts(draft.type) ? (
          <div className="space-y-4">
            {!draft.multipartEnabled && !draft.labelDiagramEnabled ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-black/10 bg-white/60 px-3 py-2.5">
                  <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Student answer box (preview)
                  </p>
                  <div className="h-10 rounded-md border border-black/10 bg-muted/30" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="gap-1.5"
                    onClick={() =>
                      update({
                        multipartEnabled: true,
                        labelDiagramEnabled: false,
                        answerParts:
                          draft.answerParts.length >= 2
                            ? draft.answerParts
                            : emptyMultipartParts(2),
                      })
                    }
                  >
                    <Plus className="size-3.5" />
                    Split into parts (a, b, c…)
                  </Button>
                </div>
              </div>
            ) : draft.labelDiagramEnabled ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground"
                onClick={() =>
                  update({
                    labelDiagramEnabled: false,
                    multipartEnabled: false,
                    answerParts: emptyMultipartParts(2),
                  })
                }
              >
                Switch to normal answer mode
              </Button>
            ) : (
              <div className="flex flex-col gap-4 border-t border-black/8 pt-4">
                {draft.answerParts.map((part, idx) => (
                  <div key={`${part.key}-${idx}`} className="space-y-2 rounded-lg border border-black/6 bg-[#fafbfc]/80 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                        Part {idx + 1}
                      </span>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          className="h-7 w-12 border-black/10 px-1 text-center text-xs"
                          value={part.marks ?? 1}
                          onChange={(e) =>
                            updatePart(idx, {
                              marks: Math.max(1, Number(e.target.value) || 1),
                            })
                          }
                        />
                        <span className="text-[11px] text-muted-foreground">marks</span>
                        {draft.answerParts.length > 2 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-7 text-danger"
                            onClick={() => removePart(idx)}
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        ) : null}
                      </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground">
                      Part question text — shown above the figure (e.g.{" "}
                      <span className="text-foreground">b) Label the diagram</span>)
                    </p>
                    <QuizStyleField
                      value={part.label}
                      onChange={(label) => updatePart(idx, { label })}
                      placeholder="e.g. b) Label the diagram"
                      multiline
                      rows={2}
                      variant="part"
                    />

                    {part.imageUrl?.trim() ? (
                      <div className="space-y-2">
                        <QuestionImageGrid urls={[part.imageUrl]} title="" />
                        <button
                          type="button"
                          className="text-xs text-danger hover:underline"
                          onClick={() => updatePart(idx, { imageUrl: "", inlineInputs: undefined })}
                        >
                          Remove part figure
                        </button>
                      </div>
                    ) : (
                      <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-medium text-brand hover:underline">
                        {uploadingPartIndex === idx ? (
                          <Loader2 className="size-3.5 animate-spin" />
                        ) : (
                          <ImagePlus className="size-3.5" />
                        )}
                        Add part figure
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          disabled={uploadingPartIndex != null}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) void uploadPartImage(file, idx);
                            e.currentTarget.value = "";
                          }}
                        />
                      </label>
                    )}

                    <div className="rounded-lg border border-black/10 bg-white/60 px-3 py-2">
                      <p className="mb-1 text-[11px] text-muted-foreground">Answer box (preview)</p>
                      <div className="h-9 rounded-md border border-black/10 bg-muted/30" />
                    </div>

                    <div className="space-y-2">
                      {part.inlineInputs != null ? (
                        <>
                          <InlineInputsEditor
                            inputs={part.inlineInputs}
                            onChange={(inlineInputs) => updatePart(idx, { inlineInputs })}
                          />
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:underline"
                            onClick={() => updatePart(idx, { inlineInputs: undefined })}
                          >
                            Use single answer field instead
                          </button>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2">
                            <Label className="shrink-0 text-xs text-muted-foreground">Correct answer</Label>
                            <Input
                              className="h-8 flex-1 border-black/10 text-sm"
                              placeholder="Correct answer (units optional for numbers)"
                              value={part.acceptedAnswer ?? ""}
                              onChange={(e) => updatePart(idx, { acceptedAnswer: e.target.value })}
                              onBlur={(e) => {
                                const normalized = normalizeAcceptedAnswerForStorage(e.target.value);
                                if (normalized !== e.target.value.trim()) {
                                  updatePart(idx, { acceptedAnswer: normalized });
                                }
                              }}
                            />
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() =>
                              updatePart(idx, { inlineInputs: [createInlineInputBox(0)] })
                            }
                          >
                            Add multiple input boxes (horizontal row)
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addPart}>
                  <Plus className="size-3.5" />
                  Add part
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={() =>
                    update({ multipartEnabled: false, answerParts: emptyMultipartParts(2) })
                  }
                >
                  Switch to single answer
                </Button>
              </div>
            )}
          </div>
        ) : null}

        {/* Marking settings (collapsed by default) */}
        {showSettings ? (
          <div className="space-y-3 rounded-xl border border-black/8 bg-[#f8fafc] p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Marking & answer key
            </p>

            {draft.type === "mcq" ? (
              <p className="text-sm text-muted-foreground">
                Correct answer:{" "}
                <span className="font-semibold text-foreground">
                  {draft.correctAnswer || "—"}
                </span>{" "}
                (click an option letter above to change)
              </p>
            ) : null}

            {supportsAnswerParts(draft.type) &&
            !draft.multipartEnabled &&
            !draft.labelDiagramEnabled ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Accepted answers (one per line)</Label>
                <Textarea
                  className="border-black/10 bg-white text-sm"
                  rows={3}
                  placeholder={"Answer 1\nAnswer 2 (units optional for numbers)"}
                  value={draft.acceptedAnswers}
                  onChange={(e) => update({ acceptedAnswers: e.target.value })}
                  onBlur={(e) => {
                    const normalized = normalizeAcceptedAnswersText(e.target.value);
                    if (normalized !== e.target.value) {
                      update({ acceptedAnswers: normalized });
                    }
                  }}
                />
              </div>
            ) : null}

            {draft.type === "long_answer" ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Marking guidance (optional)</Label>
                <Textarea
                  className="border-black/10 bg-white text-sm"
                  rows={2}
                  placeholder="Notes for AI or manual marking…"
                  value={draft.guidance}
                  onChange={(e) => update({ guidance: e.target.value })}
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <PasteQuestionAnswers draft={draft} onChange={onChange} />
      </div>
    </article>
  );
}
