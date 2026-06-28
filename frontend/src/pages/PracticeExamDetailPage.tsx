import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DiagramLabelInputs } from "@/components/quiz/DiagramLabelInputs";
import { ExamMcqPageOverlay } from "@/components/quiz/ExamMcqPageOverlay";
import { isAdminUser } from "@/lib/constants";
import {
  defaultMcqCount,
  defaultPracticeExamLayout,
  writtenSectionPages,
} from "@/lib/practiceExamLayout";
import {
  isMcqSlotKey,
  shortLabelFromSlotKey,
} from "@/lib/practiceExamImport";
import {
  isMcqAnswerCorrect,
  mcqItemsOnPage,
  mcqPlacementCount,
  normalizeMcqItems,
} from "@/lib/practiceExamMcq";
import type { McqOptionLetter } from "@/lib/practiceExamTypes";
import {
  fetchPracticeExamMeta,
  fetchPracticeExamPage,
  parsePracticeExamNumber,
} from "@/lib/practiceExamApi";
import {
  isPracticeExamNumber,
  isPracticeExamYear,
  practiceExamFullLabel,
} from "@/lib/practiceExams";
import { resolveQuestionImageSrc } from "@/lib/practiceQuestions";
import { baseSubjects, subjectsForUser } from "@/lib/subjects";
import type {
  PracticeExamLayout,
  PracticeExamMcqItem,
  PracticeExamPage,
  PracticeExamSlot,
} from "@/lib/practiceExamTypes";
import type { DiagramLabelPart } from "@/lib/diagramLabels";
import { isAnswerCorrect } from "@/lib/utils";
import { CheckCircle2, FileText, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

function slotToPart(slot: PracticeExamSlot): DiagramLabelPart {
  return {
    key: slot.key,
    label: "",
    placeholder: "",
    marks: slot.marks,
    acceptedAnswer: slot.acceptedAnswer,
    overlayX: slot.overlayX,
    overlayY: slot.overlayY,
    overlayW: slot.overlayW,
    overlayH: slot.overlayH,
    transparentInput: slot.transparentInput,
  };
}

function ExamPageImage({ page }: { page: PracticeExamPage }) {
  return (
    <Card className="practice-card overflow-hidden">
      <div className="border-b border-black/8 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-6">
        Page {page.pageNumber}
      </div>
      <CardContent className="p-2 sm:p-3">
        <div className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-xl border border-black/10 bg-[#f3f4f6]">
          <img
            src={resolveQuestionImageSrc(page.imageDataUrl)}
            alt={`Exam page ${page.pageNumber}`}
            className="block w-full select-none object-contain"
            draggable={false}
            decoding="async"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export default function PracticeExamDetailPage() {
  const { subjectId, year, examNumber: examNumberParam } = useParams<{
    subjectId: string;
    year: string;
    examNumber: string;
  }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = isAdminUser(user);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [layout, setLayout] = useState<PracticeExamLayout>("written");
  const [mcqCount, setMcqCount] = useState(0);
  const [mcqItems, setMcqItems] = useState<PracticeExamMcqItem[]>([]);
  const [pages, setPages] = useState<PracticeExamPage[]>([]);
  const [slots, setSlots] = useState<PracticeExamSlot[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [partResults, setPartResults] = useState<Record<string, boolean>>({});
  const [section, setSection] = useState<"mcq" | "written">("mcq");

  const examYear = year && isPracticeExamYear(year) ? Number(year) : null;
  const examNumber =
    examNumberParam && isPracticeExamNumber(examNumberParam)
      ? parsePracticeExamNumber(examNumberParam)
      : null;

  const isMcqThenWritten = layout === "mcq_then_written" && mcqCount > 0;
  const writtenSlots = useMemo(
    () => slots.filter((slot) => !isMcqSlotKey(slot.key)),
    [slots],
  );

  const mcqPages = useMemo(() => {
    const nums = new Set(
      mcqItems
        .filter((item) => item.pageNumber && mcqPlacementCount(item) > 0)
        .map((i) => i.pageNumber!),
    );
    return pages.filter((p) => nums.has(p.pageNumber));
  }, [pages, mcqItems]);

  const partBPages = useMemo(
    () =>
      isMcqThenWritten
        ? writtenSectionPages(pages, writtenSlots, mcqItems)
        : pages,
    [pages, writtenSlots, mcqItems, isMcqThenWritten],
  );

  useEffect(() => {
    if (String(subjectId) === "demo" && !isAdmin) {
      navigate("/dashboard", { replace: true });
    }
  }, [subjectId, isAdmin, navigate]);

  useEffect(() => {
    if (!year || !isPracticeExamYear(year)) {
      navigate(`/practice/${subjectId}/exams`, { replace: true });
      return;
    }
    if (!examNumberParam || !isPracticeExamNumber(examNumberParam)) {
      navigate(`/practice/${subjectId}/exams/${year}`, { replace: true });
    }
  }, [year, examNumberParam, subjectId, navigate]);

  useEffect(() => {
    if (!subjectId || !examYear || !examNumber) return;
    let cancelled = false;
    setLoading(true);
    setError("");

    void (async () => {
      try {
        const meta = await fetchPracticeExamMeta(subjectId, examYear, examNumber);
        if (cancelled) return;
        if (!meta?.pages?.length) {
          setError("This exam is not available yet.");
          setPages([]);
          setSlots([]);
          setMcqItems([]);
          return;
        }
        const legacyTransparent = !!(meta as { transparentInputs?: boolean }).transparentInputs;
        const nextLayout =
          meta.layout ?? defaultPracticeExamLayout(subjectId, examNumber);
        const nextMcqCount =
          meta.mcqCount || defaultMcqCount(subjectId, examNumber);
        setLayout(nextLayout);
        setMcqCount(nextMcqCount);
        setMcqItems(
          nextLayout === "mcq_then_written" && nextMcqCount > 0
            ? normalizeMcqItems(nextMcqCount, meta.mcqItems ?? [])
            : meta.mcqItems ?? [],
        );
        setSlots(
          (meta.slots ?? []).map((slot) => ({
            ...slot,
            transparentInput:
              slot.transparentInput ?? (legacyTransparent ? true : undefined),
          })),
        );
        setAnswers({});
        setSubmitted(false);
        setPartResults({});
        setSection(nextLayout === "mcq_then_written" ? "mcq" : "written");

        const loaded: PracticeExamPage[] = [];
        for (const p of meta.pages) {
          const page = await fetchPracticeExamPage(subjectId, examYear, examNumber, p.pageNumber);
          if (page) loaded.push(page);
        }
        loaded.sort((a, b) => a.pageNumber - b.pageNumber);
        setPages(loaded);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load exam.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [subjectId, examYear, examNumber]);

  const visibleSubjects = useMemo(
    () => (isAdmin ? subjectsForUser({ isAdmin }) : baseSubjects),
    [isAdmin],
  );

  const subject = useMemo(
    () => visibleSubjects.find((s) => String(s.id) === String(subjectId)),
    [visibleSubjects, subjectId],
  );

  const markSummary = useMemo(() => {
    if (!submitted) return null;
    let earned = 0;
    let total = 0;
    for (const item of mcqItems) {
      if (!item.acceptedAnswer?.trim()) continue;
      const marks = item.marks ?? 1;
      total += marks;
      if (partResults[item.id]) earned += marks;
    }
    for (const slot of writtenSlots) {
      const marks = slot.marks ?? 1;
      total += marks;
      if (partResults[slot.id]) earned += marks;
    }
    return { earned, total };
  }, [submitted, mcqItems, writtenSlots, partResults]);

  const handleSubmit = () => {
    const next: Record<string, boolean> = {};
    for (const item of mcqItems) {
      if (!item.acceptedAnswer?.trim()) {
        next[item.id] = false;
        continue;
      }
      next[item.id] = isMcqAnswerCorrect(item, answers[item.id] ?? "");
    }
    for (const slot of writtenSlots) {
      const response = (answers[slot.id] ?? "").trim();
      const accepted = slot.acceptedAnswer?.trim();
      if (!accepted) {
        next[slot.id] = false;
        continue;
      }
      next[slot.id] = isAnswerCorrect(response, [accepted]).correct;
    }
    setPartResults(next);
    setSubmitted(true);
  };

  const handleTryAgain = () => {
    setSubmitted(false);
    setPartResults({});
  };


  if (!examYear || !examNumber) return null;

  const examTitle = practiceExamFullLabel(examYear, examNumber);
  const subtitle = isMcqThenWritten
    ? `Part A: tap A–D on the exam paper. Part B: written answers in the boxes.`
    : "Complete the input boxes on each page.";

  return (
    <AppShell
      title={subject ? `${subject.name} — ${examTitle}` : examTitle}
      subtitle={subtitle}
      edgeToEdgeHeader
      edgeToEdgeMain
    >
      <div className="mx-auto w-full max-w-4xl space-y-6">
        {loading ? (
          <Card className="practice-card">
            <CardContent className="flex items-center gap-2 px-4 py-10 text-sm text-muted-foreground sm:px-7">
              <Loader2 className="size-4 animate-spin" />
              Loading exam…
            </CardContent>
          </Card>
        ) : error || !pages.length ? (
          <Card className="practice-card">
            <CardContent className="px-4 py-12 text-center sm:px-7 sm:py-16">
              <FileText className="mx-auto size-10 text-muted-foreground/60" />
              <p className="mt-4 font-display text-lg font-semibold text-[#0b0f19]">
                {examTitle}
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                {error || "This exam is not available yet."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 px-1">
              {isMcqThenWritten ? (
                <div className="flex rounded-lg border border-black/10 bg-white p-0.5">
                  <button
                    type="button"
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      section === "mcq"
                        ? "bg-brand text-white"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => setSection("mcq")}
                  >
                    Part A — MCQ
                  </button>
                  <button
                    type="button"
                    className={cn(
                      "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                      section === "written"
                        ? "bg-brand text-white"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                    onClick={() => setSection("written")}
                  >
                    Part B — Written
                  </button>
                </div>
              ) : (
                <span />
              )}
              <div className="flex flex-wrap items-center gap-3">
                {!submitted ? (
                  <Button type="button" variant="accent" onClick={handleSubmit}>
                    Submit for marking
                  </Button>
                ) : (
                  <>
                    {markSummary ? (
                      <p className="text-sm font-medium text-foreground">
                        Score: {markSummary.earned} / {markSummary.total} marks
                      </p>
                    ) : null}
                    <Button type="button" variant="outline" onClick={handleTryAgain}>
                      Try again
                    </Button>
                  </>
                )}
              </div>
            </div>

            {isMcqThenWritten && section === "mcq" ? (
              <div className="space-y-6">
                <p className="px-1 text-sm text-muted-foreground">
                  Questions 1–{mcqCount} — tap A, B, C, or D on the exam paper.
                </p>
                {mcqPages.length ? (
                  mcqPages.map((page) => {
                    const pageMcqs = mcqItemsOnPage(mcqItems, page.pageNumber);
                    return (
                      <Card key={page.pageNumber} className="practice-card overflow-hidden">
                        <div className="border-b border-black/8 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-6">
                          Page {page.pageNumber}
                        </div>
                        <CardContent className="p-2 sm:p-3">
                          <ExamMcqPageOverlay
                            imageUrl={page.imageDataUrl}
                            items={pageMcqs}
                            answers={answers}
                            onSelect={(itemId, letter: McqOptionLetter) =>
                              setAnswers((prev) => ({ ...prev, [itemId]: letter }))
                            }
                            disabled={submitted}
                            submitted={submitted}
                            results={partResults}
                          />
                        </CardContent>
                      </Card>
                    );
                  })
                ) : (
                  <Card className="practice-card">
                    <CardContent className="px-4 py-8 text-center text-sm text-muted-foreground sm:px-7">
                      MCQ tap areas are not set up on this exam yet.
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : null}

            {!isMcqThenWritten || section === "written" ? (
              <div className="space-y-6">
                {isMcqThenWritten ? (
                  <p className="px-1 text-sm text-muted-foreground">
                    Questions {mcqCount + 1} onward — type your answers in the boxes on each page.
                  </p>
                ) : null}
                {partBPages.map((page) => {
                  const pageSlots = writtenSlots.filter((s) => s.pageNumber === page.pageNumber);
                  if (!pageSlots.length) {
                    return <ExamPageImage key={page.pageNumber} page={page} />;
                  }
                  return (
                    <Card key={page.pageNumber} className="practice-card overflow-hidden">
                      <div className="border-b border-black/8 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-6">
                        Page {page.pageNumber}
                      </div>
                      <CardContent className="p-2 sm:p-3">
                        <DiagramLabelInputs
                          imageUrl={page.imageDataUrl}
                          parts={pageSlots.map(slotToPart)}
                          values={pageSlots.map((slot) => answers[slot.id] ?? "")}
                          onChange={(index, value) => {
                            const slot = pageSlots[index];
                            if (!slot) return;
                            setAnswers((prev) => ({ ...prev, [slot.id]: value }));
                          }}
                          disabled={submitted}
                          submitted={submitted}
                          examPaperMode
                          partResults={pageSlots.map((slot) =>
                            submitted ? (partResults[slot.id] ?? null) : null,
                          )}
                          subjectId={subjectId}
                        />
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : null}

            {submitted ? (
              <Card className="practice-card">
                <CardContent className="space-y-3 px-4 py-5 sm:px-7">
                  <p className="text-sm font-semibold text-foreground">Marking feedback</p>
                  <div className="space-y-2">
                    {mcqItems
                      .filter((item) => item.acceptedAnswer?.trim())
                      .map((item) => {
                        const correct = partResults[item.id];
                        return (
                          <div
                            key={item.id}
                            className={cn(
                              "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
                              correct ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
                            )}
                          >
                            {correct ? (
                              <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                            ) : (
                              <XCircle className="mt-0.5 size-4 shrink-0" />
                            )}
                            <div>
                              <span className="font-medium">Q{item.questionNumber}</span>
                              {correct ? (
                                <span className="ml-2 opacity-90">Correct</span>
                              ) : (
                                <span className="ml-2 opacity-90">
                                  Expected{" "}
                                  <span className="font-semibold">
                                    {item.acceptedAnswer.toUpperCase()}
                                  </span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    {writtenSlots.map((slot) => {
                      const correct = partResults[slot.id];
                      const label = shortLabelFromSlotKey(slot.key);
                      return (
                        <div
                          key={slot.id}
                          className={cn(
                            "flex items-start gap-2 rounded-lg px-3 py-2 text-sm",
                            correct ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
                          )}
                        >
                          {correct ? (
                            <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
                          ) : (
                            <XCircle className="mt-0.5 size-4 shrink-0" />
                          )}
                          <div>
                            <span className="font-medium">{label}</span>
                            {correct ? (
                              <span className="ml-2 opacity-90">Correct</span>
                            ) : (
                              <span className="ml-2 opacity-90">
                                Expected{" "}
                                <span className="font-semibold">{slot.acceptedAnswer}</span>
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </>
        )}
      </div>
    </AppShell>
  );
}
