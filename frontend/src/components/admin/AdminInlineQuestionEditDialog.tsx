import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api";
import { canonicalSubjectId } from "@/lib/practiceQuestions";
import { GOOGLE_SHEETS_TOPIC_LABELS, topicTaxonomySubjectId } from "@/lib/mathSubjectTopics";
import {
  patchCachedQuestionAfterAdminSave,
  refreshQuestionBankAfterSave,
  saveAdminQuestion,
  type AdminQuestionSaveDraft,
} from "@/lib/adminQuestionSave";
import type { Question, McqQuestion, ShortQuestion, LongQuestion } from "@/lib/subjects";
import {
  emptyMultipartParts,
  mergePartsWithAcceptedAnswers,
  MultipartAnswerPartsEditor,
} from "@/components/admin/MultipartAnswerPartsEditor";
import { AdminQuestionImageEditor } from "@/components/admin/AdminQuestionImageEditor";import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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

type AdminQuestionType = "mcq" | "short_answer" | "long_answer";

function topicOptionsForSubject(subjectId: string): string[] {
  const key = topicTaxonomySubjectId(canonicalSubjectId(subjectId));
  return [...(GOOGLE_SHEETS_TOPIC_LABELS[key] ?? [])];
}

function practiceTypeToAdmin(type: Question["type"]): AdminQuestionType {
  if (type === "mcq") return "mcq";
  if (type === "long") return "long_answer";
  return "short_answer";
}

function questionToDraft(question: Question, subjectId: string): AdminQuestionSaveDraft {
  const base = {
    subjectId: canonicalSubjectId(subjectId),
    type: practiceTypeToAdmin(question.type),
    topic: question.topic ?? "General",
    question: question.question,
    passage: question.passage ?? "",
    marks: question.marks ?? 1,
    guidance: question.guidance,
    imageUrls: question.imageUrls ?? [],
  };

  if (question.type === "mcq") {
    const mcq = question as McqQuestion;
    return {
      ...base,
      options: [...mcq.options],
      correctAnswer: mcq.answer,
    };
  }

  const written = question as ShortQuestion | LongQuestion;
  const accepted = written.acceptedAnswers ?? [];
  const parts = question.answerParts?.filter((p) => p.label?.trim()) ?? [];

  if (parts.length > 0) {
    return {
      ...base,
      answerParts: mergePartsWithAcceptedAnswers(
        parts.map((p) => ({
          key: p.key,
          label: p.label,
          placeholder: p.placeholder,
          marks: p.marks,
          imageUrl: p.imageUrl,
        })),
        accepted,
      ),
      acceptedAnswers: accepted,
    };
  }

  return {
    ...base,
    acceptedAnswers: accepted,
  };
}

function draftHasVisibleContent(draft: AdminQuestionSaveDraft): boolean {
  if (draft.question.trim()) return true;
  if (draft.passage?.trim()) return true;
  if ((draft.imageUrls?.length ?? 0) > 0) return true;
  return (draft.answerParts?.some((p) => p.label.trim()) ?? false);
}

type AdminInlineQuestionEditDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  question: Question;
  subjectId: string;
  onSaved?: () => void;
};

export function AdminInlineQuestionEditDialog({
  open,
  onOpenChange,
  question,
  subjectId,
  onSaved,
}: AdminInlineQuestionEditDialogProps) {
  const [draft, setDraft] = useState<AdminQuestionSaveDraft>(() =>
    questionToDraft(question, subjectId),
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setDraft(questionToDraft(question, subjectId));
      setSaveError(null);
    }
  }, [open, question, subjectId]);

  const topicOptions = useMemo(
    () => topicOptionsForSubject(draft.subjectId),
    [draft.subjectId],
  );

  const labelledParts = draft.answerParts?.filter((p) => p.label.trim()) ?? [];
  const isMultipart = labelledParts.length >= 2;

  const handleSave = async () => {
    const questionId = question.id;
    if (questionId == null) {
      const msg = "This question has no id — can't save.";
      setSaveError(msg);
      toast.error(msg);
      return;
    }
    if (!draftHasVisibleContent(draft)) {
      const msg = "Add question text, a passage, images, or answer parts.";
      setSaveError(msg);
      toast.error(msg);
      return;
    }
    setSaveError(null);
    setSaving(true);
    try {
      const saved = await saveAdminQuestion(questionId, draft);
      patchCachedQuestionAfterAdminSave(questionId, saved, subjectId);
      await refreshQuestionBankAfterSave();
      toast.success("Question updated.");
      onOpenChange(false);
      onSaved?.();
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : "Could not save question.";
      setSaveError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
    >
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="shrink-0 border-b border-border/60 px-5 py-4">
          <DialogTitle>Edit question</DialogTitle>
          <DialogDescription>
            Demo multipart questions show sub-parts (a, b, c…) on screen — edit those
            labels in <strong>Answer parts</strong> below. Passage text appears at the top
            of the question.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Topic</Label>
              {topicOptions.length > 0 ? (
                <Select
                  value={draft.topic}
                  onValueChange={(val: string | null) => {
                    if (val) setDraft((d) => ({ ...d, topic: val }));
                  }}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValue placeholder="Select topic" />
                  </SelectTrigger>
                  <SelectContent>
                    {topicOptions.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                    {!topicOptions.includes(draft.topic) && draft.topic ? (
                      <SelectItem value={draft.topic}>{draft.topic}</SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              ) : (
                <Input
                  className="h-9"
                  value={draft.topic}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, topic: e.target.value }))
                  }
                />
              )}
            </div>
            {!isMultipart ? (
              <div className="space-y-1.5">
                <Label className="text-xs">Marks</Label>
                <Input
                  type="number"
                  min={1}
                  max={20}
                  className="h-9"
                  value={draft.marks}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, marks: Number(e.target.value) || 1 }))
                  }
                />
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Question text</Label>
            <Textarea
              rows={4}
              value={draft.question}
              onChange={(e) =>
                setDraft((d) => ({ ...d, question: e.target.value }))
              }
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Passage text</Label>
            <Textarea
              rows={3}
              value={draft.passage ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, passage: e.target.value }))
              }
            />
          </div>

          <AdminQuestionImageEditor
            imageUrls={draft.imageUrls ?? []}
            onChange={(imageUrls) => setDraft((d) => ({ ...d, imageUrls }))}
          />

          {draft.type === "mcq" ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Options (one per line)</Label>
                <Textarea
                  rows={4}
                  value={(draft.options ?? []).join("\n")}
                  onChange={(e) =>
                    setDraft((d) => ({
                      ...d,
                      options: e.target.value.split("\n").map((x) => x.trim()),
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Correct answer</Label>
                <Input
                  className="h-9"
                  value={draft.correctAnswer ?? ""}
                  onChange={(e) =>
                    setDraft((d) => ({ ...d, correctAnswer: e.target.value }))
                  }
                />
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-sm">Answer parts</Label>
                {!isMultipart ? (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-8"
                    onClick={() =>
                      setDraft((d) => ({
                        ...d,
                        answerParts:
                          (d.answerParts?.length ?? 0) >= 2
                            ? d.answerParts!
                            : emptyMultipartParts(2),
                      }))
                    }
                  >
                    Add parts
                  </Button>
                ) : null}
              </div>
              {isMultipart ? (
                <MultipartAnswerPartsEditor
                  parts={draft.answerParts ?? []}
                  onChange={(parts) => setDraft((d) => ({ ...d, answerParts: parts }))}
                />
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs">Accepted answers (one per line)</Label>
                  <Textarea
                    rows={4}
                    value={(draft.acceptedAnswers ?? []).join("\n")}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        acceptedAnswers: e.target.value
                          .split("\n")
                          .map((x) => x.trim())
                          .filter(Boolean),
                      }))
                    }
                  />
                </div>
              )}
            </div>
          )}

          {draft.type === "long_answer" ? (
            <div className="space-y-1.5">
              <Label className="text-xs">Marking guidance</Label>
              <Textarea
                rows={2}
                value={draft.guidance ?? ""}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, guidance: e.target.value }))
                }
              />
            </div>
          ) : null}
        </div>

        <div className="relative z-10 shrink-0 border-t border-border/60 bg-background px-5 py-4">
          {saveError ? (
            <p className="mb-3 text-xs text-danger">{saveError}</p>
          ) : null}
          <form
            className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"
            onSubmit={(e) => {
              e.preventDefault();
              void handleSave();
            }}
          >
            <Button
              type="button"
              variant="ghost"
              disabled={saving}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="accent"
              disabled={saving}
              className="gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Saving…
                </>
              ) : (
                "Save question"
              )}
            </Button>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
