import { useMemo, useRef, useState } from "react";
import {
  CheckSquare,
  ChevronRight,
  FileText,
  FileUp,
  Loader2,
  Square,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
import { PdfPageCropEditor } from "@/components/admin/PdfPageCropEditor";
import type { AssessmentDraft, QuestionDraft } from "@/lib/createAssessmentDraft";
import { parseAnswerKeyDocument } from "@/lib/createPdfAnswerImport";
import {
  applyAnswerTextToRows,
  applySharedPageCrop,
  extractAnswerPdfText,
  importRowsToQuestionDrafts,
  parseExamQuestionPdf,
  type ExamImportRow,
} from "@/lib/examPdfImport";
import type { PdfSplitMode } from "@/lib/pdfQuestionImport";
import { cn } from "@/lib/utils";

type CreatePdfImportWizardProps = {
  draft: AssessmentDraft;
  onComplete: (questions: QuestionDraft[], questionPdf: File) => void;
  onSkipToManual: () => void;
  onQuestionPdfLoaded?: (file: File) => void;
};

function rowLabel(row: ExamImportRow): string {
  if (row.questionNumber != null) return `Question ${row.questionNumber}`;
  if (row.pageNumbers && row.pageNumbers.length > 1) {
    return `Pages ${row.pageNumbers.join(", ")}`;
  }
  if (row.pageQuestionCount && row.pageQuestionCount > 1) {
    return `Page ${row.pageNumber} · Q ${row.pageQuestionIndex}/${row.pageQuestionCount}`;
  }
  return `Page ${row.pageNumber}`;
}

export function CreatePdfImportWizard({
  draft,
  onComplete,
  onSkipToManual,
  onQuestionPdfLoaded,
}: CreatePdfImportWizardProps) {
  const questionFileRef = useRef<HTMLInputElement | null>(null);
  const answerFileRef = useRef<HTMLInputElement | null>(null);

  const [splitMode, setSplitMode] = useState<PdfSplitMode>("per_question");
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState("");
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parseSource, setParseSource] = useState<"nodent" | "generic" | null>(null);
  const [rows, setRows] = useState<ExamImportRow[]>([]);
  const [questionPdf, setQuestionPdf] = useState<File | null>(null);
  const [answerPdfName, setAnswerPdfName] = useState("");
  const [answerPaste, setAnswerPaste] = useState("");
  const [showAnswerPaste, setShowAnswerPaste] = useState(true);
  const [croppingRowId, setCroppingRowId] = useState<string | null>(null);
  const [building, setBuilding] = useState(false);

  const selectedCount = rows.filter((r) => r.selected).length;
  const allSelected = rows.length > 0 && selectedCount === rows.length;

  const toggleAll = () => {
    const next = !allSelected;
    setRows((prev) => prev.map((r) => ({ ...r, selected: next })));
  };

  const updateRow = (id: string, patch: Partial<ExamImportRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const processQuestionPdf = async (file: File) => {
    setParsing(true);
    setParseProgress("Reading question PDF…");
    setRows([]);
    setParseErrors([]);
    setParseSource(null);
    setQuestionPdf(file);
    onQuestionPdfLoaded?.(file);
    try {
      const { rows: parsed, errors, source } = await parseExamQuestionPdf(file, {
        splitMode,
        onProgress: (done, total) => {
          setParseProgress(`Scanning page ${done + 1} of ${total}…`);
        },
      });
      setRows(parsed);
      setParseErrors(errors);
      setParseSource(source);
      if (!parsed.length) {
        toast.error(
          errors[0] ??
            "No questions found. Try a different split mode or build manually from the page.",
        );
        return;
      }
      toast.success(
        `Found ${parsed.length} question(s)${source === "nodent" ? " (NODENT metadata)" : ""}.`,
      );
      if (errors.length) {
        toast.message(`${errors.length} page warning(s) — see details below.`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read question PDF.");
    } finally {
      setParsing(false);
      setParseProgress("");
    }
  };

  const applyAnswerText = (text: string, source: string) => {
    if (!rows.length) {
      toast.error("Import the question PDF first.");
      return;
    }
    const updated = applyAnswerTextToRows(rows, text);
    const doc = parseAnswerKeyDocument(text);
    const filled = updated.filter((r) =>
      r.type === "mcq"
        ? Boolean(r.correctAnswer)
        : r.parts.some((p) => p.acceptedAnswer.trim()),
    ).length;
    setRows(updated);
    if (!filled) {
      toast.error(`Could not parse answers from ${source}. Use the Question 1 / 1a. format.`);
      return;
    }
    const detail = updated
      .map((r, index) => {
        const qNum = r.questionNumber ?? index + 1;
        const parsedCount = doc.get(qNum)?.parts.length ?? 0;
        const filledCount = r.parts.filter((p) => p.acceptedAnswer.trim()).length;
        if (r.type === "mcq" && r.correctAnswer) return `Q${qNum}: MCQ`;
        if (!filledCount) return null;
        return parsedCount
          ? `Q${qNum}: ${filledCount}/${parsedCount}`
          : `Q${qNum}: ${filledCount}`;
      })
      .filter(Boolean)
      .join(" · ");
    toast.success(`Answers applied (${source}) — ${detail || `${filled} question(s)`}`);
  };

  const processAnswerPdf = async (file: File) => {
    if (!rows.length) {
      toast.error("Import the question PDF first.");
      return;
    }
    setParsing(true);
    setParseProgress("Reading answer PDF…");
    setAnswerPdfName(file.name);
    try {
      const text = await extractAnswerPdfText(file, (done, total) => {
        setParseProgress(`Answer PDF page ${done + 1} of ${total}…`);
      });
      applyAnswerText(text, file.name);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read answer PDF.");
    } finally {
      setParsing(false);
      setParseProgress("");
    }
  };

  const startCropping = (row: ExamImportRow) => {
    updateRow(row.id, { cropping: true });
  };

  const applyCrop = (row: ExamImportRow, cropped: string) => {
    const urls = row.imageDataUrls?.length
      ? row.imageDataUrls.map((url, idx) => (idx === 0 ? cropped : url))
      : undefined;
    setRows((prev) => applySharedPageCrop(prev, row, cropped, urls));
    toast.success(`Crop applied for ${rowLabel(row)}.`);
  };

  const handleBuild = async () => {
    const chosen = rows.filter((r) => r.selected);
    if (!chosen.length) {
      toast.error("Select at least one question.");
      return;
    }
    if (!questionPdf) {
      toast.error("Question PDF is missing — upload again.");
      return;
    }
    setBuilding(true);
    try {
      const questions = importRowsToQuestionDrafts(rows, draft.topic || "General");
      onComplete(questions, questionPdf);
      toast.success(`Loaded ${questions.length} question(s) into the editor.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not build assessment.");
    } finally {
      setBuilding(false);
    }
  };

  const splitModeHint = useMemo(() => {
    switch (splitMode) {
      case "per_question":
        return "Best for full exams — groups pages by Question 1, Question 2, etc.";
      case "by_marker":
        return "Splits each page when multiple question headers appear on one page.";
      default:
        return "One question per PDF page.";
    }
  }, [splitMode]);

  return (
    <section className="space-y-6">
      <input
        ref={questionFileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        disabled={parsing}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void processQuestionPdf(f);
          e.currentTarget.value = "";
        }}
      />
      <input
        ref={answerFileRef}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        disabled={parsing}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void processAnswerPdf(f);
          e.currentTarget.value = "";
        }}
      />

      <div className="grid gap-4 md:grid-cols-2">
        <button
          type="button"
          disabled={parsing}
          onClick={() => questionFileRef.current?.click()}
          className={cn(
            "group flex min-h-[11rem] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors",
            questionPdf
              ? "border-brand bg-brand/5"
              : "border-brand/40 bg-white hover:border-brand hover:bg-brand/[0.04]",
          )}
        >
          {parsing && !answerPdfName ? (
            <Loader2 className="size-10 animate-spin text-brand" />
          ) : (
            <FileUp className="size-10 text-brand transition-transform group-hover:scale-105" />
          )}
          <p className="mt-3 text-base font-semibold text-[#0b0f19]">
            {questionPdf ? questionPdf.name : "Question PDF"}
          </p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            {questionPdf
              ? `${rows.length} question(s) extracted — click to replace`
              : "Exam paper with all questions. Click to upload."}
          </p>
        </button>

        <button
          type="button"
          disabled={parsing || !rows.length}
          onClick={() => answerFileRef.current?.click()}
          className={cn(
            "group flex min-h-[11rem] flex-col items-center justify-center rounded-2xl border-2 border-dashed p-6 text-center transition-colors",
            !rows.length && "cursor-not-allowed opacity-50",
            answerPdfName
              ? "border-emerald-500 bg-emerald-50/50"
              : "border-black/15 bg-white hover:border-emerald-400 hover:bg-emerald-50/30",
          )}
        >
          {parsing && answerPdfName ? (
            <Loader2 className="size-10 animate-spin text-emerald-600" />
          ) : (
            <FileText className="size-10 text-emerald-600 transition-transform group-hover:scale-105" />
          )}
          <p className="mt-3 text-base font-semibold text-[#0b0f19]">
            {answerPdfName ? answerPdfName : "Answer PDF (optional)"}
          </p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            {answerPdfName
              ? "Solutions loaded — click to replace"
              : "Official solutions to auto-fill correct answers"}
          </p>
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-4 rounded-xl border border-black/8 bg-white px-4 py-3">
        <div className="min-w-[14rem] flex-1 space-y-1.5">
          <Label className="text-xs">How to split questions</Label>
          <Select
            value={splitMode}
            onValueChange={(v) => v && setSplitMode(v as PdfSplitMode)}
            disabled={parsing || Boolean(questionPdf)}
          >
            <SelectTrigger className="bg-[#fafbfc]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="per_question">By question number (recommended)</SelectItem>
              <SelectItem value="by_marker">Multiple questions per page</SelectItem>
              <SelectItem value="per_page">One per page</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground">{splitModeHint}</p>
        </div>
        {parsing ? (
          <p className="text-sm text-muted-foreground">{parseProgress}</p>
        ) : null}
      </div>

      {rows.length > 0 ? (
        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label className="text-sm font-semibold text-[#0b0f19]">
              Answer key (recommended: paste from GPT)
            </Label>
            <button
              type="button"
              className="text-[11px] text-muted-foreground underline"
              onClick={() => setShowAnswerPaste((v) => !v)}
            >
              {showAnswerPaste ? "Hide" : "Show"} paste box
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            Paste the plain-text key from GPT (Question 1 / 1a. 2 / 1b.i. …). PDF answer keys often
            break — pasting text works better.
          </p>
          {showAnswerPaste ? (
            <>
              <Textarea
                className="min-h-[10rem] font-mono text-xs"
                placeholder={`Question 1\n1a. 2\n1b.i. 11.42 g\n1b.ii. 14.1 g\n...\n\nQuestion 2\n2a. ...`}
                value={answerPaste}
                onChange={(e) => setAnswerPaste(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!answerPaste.trim()}
                onClick={() => applyAnswerText(answerPaste, "paste")}
              >
                Apply pasted answers
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      {parseErrors.length > 0 && rows.length === 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          <p className="font-medium">No questions parsed.</p>
          <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
            {parseErrors.slice(0, 6).map((msg) => (
              <li key={msg}>{msg}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {parseSource === "generic" && rows.length > 0 ? (
        <p className="rounded-lg border border-blue-200 bg-blue-50/80 px-4 py-2 text-xs text-blue-950">
          Parsed as a generic exam — tick the questions you want, crop each figure, then continue.
        </p>
      ) : null}

      {rows.length > 0 ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-[#0b0f19] px-4 py-3 text-white">
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-sm font-medium"
              onClick={toggleAll}
            >
              {allSelected ? (
                <CheckSquare className="size-4 text-brand-light" />
              ) : (
                <Square className="size-4 text-white/60" />
              )}
              {selectedCount} of {rows.length} questions selected
            </button>
            <Button
              type="button"
              variant="accent"
              className="gap-1.5"
              disabled={building || selectedCount === 0}
              onClick={() => void handleBuild()}
            >
              {building ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              Continue to editor ({selectedCount})
            </Button>
          </div>

          {rows.map((row) => (
            <article
              key={row.id}
              className={cn(
                "rounded-xl border bg-white p-4 shadow-sm transition-colors",
                row.selected ? "border-brand/30" : "border-black/10 opacity-75",
              )}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <label className="flex min-w-0 flex-1 cursor-pointer items-start gap-2">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={row.selected}
                    onChange={(e) => updateRow(row.id, { selected: e.target.checked })}
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-[#0b0f19]">
                      {rowLabel(row)}
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {row.type === "mcq"
                          ? "MCQ"
                          : row.parts.length >= 2
                            ? `${row.parts.length} parts · ${row.marks} marks`
                            : `${row.marks} mark${row.marks === 1 ? "" : "s"}`}
                      </span>
                    </p>
                    {row.question.trim() ? (
                      <RichQuestionContent
                        text={row.question.slice(0, 400)}
                        className="prose prose-sm max-w-none text-muted-foreground"
                      />
                    ) : (
                      <p className="text-xs italic text-muted-foreground">See figure.</p>
                    )}
                    {row.type !== "mcq" && row.parts.some((p) => p.acceptedAnswer.trim()) ? (
                      <p className="text-[11px] text-emerald-700">
                        {row.parts.filter((p) => p.acceptedAnswer.trim()).length}/
                        {row.parts.length} answer
                        {row.parts.length === 1 ? "" : "s"} loaded
                      </p>
                    ) : row.type === "mcq" && row.correctAnswer ? (
                      <p className="text-[11px] text-emerald-700">
                        Answer: {row.correctAnswer}
                      </p>
                    ) : null}
                  </div>
                </label>

                {row.useImage && row.imageDataUrl ? (
                  <div className="flex shrink-0 flex-col items-end gap-2">
                    <img
                      src={row.imageDataUrl}
                      alt=""
                      className="max-h-28 max-w-[10rem] rounded-lg border border-black/10 object-contain"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={croppingRowId === row.id}
                      onClick={() => startCropping(row)}
                    >
                      {row.cropping ? "Cropping…" : "Crop figure"}
                    </Button>
                  </div>
                ) : null}
              </div>

              {row.cropping && row.useImage ? (
                <div className="mt-4 rounded-lg border border-black/10 bg-[#fafbfc] p-2">
                  <PdfPageCropEditor
                    imageDataUrl={row.sourceImageDataUrl ?? row.imageDataUrl}
                    crop={row.crop}
                    onCropChange={(crop) => updateRow(row.id, { crop })}
                    onApply={(cropped) => {
                      setCroppingRowId(null);
                      applyCrop(row, cropped);
                      updateRow(row.id, { cropping: false });
                    }}
                    onCancel={() => {
                      setCroppingRowId(null);
                      updateRow(row.id, { cropping: false });
                    }}
                  />
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="text-center text-xs text-muted-foreground">
          Choose split mode above, then upload your question PDF.
          {" "}
          <button type="button" className="underline underline-offset-2" onClick={onSkipToManual}>
            Or build page-by-page in the editor
          </button>
        </p>
      )}
    </section>
  );
}
