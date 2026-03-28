import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetchAdmin, ApiError } from "@/lib/api";
import { API_PATHS, ADMIN_EMAIL, STORAGE_KEYS } from "@/lib/constants";
import { compressImageFileToDataUrl } from "@/lib/imageCompressor";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import { baseSubjects } from "@/lib/subjects";
import { useAuth } from "@/context/AuthContext";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type QuestionType = "mcq" | "short_answer" | "long_answer";

interface AdminQuestion {
  id: string;
  subjectId: string;
  subjectName?: string;
  type: QuestionType;
  question: string;
  imageUrls?: string[];
  options?: string[];
  correctAnswer?: string;
  acceptedAnswers?: string[];
  guidance?: string;
  passage?: string;
  marks: number;
}

const QUESTION_TYPES: { value: QuestionType; label: string }[] = [
  { value: "mcq", label: "Multiple Choice" },
  { value: "short_answer", label: "Short Answer" },
  { value: "long_answer", label: "Long Answer" },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function AdminPage() {
  const navigate = useNavigate();

  const { user } = useAuth();
  const isAdminEmail = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();
  const [adminKey, setAdminKey] = useState(() => localStorage.getItem(STORAGE_KEYS.adminKey) ?? "");
  const hasAdminKey = !!adminKey.trim();
  const isAdmin = isAdminEmail || hasAdminKey;

  useEffect(() => {
    if (!isAdmin) {
      navigate("/dashboard", { replace: true });
    }
  }, [isAdmin, navigate]);

  /* ------ form state ------ */
  const [subjectId, setSubjectId] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>("mcq");
  const [questionText, setQuestionText] = useState("");
  const [passage, setPassage] = useState("");
  const [topic, setTopic] = useState("");
  const [imageUrlsText, setImageUrlsText] = useState("");
  const imageFilesRef = useRef<HTMLInputElement | null>(null);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [marks, setMarks] = useState<number>(1);

  // MCQ
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctAnswer, setCorrectAnswer] = useState("");

  // Short answer
  const [acceptedAnswers, setAcceptedAnswers] = useState("");

  // Long answer
  const [guidance, setGuidance] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // Default marks based on question type.
  useEffect(() => {
    setMarks(questionType === "mcq" ? 1 : 2);
  }, [questionType]);

  /* ------ existing questions state ------ */
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(
    new Set(),
  );
  const expandedSubjectsInitRef = useRef(false);
  const [subjectFilter, setSubjectFilter] = useState<string>("all");

  const [marksEdits, setMarksEdits] = useState<Record<string, number>>({});
  const [marksSaving, setMarksSaving] = useState<string | null>(null);

  const [sheetEnabled, setSheetEnabled] = useState<boolean | null>(null);
  const [sheetSyncing, setSheetSyncing] = useState(false);

  /* ------ fetch existing questions ------ */

  const fetchQuestions = useCallback(async () => {
    try {
      setQuestionsLoading(true);
      const data = await apiFetchAdmin<AdminQuestion[]>(
        API_PATHS.admin.questions,
      );
      setQuestions(data ?? []);
    } catch {
      setQuestions([]);
    } finally {
      setQuestionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) fetchQuestions();
  }, [isAdmin, fetchQuestions]);

  // “All subjects” uses collapsible groups that started fully collapsed, so new
  // questions looked like they never appeared. Expand every group once data
  // first loads; after that, only expand the subject you just edited.
  useEffect(() => {
    if (questionsLoading || questions.length === 0) return;
    if (expandedSubjectsInitRef.current) return;
    expandedSubjectsInitRef.current = true;
    setExpandedSubjects(
      new Set(
        questions.map(
          (q) => q.subjectName || q.subjectId || "Unknown",
        ),
      ),
    );
  }, [questionsLoading, questions]);

  useEffect(() => {
    if (!isAdmin) return;
    let cancelled = false;
    (async () => {
      try {
        const d = await apiFetchAdmin<{ enabled: boolean }>(
          API_PATHS.admin.googleSheetStatus,
        );
        if (!cancelled) setSheetEnabled(Boolean(d?.enabled));
      } catch {
        if (!cancelled) setSheetEnabled(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  /* ------ submit question ------ */

  const resetForm = () => {
    setQuestionText("");
    setPassage("");
    setTopic("");
    setImageUrlsText("");
    setOptions(["", "", "", ""]);
    setCorrectAnswer("");
    setAcceptedAnswers("");
    setGuidance("");
    setFormError("");
  };

  const appendImageDataUrls = async (files: FileList | File[]) => {
    const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (list.length === 0) return;

    setIsProcessingImages(true);
    try {
      const urls = await Promise.all(
        list.slice(0, 6).map(async (file) => {
          // Compress to keep payload size manageable.
          return await compressImageFileToDataUrl(file, {
            maxWidth: 1000,
            maxHeight: 1000,
            quality: 0.65,
            outputType: "image/jpeg",
          });
        }),
      );

      const existing = imageUrlsText
        .split("\n")
        .map((u) => u.trim())
        .filter(Boolean);

      const next = [...existing, ...urls].slice(0, 12);
      setImageUrlsText(next.join("\n"));
    } finally {
      setIsProcessingImages(false);
    }
  };

  const handleSubmit = async () => {
    setFormError("");

    if (!subjectId) {
      setFormError("Please select a subject");
      return;
    }
    if (!questionText.trim()) {
      setFormError("Question text is required");
      return;
    }

    if (questionType === "mcq") {
      if (options.some((o) => !o.trim())) {
        setFormError("All four options are required");
        return;
      }
      if (!correctAnswer) {
        setFormError("Please select the correct answer");
        return;
      }
    }

    if (questionType === "short_answer") {
      const answers = acceptedAnswers
        .split("\n")
        .map((a) => a.trim())
        .filter(Boolean);
      if (answers.length === 0) {
        setFormError("At least one accepted answer is required");
        return;
      }
    }

    if (questionType === "long_answer") {
      const answers = acceptedAnswers
        .split("\n")
        .map((a) => a.trim())
        .filter(Boolean);
      if (answers.length === 0) {
        setFormError("At least one accepted answer is required");
        return;
      }
    }

    setIsSubmitting(true);

    const body: Record<string, unknown> = {
      subjectId,
      type: questionType,
      question: questionText.trim(),
    };

    if (passage.trim()) body.passage = passage.trim();
    body.topic = topic.trim() || "General";
    const imageUrls = imageUrlsText
      .split("\n")
      .map((u) => u.trim())
      .filter(Boolean);
    if (imageUrls.length) body.imageUrls = imageUrls;

    if (questionType === "mcq") {
      body.options = options.map((o) => o.trim());
      body.correctAnswer = correctAnswer;
    } else if (questionType === "short_answer") {
      body.acceptedAnswers = acceptedAnswers
        .split("\n")
        .map((a) => a.trim())
        .filter(Boolean);
    } else if (questionType === "long_answer") {
      if (guidance.trim()) body.guidance = guidance.trim();
      body.acceptedAnswers = acceptedAnswers
        .split("\n")
        .map((a) => a.trim())
        .filter(Boolean);
    }

    // Admin-configurable marks (non-MCQ defaults to >1).
    body.marks = marks;

    try {
      await apiFetchAdmin(API_PATHS.admin.questions, {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success("Question added successfully");
      setExpandedSubjects((prev: Set<string>) => {
        const next = new Set(prev);
        next.add(subjectId);
        return next;
      });
      resetForm();
      fetchQuestions();
    } catch (err) {
      if (err instanceof ApiError) setFormError(err.message);
      else setFormError("Failed to add question");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ------ delete question ------ */

  const handleDelete = async (questionId: string) => {
    try {
      await apiFetchAdmin(`${API_PATHS.admin.questions}/${questionId}`, {
        method: "DELETE",
      });
      toast.success("Question deleted");
      setQuestions((prev) => prev.filter((q) => q.id !== questionId));
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Failed to delete question");
    }
  };

  const handleSyncFromSheet = useCallback(async () => {
    setSheetSyncing(true);
    try {
      const r = await apiFetchAdmin<{
        imported: number;
        updated: number;
        deleted: number;
        errors?: { row: number; message: string }[];
      }>(API_PATHS.admin.syncQuestionsFromSheet, {
        method: "POST",
        body: "{}",
      });
      toast.success(
        `Sheet sync: ${r.imported} new, ${r.updated} updated, ${r.deleted} removed.`,
      );
      if (r.errors?.length) {
        toast.message(
          `${r.errors.length} row(s) failed — see server logs for details.`,
          { duration: 7000 },
        );
      }
      await fetchQuestions();
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Could not sync from Google Sheet.");
    } finally {
      setSheetSyncing(false);
    }
  }, [fetchQuestions]);

  const handleUpdateMarks = async (questionId: string, nextMarks: number) => {
    const clamped = Math.max(1, Math.min(20, Math.round(nextMarks)));
    try {
      setMarksSaving(questionId);
      await apiFetchAdmin(`${API_PATHS.admin.questions}/${questionId}`, {
        method: "PUT",
        body: JSON.stringify({ marks: clamped }),
      });

      toast.success("Marks updated");
      setQuestions((prev) =>
        prev.map((q) => (q.id === questionId ? { ...q, marks: clamped } : q)),
      );
    } catch (err) {
      if (err instanceof ApiError) toast.error(err.message);
      else toast.error("Failed to update marks");
    } finally {
      setMarksSaving(null);
    }
  };

  /* ------ grouped questions ------ */

  const groupedQuestions = questions.reduce<Record<string, AdminQuestion[]>>(
    (acc, q) => {
      const key = q.subjectName || q.subjectId || "Unknown";
      if (!acc[key]) acc[key] = [];
      acc[key].push(q);
      return acc;
    },
    {},
  );

  const filteredQuestions = subjectFilter === "all"
    ? questions
    : questions.filter((q) => String(q.subjectId) === subjectFilter);

  const toggleSubjectExpand = (subject: string) => {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subject)) next.delete(subject);
      else next.add(subject);
      return next;
    });
  };

  /* ------ render ------ */

  if (!isAdmin) return null;

  return (
    <AppShell title="Admin Panel" subtitle="Manage custom questions">
      <div className="mx-auto max-w-4xl space-y-8">
        <Card className="paper-texture border-white/20">
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Google Sheet mirror
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm text-muted-foreground">
            <p>
              When the server is configured with a Google service account and
              spreadsheet ID, each new question is appended to the sheet.
              Practice mode always uses the database — run{" "}
              <span className="font-medium text-foreground">
                Import from Google Sheet
              </span>{" "}
              after editing the sheet so changes go live.
            </p>
            {sheetEnabled === null ? (
              <p className="text-xs">Checking whether Sheets sync is enabled…</p>
            ) : sheetEnabled ? (
              <Button
                type="button"
                variant="secondary"
                disabled={sheetSyncing}
                onClick={() => void handleSyncFromSheet()}
                className="gap-2"
              >
                {sheetSyncing ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Syncing from sheet…
                  </>
                ) : (
                  "Import from Google Sheet"
                )}
              </Button>
            ) : (
              <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
                Sheets mirroring is off. On the host, set{" "}
                <code className="rounded bg-black/10 px-1">GOOGLE_SHEETS_SPREADSHEET_ID</code>{" "}
                and either{" "}
                <code className="rounded bg-black/10 px-1">GOOGLE_SERVICE_ACCOUNT_FILE</code>{" "}
                (path to JSON key) or{" "}
                <code className="rounded bg-black/10 px-1">GOOGLE_SERVICE_ACCOUNT_JSON</code>
                . Share the spreadsheet with the service account email (Editor).
                Tab name defaults to{" "}
                <code className="rounded bg-black/10 px-1">NodentQuestions</code>{" "}
                or override with{" "}
                <code className="rounded bg-black/10 px-1">GOOGLE_SHEETS_TAB_NAME</code>.
              </p>
            )}
          </CardContent>
        </Card>

        {/* Add Question Form */}
        <Card className="paper-texture">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2 text-lg">
              <Plus className="size-5 text-brand" />
              Add Question
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {!isAdminEmail && (
              <div className="rounded-xl border border-white/15 bg-white/10 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="flex-1 space-y-1.5">
                    <Label>Admin Key</Label>
                    <Input
                      value={adminKey}
                      onChange={(e) => {
                        const next = e.target.value;
                        setAdminKey(next);
                        localStorage.setItem(STORAGE_KEYS.adminKey, next);
                      }}
                      placeholder="Paste your Cloudflare ADMIN_KEY..."
                      className="h-10"
                    />
                    <p className="text-xs text-muted-foreground">
                      This is required on Cloudflare deployments (sent as `x-admin-key`).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {formError && (
              <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm text-danger">
                {formError}
              </div>
            )}

            {/* Subject */}
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Select value={subjectId} onValueChange={(val: string | null) => val && setSubjectId(val)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  {baseSubjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                  {baseSubjects.length === 0 && (
                    <SelectItem value="__none" disabled>
                      No subjects available
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Question Type */}
            <div className="space-y-1.5">
              <Label>Question Type</Label>
              <Select
                value={questionType}
                onValueChange={(v) => setQuestionType(v as QuestionType)}
              >
                <SelectTrigger className="w-full">
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
            </div>

            {questionType !== "mcq" && (
              <div className="space-y-1.5">
                <Label>Marks</Label>
                <Input
                  type="number"
                  min={2}
                  max={20}
                  value={marks}
                  onChange={(e) => setMarks(Number(e.target.value))}
                  className="h-9"
                />
              </div>
            )}

            {/* Question Text */}
            <div className="space-y-1.5">
              <Label>Question Text</Label>
              <Textarea
                placeholder="Enter the question..."
                value={questionText}
                onChange={(e) => setQuestionText(e.target.value)}
                rows={3}
              />
            </div>

            {/* Images (optional) */}
            <div className="space-y-1.5">
              <Label>
                Question Images{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <p className="text-xs text-muted-foreground">
                Paste one image URL per line or drag/drop image files. Students will see it under the question.
              </p>

              {/* Drag + Drop uploader */}
              <div
                role="button"
                tabIndex={0}
                onClick={() => imageFilesRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") imageFilesRef.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    void appendImageDataUrls(e.dataTransfer.files);
                  }
                }}
                className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-black/15 bg-white/50 px-4 py-4 text-center transition-colors hover:bg-white/70"
              >
                <span className="text-sm font-semibold text-[#0b0f19]/80">
                  {isProcessingImages ? "Processing images..." : "Drag & drop images here"}
                </span>
                <span className="text-xs text-muted-foreground">
                  or click to browse (up to 6 at a time)
                </span>
              </div>

              <input
                ref={imageFilesRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    void appendImageDataUrls(e.target.files);
                    e.currentTarget.value = "";
                  }
                }}
              />

              <Textarea
                placeholder={"https://example.com/image1.png\nhttps://example.com/image2.jpg"}
                value={imageUrlsText}
                onChange={(e) => setImageUrlsText(e.target.value)}
                rows={3}
              />
              {imageUrlsText.trim() && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {imageUrlsText
                    .split("\n")
                    .map((u) => u.trim())
                    .filter(Boolean)
                    .slice(0, 4)
                    .map((u) => (
                      <div
                        key={u}
                        className="overflow-hidden rounded-xl border border-black/10 bg-white"
                      >
                        <img
                          src={u}
                          alt="Question media"
                          className="h-40 w-full object-cover"
                          loading="lazy"
                        />
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Passage (optional) */}
            <div className="space-y-1.5">
              <Label>
                Passage{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                placeholder="Optional reading passage for the question..."
                value={passage}
                onChange={(e) => setPassage(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Topic</Label>
              <Input
                placeholder="e.g. Calculus, Argument Analysis..."
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="h-9"
              />
            </div>

            {/* Conditional fields */}
            {questionType === "mcq" && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label>Options</Label>
                  {options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-medium">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <Input
                        placeholder={`Option ${String.fromCharCode(65 + i)}`}
                        value={opt}
                        onChange={(e) => {
                          const next = [...options];
                          next[i] = e.target.value;
                          setOptions(next);
                        }}
                        className="h-9"
                      />
                    </div>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <Label>Correct Answer</Label>
                  <Select
                    value={correctAnswer}
                    onValueChange={(val: string | null) => val && setCorrectAnswer(val)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select correct option" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((opt, i) => (
                        <SelectItem
                          key={i}
                          value={String.fromCharCode(65 + i)}
                          disabled={!opt.trim()}
                        >
                          {String.fromCharCode(65 + i)}
                          {opt.trim() ? `: ${opt.trim()}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            {questionType === "short_answer" && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <Label>Accepted Answers</Label>
                  <p className="text-xs text-muted-foreground">
                    Enter one accepted answer per line
                  </p>
                  <Textarea
                    placeholder={"Answer 1\nAnswer 2\nAnswer 3"}
                    value={acceptedAnswers}
                    onChange={(e) => setAcceptedAnswers(e.target.value)}
                    rows={4}
                  />
                </div>
              </>
            )}

            {questionType === "long_answer" && (
              <>
                <Separator />
                <div className="space-y-1.5">
                  <Label>
                    Marking Guidance{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </Label>
                  <Textarea
                    placeholder="Guidance for evaluating the response..."
                    value={guidance}
                    onChange={(e) => setGuidance(e.target.value)}
                    rows={3}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Accepted Answers</Label>
                  <p className="text-xs text-muted-foreground">
                    Enter one accepted answer/keyword per line
                  </p>
                  <Textarea
                    placeholder={"Answer 1\nAnswer 2\nAnswer 3"}
                    value={acceptedAnswers}
                    onChange={(e) => setAcceptedAnswers(e.target.value)}
                    rows={4}
                  />
                </div>
              </>
            )}

            <div className="flex justify-end pt-2">
              <Button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={isSubmitting}
                className="gap-1.5 bg-brand text-white hover:bg-brand-dark"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Plus className="size-4" />
                    Add Question
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Existing Questions */}
        <Card className="paper-texture">
          <CardHeader>
            <CardTitle className="font-display text-lg">
              Existing Questions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 space-y-1.5">
              <Label>Filter by Subject</Label>
              <Select value={subjectFilter} onValueChange={(val: string | null) => val && setSubjectFilter(val)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All subjects</SelectItem>
                  {baseSubjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {questionsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="size-6 animate-spin text-brand" />
              </div>
            ) : questions.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No custom questions yet. Add your first question above.
              </p>
            ) : (
              <div className="space-y-2">
                {subjectFilter === "all" ? (
                  Object.entries(groupedQuestions).map(
                    ([subjectName, subjectQuestions]) => {
                      const isExpanded = expandedSubjects.has(subjectName);

                      return (
                        <div
                          key={subjectName}
                          className="rounded-lg border border-border/50"
                        >
                          <button
                            onClick={() => toggleSubjectExpand(subjectName)}
                            className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/50"
                          >
                            <div className="flex items-center gap-2">
                              {isExpanded ? (
                                <ChevronDown className="size-4 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="size-4 text-muted-foreground" />
                              )}
                              <span className="font-display font-medium">
                                {subjectName}
                              </span>
                              <Badge variant="secondary" className="text-[11px]">
                                {subjectQuestions.length}
                              </Badge>
                            </div>
                          </button>

                          {isExpanded && (
                            <div className="border-t border-border/50">
                              {subjectQuestions.map((q) => (
                                <div
                                  key={q.id}
                                  className="flex items-start justify-between gap-3 border-b border-border/30 px-4 py-3 last:border-b-0"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="mb-1 flex items-center gap-2">
                                      <Badge
                                        variant="outline"
                                        className="text-[10px] uppercase"
                                      >
                                        {q.type.replace("_", " ")}
                                      </Badge>
                                    </div>
                                    <p className="text-sm text-foreground">
                                      {q.question}
                                    </p>
                                  </div>

                                  {q.type !== "mcq" && (
                                    <div className="flex items-center gap-2">
                                      <Input
                                        type="number"
                                        min={1}
                                        max={20}
                                        className="h-9 w-24"
                                        value={marksEdits[q.id] ?? q.marks}
                                        onChange={(e) =>
                                          setMarksEdits((prev) => ({
                                            ...prev,
                                            [q.id]: Number(e.target.value),
                                          }))
                                        }
                                      />
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        className="h-9"
                                        disabled={marksSaving === q.id}
                                        onClick={() =>
                                          handleUpdateMarks(
                                            q.id,
                                            marksEdits[q.id] ?? q.marks,
                                          )
                                        }
                                      >
                                        {marksSaving === q.id ? (
                                          <Loader2 className="size-4 animate-spin" />
                                        ) : (
                                          "Save"
                                        )}
                                      </Button>
                                    </div>
                                  )}

                                  <AlertDialog>
                                    <AlertDialogTrigger
                                      render={
                                        <Button
                                          variant="ghost"
                                          size="icon-sm"
                                          className="shrink-0 text-muted-foreground hover:text-danger"
                                        />
                                      }
                                    >
                                      <Trash2 className="size-4" />
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>
                                          Delete Question
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Are you sure you want to delete this
                                          question? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>
                                          Cancel
                                        </AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDelete(q.id)}
                                          className="bg-danger text-white hover:bg-danger/90"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    },
                  )
                ) : (
                  <div className="rounded-lg border border-border/50">
                    {filteredQuestions.length === 0 ? (
                      <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                        No questions for this subject yet.
                      </div>
                    ) : (
                      filteredQuestions.map((q) => (
                        <div
                          key={q.id}
                          className="flex items-start justify-between gap-3 border-b border-border/30 px-4 py-3 last:border-b-0"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <Badge
                                variant="outline"
                                className="text-[10px] uppercase"
                              >
                                {q.type.replace("_", " ")}
                              </Badge>
                            </div>
                            <p className="text-sm text-foreground">
                              {q.question}
                            </p>
                          </div>

                          {q.type !== "mcq" && (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={1}
                                max={20}
                                className="h-9 w-24"
                                value={marksEdits[q.id] ?? q.marks}
                                onChange={(e) =>
                                  setMarksEdits((prev) => ({
                                    ...prev,
                                    [q.id]: Number(e.target.value),
                                  }))
                                }
                              />
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-9"
                                disabled={marksSaving === q.id}
                                onClick={() =>
                                  handleUpdateMarks(
                                    q.id,
                                    marksEdits[q.id] ?? q.marks,
                                  )
                                }
                              >
                                {marksSaving === q.id ? (
                                  <Loader2 className="size-4 animate-spin" />
                                ) : (
                                  "Save"
                                )}
                              </Button>
                            </div>
                          )}

                          <AlertDialog>
                            <AlertDialogTrigger
                              render={
                                <Button
                                  variant="ghost"
                                  size="icon-sm"
                                  className="shrink-0 text-muted-foreground hover:text-danger"
                                />
                              }
                            >
                              <Trash2 className="size-4" />
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>
                                  Delete Question
                                </AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this question?
                                  This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>
                                  Cancel
                                </AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDelete(q.id)}
                                  className="bg-danger text-white hover:bg-danger/90"
                                >
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
