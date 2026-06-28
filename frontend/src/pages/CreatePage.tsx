import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppShell } from "@/components/layout/AppShell";
import { QuestionDraftEditor } from "@/components/create/QuestionDraftEditor";
import { CreatePhoneUploadPanel } from "@/components/create/CreatePhoneUploadPanel";
import { PhoneUploadGallery } from "@/components/create/PhoneUploadGallery";
import { QuizStyleField } from "@/components/create/QuizStyleField";
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
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, PenLine, Plus, Upload, RotateCcw, ArrowLeft } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { isAdminUser } from "@/lib/constants";
import { subjectsForUser } from "@/lib/subjects";
import { GOOGLE_SHEETS_TOPIC_LABELS, topicTaxonomySubjectId } from "@/lib/mathSubjectTopics";
import { canonicalSubjectId } from "@/lib/practiceQuestions";
import {
  assessmentTotalMarks,
  clearAssessmentDraft,
  createEmptyQuestionDraft,
  createManualDraftTemplate,
  loadCreatePagePrefs,
  publishAssessmentDraft,
  saveCreatePagePrefs,
  validateAssessmentDraft,
  type AssessmentDraft,
  type QuestionDraft,
} from "@/lib/createAssessmentDraft";
import { cn } from "@/lib/utils";

function topicSuggestionsForSubject(subjectId: string): string[] {
  const key = topicTaxonomySubjectId(canonicalSubjectId(subjectId));
  return [...(GOOGLE_SHEETS_TOPIC_LABELS[key] ?? []), "General"];
}

export default function CreatePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);

  const initialPrefs = useMemo(() => loadCreatePagePrefs(), []);

  const [draft, setDraft] = useState<AssessmentDraft>(() =>
    createManualDraftTemplate(initialPrefs.subjectId),
  );
  const [publishing, setPublishing] = useState(false);
  const [phoneImages, setPhoneImages] = useState<string[]>([]);

  const visibleSubjects = useMemo(() => subjectsForUser({ isAdmin: true }), []);
  const topicSuggestions = useMemo(
    () => topicSuggestionsForSubject(draft.subjectId),
    [draft.subjectId],
  );

  useEffect(() => {
    if (!isAdmin) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAdmin, navigate]);

  const persistDraft = useCallback((next: AssessmentDraft) => {
    setDraft(next);
  }, []);

  const updateDraft = (patch: Partial<AssessmentDraft>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    if (patch.subjectId !== undefined) {
      saveCreatePagePrefs({ subjectId: next.subjectId });
    }
  };

  const updateQuestion = (id: string, question: QuestionDraft) => {
    persistDraft({
      ...draft,
      questions: draft.questions.map((q) => (q.id === id ? question : q)),
    });
  };

  const addQuestion = () => {
    const q = createEmptyQuestionDraft();
    persistDraft({ ...draft, questions: [...draft.questions, q] });
  };

  const removeQuestion = (id: string) => {
    persistDraft({
      ...draft,
      questions: draft.questions.filter((q) => q.id !== id),
    });
  };

  const duplicateQuestion = (id: string) => {
    const source = draft.questions.find((q) => q.id === id);
    if (!source) return;
    const copy: QuestionDraft = {
      ...source,
      id: crypto.randomUUID(),
      question: source.question ? `${source.question} (copy)` : "",
      answerParts: source.answerParts.map((p) => ({ ...p })),
      options: [...source.options],
      imageUrls: [...source.imageUrls],
      labelDiagramEnabled: source.labelDiagramEnabled,
    };
    persistDraft({ ...draft, questions: [...draft.questions, copy] });
  };

  const handlePublish = async () => {
    const validationErrors = validateAssessmentDraft(draft);
    if (validationErrors.length) {
      const first = validationErrors[0]!;
      const label =
        first.questionIndex >= 0
          ? `Question ${first.questionIndex + 1}: ${first.message}`
          : first.message;
      toast.error(label);
      return;
    }

    setPublishing(true);
    try {
      const result = await publishAssessmentDraft(draft);
      if (result.errors.length) {
        toast.error(result.errors[0]?.message ?? "Some questions failed to publish.");
        return;
      }
      const msg =
        result.skipped > 0
          ? `Published ${result.imported} question(s). ${result.skipped} duplicate(s) skipped.`
          : `Published ${result.imported} question(s) to the question bank.`;
      toast.success(msg);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to publish assessment.");
    } finally {
      setPublishing(false);
    }
  };

  const handlePhoneImagesReceived = useCallback((urls: string[]) => {
    if (!urls.length) return;
    setPhoneImages((prev) => [...prev, ...urls]);
  }, []);

  const addPhoneImageToQuestion = (imageUrl: string, questionIndex: number) => {
    const target = draft.questions[questionIndex];
    if (!target) return;
    if (target.imageUrls.length >= 6) {
      toast.error(`Question ${questionIndex + 1} already has 6 images.`);
      return;
    }
    updateQuestion(target.id, {
      ...target,
      imageUrls: target.labelDiagramEnabled
        ? [imageUrl]
        : [...target.imageUrls, imageUrl],
    });
    setPhoneImages((prev) => prev.filter((u) => u !== imageUrl));
    toast.success(`Added to question ${questionIndex + 1}.`);
  };

  const handleReset = () => {
    setDraft(clearAssessmentDraft(draft.subjectId));
    setPhoneImages([]);
    toast.message("Draft cleared.");
  };

  const totalMarks = assessmentTotalMarks(draft);
  const hasIntro = draft.sharedPassage.trim().length > 0;

  if (!isAdmin) return null;

  return (
    <AppShell
      title="Create"
      subtitle="Build questions from scratch and publish to the question bank."
    >
      <div className="mx-auto max-w-[100rem] space-y-6">
        <Button
          type="button"
          variant="ghost"
          className="gap-2 px-0 text-muted-foreground hover:text-foreground"
          onClick={() => navigate("/teacher")}
        >
          <ArrowLeft className="size-4" />
          Back to Teacher
        </Button>
        <section className="mx-auto max-w-4xl rounded-3xl border border-black/8 bg-white p-4 shadow-sm sm:p-5">
          <div className="mb-4">
            <h2 className="font-display text-xl font-bold text-[#0b0f19]">Assessment setup</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Title, subject, and topic for this assessment. To import from a PDF, use{" "}
              <span className="font-medium text-foreground">Admin → Import questions</span>.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Assessment title</Label>
              <Input
                className="h-10"
                placeholder="e.g. Methods Unit 3 — Practice Test 1"
                value={draft.title}
                onChange={(e) => updateDraft({ title: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select
                value={draft.subjectId}
                onValueChange={(val) => val && updateDraft({ subjectId: val })}
              >
                <SelectTrigger className="h-10 w-full">
                  <SelectValue placeholder="Select subject" />
                </SelectTrigger>
                <SelectContent>
                  {visibleSubjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Topic</Label>
              <Input
                className="h-10"
                placeholder="e.g. Differential calculus"
                value={draft.topic}
                onChange={(e) => updateDraft({ topic: e.target.value })}
                list="create-topic-suggestions"
              />
              <datalist id="create-topic-suggestions">
                {topicSuggestions.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-4xl space-y-4">
          <CreatePhoneUploadPanel onImagesReceived={handlePhoneImagesReceived} />
          <PhoneUploadGallery
            images={phoneImages}
            questionCount={draft.questions.length}
            onAddToQuestion={addPhoneImageToQuestion}
            onRemove={(index) =>
              setPhoneImages((prev) => prev.filter((_, i) => i !== index))
            }
          />
        </section>

        <section className="mx-auto max-w-4xl space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3 px-1">
            <div>
              <h2 className="font-display text-xl font-bold text-[#0b0f19] sm:text-2xl">
                Questions
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {draft.questions.length} question{draft.questions.length === 1 ? "" : "s"} ·{" "}
                {totalMarks} mark{totalMarks === 1 ? "" : "s"}
              </p>
            </div>
            {draft.questions.length > 0 ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1.5"
                onClick={addQuestion}
              >
                <Plus className="size-4" />
                Add question
              </Button>
            ) : null}
          </div>

          <Card
            className={cn(
              "border-l-4 border-l-brand/40",
              hasIntro ? "bg-muted/60" : "border-dashed bg-[#fafbfc]",
            )}
          >
            <CardContent className="space-y-2 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Intro text <span className="font-normal normal-case">(optional)</span>
              </p>
              <p className="text-[11px] text-muted-foreground">
                Shown once at the top before all questions — instructions, scenario, or shared
                reading.
              </p>
              <QuizStyleField
                value={draft.sharedPassage}
                onChange={(sharedPassage) => updateDraft({ sharedPassage })}
                placeholder="e.g. Answer all questions. Show working. A table of values is provided below…"
                multiline
                rows={hasIntro ? 4 : 2}
                variant="intro"
              />
            </CardContent>
          </Card>

          {draft.questions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-black/15 bg-[#fafbfc] px-6 py-12 text-center">
              <PenLine className="mx-auto size-8 text-muted-foreground/60" />
              <p className="mt-3 text-sm font-medium text-[#0b0f19]">Empty assessment</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Add questions one at a time to build your assessment.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-5 gap-1.5"
                onClick={addQuestion}
              >
                <Plus className="size-4" />
                Add your first question
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-5">
                {draft.questions.map((q, i) => (
                  <QuestionDraftEditor
                    key={q.id}
                    draft={q}
                    index={i}
                    onChange={(next) => updateQuestion(q.id, next)}
                    onRemove={() => removeQuestion(q.id)}
                    onDuplicate={() => duplicateQuestion(q.id)}
                    canRemove
                  />
                ))}
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full gap-2 border-dashed py-6"
                onClick={addQuestion}
              >
                <Plus className="size-4" />
                Add another question
              </Button>
            </>
          )}
        </section>

        <section className="sticky bottom-3 z-20 mx-auto flex max-w-4xl flex-wrap items-center justify-end gap-2 rounded-2xl border border-black/10 bg-white/95 p-4 shadow-lg backdrop-blur-sm">
          <Button type="button" variant="ghost" size="sm" className="gap-1.5" onClick={handleReset}>
            <RotateCcw className="size-4" />
            Clear draft
          </Button>
          <Button
            type="button"
            variant="accent"
            className="gap-1.5"
            disabled={publishing}
            onClick={() => void handlePublish()}
          >
            {publishing ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Publishing…
              </>
            ) : (
              <>
                <Upload className="size-4" />
                Publish to question bank
              </>
            )}
          </Button>
        </section>
      </div>
    </AppShell>
  );
}
