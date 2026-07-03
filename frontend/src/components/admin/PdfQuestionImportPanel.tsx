import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  CheckSquare,
  FileUp,
  Loader2,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { apiFetchAdmin, ApiError } from "@/lib/api";
import { API_PATHS } from "@/lib/constants";
import { PdfImportQuestionRow } from "@/components/admin/PdfImportQuestionRow";
import { PdfImportScrollViewer } from "@/components/admin/PdfImportScrollViewer";
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
import { publishQuestionDraftsToPracticeBank } from "@/lib/createAssessmentDraft";
import {
  applyTsvToExamImportRows,
  importRowToQuestionDraft,
  parseExamQuestionPdf,
  type ExamImportPart,
  type ExamImportRow,
  type QuestionImportMatchReport,
} from "@/lib/examPdfImport";
import { getExamImportTsvDiagnostics } from "@/lib/practiceExamImport";
import { readImportTextFile } from "@/lib/readImportTextFile";
import { FULL_CROP, type CropRect } from "@/lib/pdfImageCrop";
import { purgeCustomQuestionsForSubject } from "@/lib/questionBankCache";
import { inferPdfQuestionTopic, topicLabelsForSubject } from "@/lib/pdfTopicInfer";
import { loadExamPdfPages } from "@/lib/practiceExamImport";
import type { PracticeExamPage } from "@/lib/practiceExamTypes";
import { cn } from "@/lib/utils";

type SubjectOption = { id: string; name: string };

type Props = {
  subjects: SubjectOption[];
  defaultSubjectId?: string;
  onImported?: () => void | Promise<void>;
};

type CropTarget =
  | { kind: "row"; rowId: string }
  | { kind: "part"; rowId: string; partKey: string };

function rowLabel(row: ExamImportRow): string {
  const global = row.questionNumber;
  const local = row.examLocalNumber;
  if (global != null && local != null && local !== global) {
    return `Question ${global} (Section Q${local})`;
  }
  if (global != null) return `Question ${global}`;
  if (local != null) return `Question ${local}`;
  if (row.pageNumbers && row.pageNumbers.length > 1) {
    return `Pages ${row.pageNumbers.join(", ")}`;
  }
  return `Page ${row.pageNumber}`;
}

export function PdfQuestionImportPanel({
  subjects,
  defaultSubjectId = "",
  onImported,
}: Props) {
  const questionFileRef = useRef<HTMLInputElement | null>(null);
  const tsvFileRef = useRef<HTMLInputElement | null>(null);

  const demoSubjectId = subjects.find((s) => s.id === "demo")?.id;
  const initialSubject =
    defaultSubjectId ||
    (import.meta.env.DEV && demoSubjectId ? demoSubjectId : "") ||
    subjects[0]?.id ||
    "";

  const [subjectId, setSubjectId] = useState(initialSubject);
  const [defaultTopic, setDefaultTopic] = useState("General");
  const [parsing, setParsing] = useState(false);
  const [parseProgress, setParseProgress] = useState("");
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [parseSource, setParseSource] = useState<"nodent" | "generic" | null>(null);
  const [pages, setPages] = useState<PracticeExamPage[]>([]);
  /** PDF-only: page numbers + images. No question wording. */
  const [pdfSkeletonRows, setPdfSkeletonRows] = useState<ExamImportRow[]>([]);
  const [rows, setRows] = useState<ExamImportRow[]>([]);
  const [tsvText, setTsvText] = useState("");
  const [tsvSourceName, setTsvSourceName] = useState<string | null>(null);
  const [tsvParseHint, setTsvParseHint] = useState<string | null>(null);
  const [matchReport, setMatchReport] = useState<QuestionImportMatchReport | null>(null);
  const [importing, setImporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [cropTarget, setCropTarget] = useState<CropTarget | null>(null);
  const [cropPageNumber, setCropPageNumber] = useState<number | null>(null);
  const [cropRect, setCropRect] = useState<CropRect>(FULL_CROP);

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
    setPdfSkeletonRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const updatePart = (rowId: string, partKey: string, patch: Partial<ExamImportPart>) => {
    setPdfSkeletonRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          parts: r.parts.map((p) =>
            p.key.trim().toLowerCase() === partKey.trim().toLowerCase()
              ? { ...p, ...patch }
              : p,
          ),
        };
      }),
    );
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        return {
          ...r,
          parts: r.parts.map((p) =>
            p.key.trim().toLowerCase() === partKey.trim().toLowerCase()
              ? { ...p, ...patch }
              : p,
          ),
        };
      }),
    );
  };

  const mergeTsvIntoRows = (
    skeleton: ExamImportRow[],
    text: string,
    showToast = false,
  ): boolean => {
    if (!text.trim()) {
      setRows(skeleton);
      setMatchReport(null);
      setTsvParseHint(null);
      return true;
    }
    const { rows: merged, report } = applyTsvToExamImportRows(skeleton, text);
    setRows(merged);
    setMatchReport(report);

    if (report.matchedQuestions > 0) {
      setTsvParseHint(null);
    } else {
      setTsvParseHint(getExamImportTsvDiagnostics(text).hint ?? "Could not parse TSV.");
    }

    if (text.trim() && !report.matchedQuestions) {
      if (showToast) {
        const diag = getExamImportTsvDiagnostics(text);
        toast.error(diag.hint ?? "Could not parse TSV.");
      }
      return false;
    }

    if (showToast) {
      const filled = merged.filter((r) =>
        r.type === "mcq"
          ? Boolean(r.correctAnswer.trim())
          : r.parts.some((p) => p.acceptedAnswer.trim()) || Boolean(r.question.trim()),
      ).length;
      const pdfNote =
        report.pdfQuestions > 0
          ? ` · ${filled}/${report.pdfQuestions} have TSV wording`
          : "";
      const awaitingNote =
        report.awaitingTsv > 0
          ? ` · ${report.awaitingTsv} still need TSV rows`
          : "";
      toast.success(
        `TSV: ${report.matchedQuestions} question(s) parsed${pdfNote}${awaitingNote}`,
      );
    }
    return true;
  };

  const handleTsvChange = (text: string) => {
    setTsvText(text);
    setTsvSourceName(null);
    mergeTsvIntoRows(pdfSkeletonRows, text, false);
  };

  const loadTsvFile = async (file: File) => {
    try {
      const text = await readImportTextFile(file);
      setTsvText(text);
      setTsvSourceName(file.name);
      mergeTsvIntoRows(pdfSkeletonRows, text, true);
    } catch {
      toast.error(`Could not read "${file.name}".`);
    }
  };

  const processQuestionPdf = async (file: File) => {
    if (
      rows.length > 0 &&
      !window.confirm(`Replace ${rows.length} parsed question(s) with "${file.name}"?`)
    ) {
      return;
    }
    setParsing(true);
    setParseProgress("Reading PDF…");
    setPdfSkeletonRows([]);
    setRows([]);
    setPages([]);
    setParseErrors([]);
    setParseSource(null);
    setMatchReport(null);
    setCropTarget(null);
    setCropPageNumber(null);
    const tsvSnapshot = tsvText;
    try {
      const [parsedResult, loadedPages] = await Promise.all([
        parseExamQuestionPdf(file, {
          skeletonOnly: true,
          onProgress: (done, total) => {
            setParseProgress(`Mapping questions… page ${done + 1} of ${total}`);
          },
        }),
        loadExamPdfPages(file, (done, total) => {
          if (done === 0 || done === total) {
            setParseProgress(`Rendering pages… ${done}/${total}`);
          }
        }),
      ]);

      const skeleton = parsedResult.rows.map((row) => ({
        ...row,
        question: "",
        parts: [],
        imagePageNumber: row.pageNumber,
        sourceImageDataUrl: row.sourceImageDataUrl ?? row.imageDataUrl,
      }));

      setPages(loadedPages);
      setPdfSkeletonRows(skeleton);
      setParseErrors(parsedResult.errors);
      setParseSource(parsedResult.source);

      if (!skeleton.length && !tsvSnapshot.trim()) {
        toast.error(
          parsedResult.errors[0] ??
            "No question headers found in PDF. Paste a TSV to build questions.",
          { duration: 10000 },
        );
        return;
      }

      if (tsvSnapshot.trim()) {
        mergeTsvIntoRows(skeleton, tsvSnapshot, true);
      } else {
        setRows(skeleton);
        toast.success(
          skeleton.length
            ? `Mapped ${skeleton.length} question slot(s). Paste TSV for wording + answers.`
            : "Paste your questions TSV below.",
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not read question PDF.");
    } finally {
      setParsing(false);
      setParseProgress("");
    }
  };

  const applyTsv = () => {
    if (!tsvText.trim()) {
      toast.error("Paste TSV first.");
      return;
    }
    mergeTsvIntoRows(pdfSkeletonRows, tsvText, true);
  };

  const cropTargetLabel = useMemo(() => {
    if (!cropTarget) return null;
    const row = rows.find((r) => r.id === cropTarget.rowId);
    if (!row) return null;
    const base = rowLabel(row);
    if (cropTarget.kind === "part") {
      const part = row.parts.find(
        (p) => p.key.trim().toLowerCase() === cropTarget.partKey.trim().toLowerCase(),
      );
      return part ? `${base} — part ${part.key}` : base;
    }
    return row.parts.length >= 2 ? `${base} — shared figure` : base;
  }, [cropTarget, rows]);

  const resolveCropPageNumber = (target: CropTarget): number => {
    const row = rows.find((r) => r.id === target.rowId);
    if (!row) return pages[0]?.pageNumber ?? 1;
    if (target.kind === "part") {
      const part = row.parts.find(
        (p) => p.key.trim().toLowerCase() === target.partKey.trim().toLowerCase(),
      );
      return part?.imagePageNumber ?? row.imagePageNumber ?? row.pageNumber ?? 1;
    }
    return row.imagePageNumber ?? row.pageNumber ?? 1;
  };

  const startCrop = (target: CropTarget) => {
    setCropTarget(target);
    setCropRect(FULL_CROP);
    setCropPageNumber(resolveCropPageNumber(target));
    if (target.kind === "row") {
      updateRow(target.rowId, { cropping: true });
    } else {
      updatePart(target.rowId, target.partKey, { cropping: true });
    }
  };

  const cancelCrop = () => {
    if (!cropTarget) return;
    if (cropTarget.kind === "row") {
      updateRow(cropTarget.rowId, { cropping: false });
    } else {
      updatePart(cropTarget.rowId, cropTarget.partKey, { cropping: false });
    }
    setCropTarget(null);
    setCropPageNumber(null);
    setCropRect(FULL_CROP);
  };

  const applyCroppedFigure = (croppedDataUrl: string, pageNumber: number) => {
    if (!cropTarget) return;
    const page = pages.find((p) => p.pageNumber === pageNumber);
    const source = page?.imageDataUrl ?? "";

    if (cropTarget.kind === "row") {
      updateRow(cropTarget.rowId, {
        imageDataUrl: croppedDataUrl,
        sourceImageDataUrl: source,
        imagePageNumber: pageNumber,
        crop: FULL_CROP,
        cropApplied: true,
        cropping: false,
        useImage: true,
      });
    } else {
      updatePart(cropTarget.rowId, cropTarget.partKey, {
        imageDataUrl: croppedDataUrl,
        sourceImageDataUrl: source,
        imagePageNumber: pageNumber,
        crop: FULL_CROP,
        cropApplied: true,
        cropping: false,
      });
    }
    setCropTarget(null);
    setCropPageNumber(null);
    setCropRect(FULL_CROP);
    toast.success("Figure attached.");
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
        { method: "POST", body: JSON.stringify({ subjectId }) },
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

    const missingAnswers = chosen.filter((r) =>
      r.type === "mcq"
        ? !r.correctAnswer.trim()
        : !r.parts.some((p) => p.acceptedAnswer.trim()),
    );
    if (missingAnswers.length) {
      toast.error(`${missingAnswers.length} selected question(s) still missing TSV answers.`);
      return;
    }

    setImporting(true);
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
        toast.error(
          result.imported > 0
            ? `Imported ${result.imported}; ${result.errors.length} failed.`
            : result.errors[0]?.message ?? "Import failed.",
          { duration: 10000 },
        );
      } else if (result.imported === 0 && result.skipped > 0) {
        toast.error(`No new questions — ${result.skipped} duplicate(s) in "${subjectId}".`);
      } else if (result.imported === 0) {
        toast.error("No questions were imported.");
      } else {
        toast.success(
          `Imported ${result.imported} question(s) into "${subjectId}" (${result.skipped} duplicate(s) skipped).`,
        );
        const importedIds = new Set(chosen.map((r) => r.id));
        setRows((prev) => prev.filter((r) => !importedIds.has(r.id)));
        purgeCustomQuestionsForSubject(subjectId);
        await onImported?.();
      }
    } finally {
      setImporting(false);
    }
  };

  const isRowIncomplete = (row: ExamImportRow) =>
    matchReport?.incompleteQuestions.some((q) => q.question === row.questionNumber);

  return (
    <Card className="surface-card">
      <CardHeader>
        <CardTitle className="font-display text-lg">Import questions</CardTitle>
        <p className="text-sm text-muted-foreground">
          Upload your TSV (Question_ID · Question · Answer) or paste tab-separated rows.
          Upload the PDF separately for figure cropping.
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

        <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/40 p-4">
          <Label className="text-sm font-semibold">Questions + answers (TSV)</Label>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Supports <strong>Question_ID · Question · Answer</strong> (e.g. A1a, B_M1_Q2b) or{" "}
            <strong>question · part · question_text · answer · marks</strong>. Upload the exam PDF
            below to attach page images for cropping.
          </p>
          <Textarea
            className="min-h-[9rem] font-mono text-xs"
            placeholder={"question\tpart\tquestion_text\tanswer\tmarks\n1\tstem\t…\t\t0\n1\ta\t…\tanswer\t1"}
            value={tsvText}
            onChange={(e) => handleTsvChange(e.target.value)}
          />
          {tsvSourceName ? (
            <p className="text-[11px] font-medium text-emerald-800">
              Loaded file: {tsvSourceName}
              {tsvText.trim() ? ` · ${tsvText.trim().split(/\r?\n/).filter(Boolean).length} lines` : ""}
            </p>
          ) : tsvText.trim() ? (
            <p className="text-[11px] text-muted-foreground">TSV pasted · edit below anytime</p>
          ) : null}
          <input
            ref={tsvFileRef}
            type="file"
            accept=".tsv,.txt,.csv,text/tab-separated-values,text/csv"
            className="sr-only"
            disabled={parsing || importing}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void loadTsvFile(f);
              e.currentTarget.value = "";
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={parsing || importing}
              onClick={() => tsvFileRef.current?.click()}
            >
              {tsvSourceName ? "Replace TSV file" : "Upload TSV file"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={!tsvText.trim()}
              onClick={applyTsv}
            >
              Reload from TSV
            </Button>
          </div>
          {tsvParseHint ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[11px] text-red-900">
              {tsvParseHint}
            </p>
          ) : null}
          {matchReport && matchReport.matchedQuestions > 0 ? (
            <p className="text-[11px] text-emerald-900">
              {matchReport.tsvRows} TSV row(s) · {matchReport.matchedQuestions} question(s) in TSV
              {matchReport.pdfQuestions > 0
                ? ` · ${matchReport.pdfQuestions} slots from PDF · ${matchReport.awaitingTsv} awaiting TSV`
                : null}
              {matchReport.incompleteQuestions.length
                ? ` · ${matchReport.incompleteQuestions.length} incomplete`
                : ""}
            </p>
          ) : null}
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

        <button
          type="button"
          disabled={parsing || importing}
          onClick={() => questionFileRef.current?.click()}
          className={cn(
            "flex min-h-[8rem] w-full flex-col items-center justify-center rounded-xl border-2 border-dashed p-5 text-center transition-colors",
            rows.length
              ? "border-brand bg-brand/5"
              : "border-brand/40 bg-white hover:border-brand hover:bg-brand/[0.04]",
          )}
        >
          {parsing ? (
            <Loader2 className="size-8 animate-spin text-brand" />
          ) : (
            <FileUp className="size-8 text-brand" />
          )}
          <p className="mt-2 text-sm font-semibold">Question PDF</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {pages.length
              ? `${pdfSkeletonRows.length} slot(s) · ${pages.length} page(s) — figures only`
              : "Optional — for cropping figures (no text extracted)"}
          </p>
          {parsing && parseProgress ? (
            <p className="mt-2 text-xs text-muted-foreground">{parseProgress}</p>
          ) : null}
        </button>

        {parseErrors.length > 0 && pdfSkeletonRows.length === 0 && !tsvText.trim() ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium">Parse warnings</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
              {parseErrors.slice(0, 6).map((msg) => (
                <li key={msg}>{msg}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {matchReport?.unmatchedTsv.length ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 px-4 py-3 text-xs text-amber-950">
            <p className="font-medium">Unmatched TSV rows (no question in PDF)</p>
            <ul className="mt-2 space-y-1">
              {matchReport.unmatchedTsv.slice(0, 8).map((u, i) => (
                <li key={`${u.question}-${u.part}-${i}`}>
                  Q{u.question || "?"} {u.part}: {u.answer.slice(0, 40)}
                </li>
              ))}
            </ul>
          </div>
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
                  disabled={clearing || importing}
                  onClick={() => void clearSubjectQuestions()}
                >
                  {clearing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
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

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(300px,38%)]">
              <div className="max-h-[calc(100vh-10rem)] space-y-3 overflow-y-auto pr-1">
                {rows.map((row) => (
                  <PdfImportQuestionRow
                    key={row.id}
                    row={row}
                    rowLabel={rowLabel(row)}
                    incomplete={isRowIncomplete(row)}
                    parseSource={parseSource}
                    cropTarget={cropTarget}
                    onToggleSelected={(selected) => updateRow(row.id, { selected })}
                    onPickFigure={startCrop}
                  />
                ))}
              </div>

              <div className="sticky top-4 h-[calc(100vh-10rem)] min-h-[20rem] overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
                <PdfImportScrollViewer
                  pages={pages}
                  cropActive={Boolean(cropTarget)}
                  cropTargetLabel={cropTargetLabel}
                  cropPageNumber={cropPageNumber}
                  onSelectCropPage={(pageNumber) => {
                    setCropPageNumber(pageNumber);
                    setCropRect(FULL_CROP);
                  }}
                  crop={cropRect}
                  onCropChange={setCropRect}
                  onApplyCrop={applyCroppedFigure}
                  onCancelCrop={cancelCrop}
                />
              </div>
            </div>
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            Upload a question PDF, match TSV answers, then pick figures from the PDF on the right.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
