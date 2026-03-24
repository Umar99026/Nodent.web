import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { apiFetchAdmin, ApiError } from "@/lib/api";
import { STORAGE_KEYS, API_PATHS } from "@/lib/constants";
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
  options?: string[];
  correctAnswer?: string;
  acceptedAnswers?: string[];
  guidance?: string;
  passage?: string;
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

  // Auth check
  const adminKey = localStorage.getItem(STORAGE_KEYS.adminKey);
  useEffect(() => {
    if (!adminKey) {
      navigate("/dashboard", { replace: true });
    }
  }, [adminKey, navigate]);

  /* ------ form state ------ */
  const [subjectId, setSubjectId] = useState("");
  const [questionType, setQuestionType] = useState<QuestionType>("mcq");
  const [questionText, setQuestionText] = useState("");
  const [passage, setPassage] = useState("");

  // MCQ
  const [options, setOptions] = useState(["", "", "", ""]);
  const [correctAnswer, setCorrectAnswer] = useState("");

  // Short answer
  const [acceptedAnswers, setAcceptedAnswers] = useState("");

  // Long answer
  const [guidance, setGuidance] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  /* ------ existing questions state ------ */
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(true);
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(
    new Set(),
  );

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
    if (adminKey) fetchQuestions();
  }, [adminKey, fetchQuestions]);

  /* ------ submit question ------ */

  const resetForm = () => {
    setQuestionText("");
    setPassage("");
    setOptions(["", "", "", ""]);
    setCorrectAnswer("");
    setAcceptedAnswers("");
    setGuidance("");
    setFormError("");
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

    setIsSubmitting(true);

    const body: Record<string, unknown> = {
      subjectId,
      type: questionType,
      question: questionText.trim(),
    };

    if (passage.trim()) body.passage = passage.trim();

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
    }

    try {
      await apiFetchAdmin(API_PATHS.admin.questions, {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success("Question added successfully");
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

  const toggleSubjectExpand = (subject: string) => {
    setExpandedSubjects((prev) => {
      const next = new Set(prev);
      if (next.has(subject)) next.delete(subject);
      else next.add(subject);
      return next;
    });
  };

  /* ------ render ------ */

  if (!adminKey) return null;

  return (
    <AppShell title="Admin Panel" subtitle="Manage custom questions">
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Add Question Form */}
        <Card className="paper-texture">
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2 text-lg">
              <Plus className="size-5 text-brand" />
              Add Question
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
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
              </>
            )}

            <div className="flex justify-end pt-2">
              <Button
                onClick={handleSubmit}
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
                {Object.entries(groupedQuestions).map(
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
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
