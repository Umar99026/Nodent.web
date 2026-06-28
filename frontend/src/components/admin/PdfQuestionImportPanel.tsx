import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckSquare,
  FileText,
  FileUp,
  Loader2,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { apiFetchAdmin, ApiError } from "@/lib/api";
import { API_PATHS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PdfPageCropEditor } from "@/components/admin/PdfPageCropEditor";
import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
import { parseAnswerKeyDocument } from "@/lib/createPdfAnswerImport";
import {
  publishQuestionDraftsToPracticeBank,
} from "@/lib/createAssessmentDraft";
import {
  applyAnswerTextToRows,
  applySharedPageCrop,
  extractAnswerPdfText,
  importRowToQuestionDraft,
  parseExamQuestionPdf,
  type ExamImportRow,
} from "@/lib/examPdfImport";
import { purgeCustomQuestionsForSubject } from "@/lib/questionBankCache";
import { inferPdfQuestionTopic, topicLabelsForSubject } from "@/lib/pdfTopicInfer";
import type { PdfSplitMode } from "@/lib/pdfQuestionImport";
import { cn } from "@/lib/utils";

type SubjectOption = { id: string; name: string };

type Props = {
  subjects: SubjectOption[];
  defaultSubjectId?: string;
  onImported?: () => void | Promise<void>;
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

export function PdfQuestionImportPanel({
  subjects,
  defaultSubjectId = "",
  onImported,
}: Props) {
  const questionFileRef = useRef<HTMLInputElement | null>(null);
  const answerFileRef = useRef<HTMLInputElement | null>(null);

  const demoSubjectId = subjects.find((s) => s.id === "demo")?.id;
  const initialSubject =
    defaultSubjectId ||
    (import.meta.env.DEV && demoSubjectId ? demoSubjectId : "") ||
    subjects[0]?.id ||
    "";

  const [subjectId, setSubjectId] = useState(initialSubject);
  const [defaultTopic, setDefaultTopic] = useState("General");
  const [splitMode, setSplitMode] = useState<PdfSplitMode>("per_question");
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState("");
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parseSource, setParseSource] = useState<"nodent" | "generic" | null>(null);
  const [rows, setRows] = useState<ExamImportRow[]>([]);
  const [answerPdfName, setAnswerPdfName] = useState("");
  const [answerPaste, setAnswerPaste] = useState("");
  const [showAnswerPaste, setShowAnswerPaste] = useState(true);
  const [croppingRowId, setCroppingRowId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);

  const topicOptions = useMemo(() => {
    const labels = topicLabelsForSubject(subjectId);
    return labels.length ? [...labels] : ["General"];
  }, [subjectId]);

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
    if (
      rows.length > 0 &&
      !window.confirm(
        `Replace ${rows.length} question(s) in the editor with a fresh parse of "${file.name}"?`,
      )
    ) {
      return;
    }
    setParsing(true);
    setParseProgress("Reading question PDF…");
    setRows([]);
    setParseErrors([]);
    setParseSource(null);
    setAnswerPdfName("");
    setAnswerPaste("");
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
            "No questions found. Try a different split mode or check the PDF format.",
          { duration: 10000 },
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

  const applyCrop = (row: ExamImportRow, cropped: string) => {
    const urls = row.imageDataUrls?.length
      ? row.imageDataUrls.map((url, idx) => (idx === 0 ? cropped : url))
      : undefined;
    setRows((prev) => applySharedPageCrop(prev, row, cropped, urls));
    toast.success(`Crop applied for ${rowLabel(row)}.`);
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
      toast.error("MCQ rows need all four options filled and a correct answer.");
      return;
    }

    setImporting(true);
    const importedIds: string[] = [];
    try {
      const drafts = chosen.map((row) => {
        const topic =
          inferPdfQuestionTopic(subjectId, row.question, row.passage) || defaultTopic;
        return importRowToQuestionDraft(row, topic);
      });

      const result = await publishQuestionDraftsToPracticeBank(
        subjectId,
        defaultTopic,
        drafts,
      );

      if (result.errors.length) {
        const failedIndices = new Set(result.errors.map((e) => e.index));
        chosen.forEach((row, index) => {
          if (!failedIndices.has(index)) importedIds.push(row.id);
        });
        toast.error(
          result.imported > 0
            ? `Imported ${result.imported}; ${result.errors.length} failed — failed rows remain in the list.`
            : result.errors[0]?.message ?? "Import failed.",
          { duration: 10000 },
        );
      } else if (result.imported === 0 && result.skipped > 0) {
        toast.error(
          `No new questions imported — ${result.skipped} duplicate(s) already in "${subjectId}".`,
          { duration: 12000 },
        );
      } else if (result.imported === 0) {
        toast.error("No questions were imported.");
      } else if (result.skipped > 0) {
        toast.success(
          `Imported ${result.imported} question(s) into "${subjectId}" (${result.skipped} duplicate(s) skipped). Each appears separately in practice.`,
        );
        importedIds.push(...chosen.map((r) => r.id));
      } else {
        toast.success(
          `Imported ${result.imported} question(s) into "${subjectId}". Each appears separately in practice.`,
        );
        importedIds.push(...chosen.map((r) => r.id));
      }

      if (importedIds.length) {
        const removed = new Set(importedIds);
        setRows((prev) => prev.filter((r) => !removed.has(r.id)));
        purgeCustomQuestionsForSubject(subjectId);
        await onImported?.();
      }
    } finally {
      setImporting(false);
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
    <Card className="surface-card">
      <CardHeader>
        <CardTitle className="font-display text-lg">Import questions</CardTitle>
        <p className="text-sm text-muted-foreground">
          Same workflow as exam PDF import: upload the paper, optionally load answers, crop
          figures, then import. Each question is saved separately in the practice bank (not as a
          grouped exam).
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
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

        <input
          ref={questionFileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="sr-only"
          disabled={parsing || importing}
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
          disabled={parsing || importing}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void processAnswerPdf(f);
            e.currentTarget.value = "";
          }}
        />

        <div className="grid gap-4 md:grid-cols-2">
          <button
            type="button"
            disabled={parsing || importing}
            onClick={() => questionFileRef.current?.click()}
            className={cn(
              "group flex min-h-[9rem] flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition-colors",
              rows.length
                ? "border-brand bg-brand/5"
                : "border-brand/40 bg-white hover:border-brand hover:bg-brand/[0.04]",
            )}
          >
            {parsing && !answerPdfName ? (
              <Loader2 className="size-8 animate-spin text-brand" />
            ) : (
              <FileUp className="size-8 text-brand" />
            )}
            <p className="mt-2 text-sm font-semibold">Question PDF</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {rows.length
                ? `${rows.length} question(s) parsed — click to replace`
                : "Exam paper or NODENT PDF"}
            </p>
          </button>

          <button
            type="button"
            disabled={parsing || importing || !rows.length}
            onClick={() => answerFileRef.current?.click()}
            className={cn(
              "group flex min-h-[9rem] flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition-colors",
              !rows.length && "cursor-not-allowed opacity-50",
              answerPdfName
                ? "border-emerald-500 bg-emerald-50/50"
                : "border-black/15 bg-white hover:border-emerald-400",
            )}
          >
            {parsing && answerPdfName ? (
              <Loader2 className="size-8 animate-spin text-emerald-600" />
            ) : (
              <FileText className="size-8 text-emerald-600" />
            )}
            <p className="mt-2 text-sm font-semibold">Answer PDF (optional)</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {answerPdfName ? answerPdfName : "Or paste answers below"}
            </p>
          </button>
        </div>

        <div className="flex flex-wrap items-end gap-4 rounded-xl border border-black/8 bg-white px-4 py-3">
          <div className="min-w-[14rem] flex-1 space-y-1.5">
            <Label className="text-xs">How to split questions</Label>
            <Select
              value={splitMode}
              onValueChange={(v) => v && setSplitMode(v as PdfSplitMode)}
              disabled={parsing || importing || rows.length > 0}
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
          {parsing ? <p className="text-sm text-muted-foreground">{parseProgress}</p> : null}
        </div>

        {rows.length > 0 ? (
          <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Label className="text-sm font-semibold">Answer key (paste recommended)</Label>
              <button
                type="button"
                className="text-[11px] text-muted-foreground underline"
                onClick={() => setShowAnswerPaste((v) => !v)}
              >
                {showAnswerPaste ? "Hide" : "Show"} paste box
              </button>
            </div>
            {showAnswerPaste ? (
              <>
                <Textarea
                  className="min-h-[8rem] font-mono text-xs"
                  placeholder={`Question 1\n1a. 2\n1b.i. 11.42\n...\n\nQuestion 2\n2a. ...`}
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
            <p className="font-medium">Parse warnings</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
              {parseErrors.slice(0, 6).map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {parseSource === "generic" && rows.length > 0 ? (
          <p className="rounded-lg border border-blue-200 bg-blue-50/80 px-4 py-2 text-xs text-blue-950">
            Parsed as a generic exam PDF — select questions, crop figures, then import to the
            practice bank.
          </p>
        ) : null}

        {rows.length > 0 ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-black/10 bg-muted/40 px-4 py-3">
              <button
                type="button"
                className="inline-flex items-center gap-1.5 text-sm font-medium"
                onClick={toggleAll}
              >
                {allSelected ? (
                  <CheckSquare className="size-4 text-brand" />
                ) : (
                  <Square className="size-4 text-muted-foreground" />
                )}
                {selectedCount} of {rows.length} selected
              </button>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={clearing || importing || !subjectId}
                  onClick={() => void clearSubjectQuestions()}
                >
                  {clearing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Clear subject
                </Button>
                <Button
                  type="button"
                  variant="accent"
                  size="sm"
                  className="gap-1.5"
                  disabled={importing || selectedCount === 0}
                  onClick={() => void importSelected()}
                >
                  {importing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Upload className="size-4" />
                  )}
                  Import {selectedCount} to practice
                </Button>
              </div>
            </div>

            {rows.map((row) => (
              <article
                key={row.id}
                className={cn(
                  "rounded-xl border bg-white p-4 shadow-sm",
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
                      <p className="text-sm font-semibold">
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
                        onClick={() => {
                          setCroppingRowId(row.id);
                          updateRow(row.id, { cropping: true });
                        }}
                      >
                        Crop figure
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
                        updateRow(row.id, { cropping: false, cropApplied: true });
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
            Choose split mode, upload a question PDF, then import selected rows into the practice
            bank.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
