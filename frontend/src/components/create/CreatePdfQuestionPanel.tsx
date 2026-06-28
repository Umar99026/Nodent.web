import { InlineInputsEditor } from "@/components/create/InlineInputsEditor";
import { PasteQuestionAnswers } from "@/components/create/PasteQuestionAnswers";
import { QuizStyleField } from "@/components/create/QuizStyleField";
import { QuestionImageGrid } from "@/components/quiz/QuestionStimulus";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  emptyMultipartParts,
  type MultipartPartDraft,
} from "@/components/admin/MultipartAnswerPartsEditor";
import type { QuestionDraft, QuestionDraftType } from "@/lib/createAssessmentDraft";
import { createInlineInputBox, partUsesInlineInputs } from "@/lib/diagramLabels";
import { normalizeAcceptedAnswerForStorage, normalizeAcceptedAnswersText } from "@/lib/utils";
import { Plus, X } from "lucide-react";

const QUESTION_TYPES: { value: QuestionDraftType; label: string }[] = [
  { value: "mcq", label: "Multiple Choice" },
  { value: "short_answer", label: "Short Answer" },
  { value: "long_answer", label: "Long Answer" },
];

type CreatePdfQuestionPanelProps = {
  draft: QuestionDraft;
  index: number;
  onChange: (draft: QuestionDraft) => void;
};

export function CreatePdfQuestionPanel({
  draft,
  index,
  onChange,
}: CreatePdfQuestionPanelProps) {
  const update = (patch: Partial<QuestionDraft>) => onChange({ ...draft, ...patch });

  const updatePart = (idx: number, patch: Partial<MultipartPartDraft>) => {
    update({
      answerParts: draft.answerParts.map((p, i) => (i === idx ? { ...p, ...patch } : p)),
    });
  };

  const stimulusUrl = draft.imageUrls[0] ?? "";
  const extraImages = draft.imageUrls.slice(1);
  const showMultipartSection =
    draft.multipartEnabled ||
    draft.answerParts.length >= 2 ||
    draft.answerParts.some(
      (part) =>
        Boolean(part.imageUrl?.trim()) ||
        partUsesInlineInputs(part) ||
        Boolean(part.label?.trim() && part.label.trim() !== `${(part.key?.trim() || "a")})`),
    );

  const ensureMultipart = () => {
    if (!draft.multipartEnabled) {
      update({
        multipartEnabled: true,
        type: draft.type === "mcq" ? "short_answer" : draft.type,
        answerParts:
          draft.answerParts.length >= 2 ? draft.answerParts : emptyMultipartParts(2),
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex size-7 items-center justify-center rounded-full bg-[#0b0f19] text-xs font-bold text-white">
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
          <SelectTrigger className="h-8 w-auto min-w-[9rem] text-xs">
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
        {!draft.multipartEnabled ? (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Input
              type="number"
              min={1}
              max={20}
              className="h-8 w-14 px-2 text-center text-xs"
              value={draft.marks}
              onChange={(e) => update({ marks: Math.max(1, Number(e.target.value) || 1) })}
            />
            marks
          </div>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Main question text (optional shared intro)</Label>
        <QuizStyleField
          value={draft.question}
          onChange={(question) => update({ question })}
          placeholder="Shared intro — e.g. Refer to the diagram below…"
          multiline
          rows={2}
          variant="stem"
        />
      </div>

      {stimulusUrl ? (
        <RegionCard
          title="Question stimulus"
          subtitle="Main figure from your PDF crop"
          onRemove={() => update({ imageUrls: draft.imageUrls.slice(1) })}
        >
          <QuestionImageGrid urls={[stimulusUrl]} title="" />
        </RegionCard>
      ) : null}

      {extraImages.length > 0 ? (
        <RegionCard title="Extra figures" subtitle="Additional cropped regions">
          <QuestionImageGrid urls={extraImages} title="" />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-xs text-danger"
            onClick={() => update({ imageUrls: draft.imageUrls.slice(0, 1) })}
          >
            Remove extras
          </Button>
        </RegionCard>
      ) : null}

      {showMultipartSection ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Parts (a, b, c…)
            </Label>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => {
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
              }}
            >
              <Plus className="size-3" />
              Add part
            </Button>
          </div>

          {draft.answerParts.map((part, idx) => {
            const letter = part.key?.trim() || String.fromCharCode(97 + idx);
            const hasInline = partUsesInlineInputs(part);
            return (
              <RegionCard
                key={`${part.key}-${idx}`}
                title={`Part ${letter})`}
                subtitle={part.imageUrl ? "Has figure from PDF crop" : "Text only"}
                onRemove={
                  draft.answerParts.length > 2
                    ? () =>
                        update({
                          answerParts: draft.answerParts.filter((_, i) => i !== idx),
                        })
                    : undefined
                }
              >
                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] md:items-start">
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground">Part question text</Label>
                      <QuizStyleField
                        value={part.label}
                        onChange={(label) => updatePart(idx, { label })}
                        placeholder={`e.g. ${letter}) Complete the table below`}
                        multiline
                        rows={3}
                        variant="part"
                      />
                    </div>

                    {!hasInline ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={10}
                          className="h-8 w-16 text-xs"
                          value={part.marks ?? 1}
                          onChange={(e) =>
                            updatePart(idx, { marks: Math.max(1, Number(e.target.value) || 1) })
                          }
                        />
                        <span className="text-xs text-muted-foreground">marks</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        Marks are set per input box below.
                      </span>
                    )}

                    {hasInline ? (
                      <>
                        <InlineInputsEditor
                          inputs={part.inlineInputs ?? []}
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
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground">Correct answer</Label>
                        <Input
                          className="h-9 w-full text-sm"
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
                      </div>
                    )}
                  </div>

                  {part.imageUrl?.trim() ? (
                    <div className="space-y-2">
                      <QuestionImageGrid urls={[part.imageUrl]} title="" />
                      <button
                        type="button"
                        className="text-xs text-danger hover:underline"
                        onClick={() => updatePart(idx, { imageUrl: "" })}
                      >
                        Remove figure
                      </button>
                    </div>
                  ) : null}
                </div>
              </RegionCard>
            );
          })}
        </div>
      ) : (
        <Button type="button" variant="secondary" size="sm" className="gap-1.5" onClick={ensureMultipart}>
          <Plus className="size-3.5" />
          Split into parts (a, b, c…)
        </Button>
      )}

      {!draft.multipartEnabled && draft.type !== "mcq" ? (
        <div className="space-y-1.5">
          <Label className="text-xs">Accepted answer(s)</Label>
          <QuizStyleField
            value={draft.acceptedAnswers}
            onChange={(acceptedAnswers) => update({ acceptedAnswers })}
            onBlur={(value) => {
              const normalized = normalizeAcceptedAnswersText(value);
              if (normalized !== value) update({ acceptedAnswers: normalized });
            }}
            placeholder="One per line (units optional for numbers)"
            multiline
            rows={2}
            variant="part"
          />
        </div>
      ) : null}

      {draft.type === "mcq" ? (
        <RegionCard title="Correct answer" subtitle="Set the correct option letter">
          <Select
            value={draft.correctAnswer || undefined}
            onValueChange={(correctAnswer) => update({ correctAnswer })}
          >
            <SelectTrigger className="h-9 w-28">
              <SelectValue placeholder="Letter" />
            </SelectTrigger>
            <SelectContent>
              {(["A", "B", "C", "D"] as const).map((letter) => (
                <SelectItem key={letter} value={letter}>
                  {letter}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </RegionCard>
      ) : null}

      <PasteQuestionAnswers draft={draft} onChange={onChange} />
    </div>
  );
}

function RegionCard({
  title,
  subtitle,
  children,
  onRemove,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  onRemove?: () => void;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-black/10 bg-[#fafbfc] p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-[#0b0f19]">{title}</p>
          {subtitle ? <p className="text-[11px] text-muted-foreground">{subtitle}</p> : null}
        </div>
        {onRemove ? (
          <button
            type="button"
            onClick={onRemove}
            className="rounded p-1 text-muted-foreground hover:bg-black/5 hover:text-danger"
            aria-label={`Remove ${title}`}
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
      {children}
    </div>
  );
}
