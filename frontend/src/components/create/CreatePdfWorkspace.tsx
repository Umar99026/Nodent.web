import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileUp,
  Loader2,
  Plus,
  Type,
  ImagePlus,
  BookText,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CropAssignPanel } from "@/components/create/CropAssignPanel";
import { CreatePdfQuestionPanel } from "@/components/create/CreatePdfQuestionPanel";
import {
  CreatePdfPageViewer,
  getSelectedTextFromViewer,
  type PdfViewerTool,
} from "@/components/create/CreatePdfPageViewer";
import {
  createEmptyQuestionDraft,
  type AssessmentDraft,
  type QuestionDraft,
} from "@/lib/createAssessmentDraft";
import { loadPdfPageView, openPdfDocument, type PdfPageView } from "@/lib/createPdfPageView";
import { parseNodentPdfToQuestions } from "@/lib/nodentPdfImport";
import { compressDataUrlIfLarge } from "@/lib/imageCompressor";
import { normalizeQuestionMathText } from "@/lib/questionMathText";
import { FULL_CROP, type CropRect } from "@/lib/pdfImageCrop";
import type { CropAssignTarget } from "@/lib/createPdfCropAssign";
import { emptyMultipartParts } from "@/components/admin/MultipartAnswerPartsEditor";
import { cropTargetLabel } from "@/lib/createPdfCropAssign";
import { cn } from "@/lib/utils";

type CreatePdfWorkspaceProps = {
  draft: AssessmentDraft;
  onDraftChange: (draft: AssessmentDraft) => void;
  initialPdfFile?: File | null;
  onReimport?: () => void;
};

function appendField(existing: string, addition: string): string {
  const next = addition.trim();
  if (!next) return existing;
  if (!existing.trim()) return next;
  return `${existing.trim()}\n\n${next}`;
}

function nodentQuestionToDraft(
  q: Awaited<ReturnType<typeof parseNodentPdfToQuestions>>["questions"][number],
): QuestionDraft {
  const base = createEmptyQuestionDraft();
  const isMcq = q.type === "mcq" && (q.mcqOptions?.length ?? 0) >= 4;
  const multipart = !isMcq && q.parts.length >= 2;

  return {
    ...base,
    type: isMcq ? "mcq" : q.type === "long_answer" ? "long_answer" : "short_answer",
    question: normalizeQuestionMathText(q.question.trim()) || "See figure.",
    passage: q.passage?.trim() ?? "",
    topic: q.topic || "",
    marks: q.marks,
    imageUrls: q.imageDataUrl ? [q.imageDataUrl] : [],
    options: isMcq ? [...(q.mcqOptions ?? ["", "", "", ""])] : base.options,
    correctAnswer: q.correctAnswer?.trim().toUpperCase().slice(0, 1) ?? "",
    multipartEnabled: multipart,
    labelDiagramEnabled: false,
    answerParts: multipart
      ? q.parts.map((p, i) => ({
          key: p.label || String.fromCharCode(97 + i),
          label: p.descriptor || p.label,
          placeholder: p.placeholder,
          marks: p.marks,
          acceptedAnswer: p.acceptedAnswer,
          imageUrl: p.imageDataUrl,
        }))
      : base.answerParts,
    acceptedAnswers: multipart
      ? ""
      : q.parts.map((p) => p.acceptedAnswer).filter(Boolean).join("\n"),
  };
}

export function CreatePdfWorkspace({
  draft,
  onDraftChange,
  initialPdfFile,
  onReimport,
}: CreatePdfWorkspaceProps) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const viewerHostRef = useRef<HTMLDivElement | null>(null);

  const [pdfName, setPdfName] = useState(draft.pdfFileName ?? "");
  const [loading, setLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState("");
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageView, setPageView] = useState<PdfPageView | null>(null);
  const [tool, setTool] = useState<PdfViewerTool>("select");
  const [crop, setCrop] = useState<CropRect>(FULL_CROP);
  const [activeQuestionId, setActiveQuestionId] = useState<string>(
    () => draft.questions[0]?.id ?? "",
  );
  /** When multipart, PDF text can target a specific part (a, b, c…). */
  const [activePartIndex, setActivePartIndex] = useState(0);
  const [pendingCrop, setPendingCrop] = useState<string | null>(null);
  const pdfDocRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const pdfFileRef = useRef<File | null>(null);

  const activeQuestion =
    draft.questions.find((q) => q.id === activeQuestionId) ?? draft.questions[0];

  const updateQuestion = (id: string, question: QuestionDraft) => {
    onDraftChange({
      ...draft,
      questions: draft.questions.map((q) => (q.id === id ? question : q)),
    });
  };

  const loadPage = useCallback(async (page: number) => {
    const doc = pdfDocRef.current;
    if (!doc) return;
    setLoading(true);
    try {
      const view = await loadPdfPageView(doc, page);
      setPageView(view);
      setPageNumber(page);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not render page.");
    } finally {
      setLoading(false);
    }
  }, []);

  const handlePdfFile = async (file: File) => {
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      toast.error("Please choose a PDF file.");
      return;
    }
    setLoading(true);
    setLoadProgress("Opening PDF…");
    try {
      const doc = await openPdfDocument(file);
      pdfDocRef.current = doc;
      pdfFileRef.current = file;
      setNumPages(doc.numPages);
      setPdfName(file.name);
      onDraftChange({ ...draft, pdfFileName: file.name });
      await loadPage(1);
      toast.success(`Loaded ${file.name} (${doc.numPages} page${doc.numPages === 1 ? "" : "s"})`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open PDF.");
    } finally {
      setLoading(false);
      setLoadProgress("");
    }
  };

  useEffect(() => {
    if (!initialPdfFile || pdfFileRef.current === initialPdfFile) return;
    void handlePdfFile(initialPdfFile);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when wizard hands off the file
  }, [initialPdfFile]);

  const scanNodentBlocks = async (file: File) => {
    setLoading(true);
    setLoadProgress("Scanning for embedded questions…");
    try {
      const { questions, errors } = await parseNodentPdfToQuestions(file, {
        onProgress: (p, total) => setLoadProgress(`Scanning page ${p} of ${total}…`),
      });
      const importable = questions;
      if (!importable.length) {
        toast.message(
          errors[0] ?? "No embedded question blocks found. Build manually from the page instead.",
        );
        return;
      }
      const mapped = importable.map(nodentQuestionToDraft);
      onDraftChange({
        ...draft,
        questions: mapped,
        pdfFileName: file.name,
      });
      setActiveQuestionId(mapped[0]!.id);
      toast.success(`Imported ${mapped.length} question(s) from PDF metadata.`);
      if (errors.length) {
        console.warn("[create-pdf]", errors);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setLoading(false);
      setLoadProgress("");
    }
  };

  useEffect(() => {
    if (!draft.questions.some((q) => q.id === activeQuestionId)) {
      setActiveQuestionId(draft.questions[0]?.id ?? "");
    }
  }, [draft.questions, activeQuestionId]);

  useEffect(() => {
    setActivePartIndex(0);
  }, [activeQuestionId, activeQuestion?.multipartEnabled]);

  const getSelection = () => getSelectedTextFromViewer(viewerHostRef.current);

  const applySelectionToQuestion = () => {
    if (!activeQuestion) return;
    const text = normalizeQuestionMathText(getSelection());
    if (!text) {
      toast.error("Select some text on the PDF first.");
      return;
    }
    updateQuestion(activeQuestion.id, {
      ...activeQuestion,
      question: appendField(activeQuestion.question, text),
    });
    toast.success("Added to question text.");
    window.getSelection()?.removeAllRanges();
  };

  const applySelectionToIntro = () => {
    const text = normalizeQuestionMathText(getSelection());
    if (!text) {
      toast.error("Select some text on the PDF first.");
      return;
    }
    onDraftChange({
      ...draft,
      sharedPassage: appendField(draft.sharedPassage, text),
    });
    toast.success("Added to intro text.");
    window.getSelection()?.removeAllRanges();
  };

  const applySelectionToPassage = () => {
    if (!activeQuestion) return;
    const text = normalizeQuestionMathText(getSelection());
    if (!text) {
      toast.error("Select some text on the PDF first.");
      return;
    }
    updateQuestion(activeQuestion.id, {
      ...activeQuestion,
      passage: appendField(activeQuestion.passage, text),
    });
    toast.success("Added to question passage.");
    window.getSelection()?.removeAllRanges();
  };

  const applySelectionToPart = (partIndex: number) => {
    if (!activeQuestion?.multipartEnabled) {
      toast.error('Turn on "Split into parts" on the question first.');
      return;
    }
    const text = normalizeQuestionMathText(getSelection());
    if (!text) {
      toast.error("Select some text on the PDF first.");
      return;
    }
    const parts = activeQuestion.answerParts.map((p, i) =>
      i === partIndex ? { ...p, label: appendField(p.label, text) } : p,
    );
    updateQuestion(activeQuestion.id, { ...activeQuestion, answerParts: parts });
    toast.success(`Added to part ${String.fromCharCode(97 + partIndex)}.`);
    window.getSelection()?.removeAllRanges();
  };

  const applyCropTarget = async (target: CropAssignTarget) => {
    if (!activeQuestion || !pendingCrop) return;
    try {
      const compressed = await compressDataUrlIfLarge(pendingCrop);
      let next: QuestionDraft = { ...activeQuestion };

      if (target.kind === "stimulus") {
        const rest = next.imageUrls.slice(1);
        next = {
          ...next,
          imageUrls: [compressed, ...rest].slice(0, 6),
          labelDiagramEnabled: false,
        };
      } else {
        const idx = target.partIndex;
        const parts = [...next.answerParts];
        while (parts.length <= idx) {
          const letter = String.fromCharCode(97 + parts.length);
          parts.push({
            key: letter,
            label: `${letter})`,
            marks: 1,
            placeholder: "",
            acceptedAnswer: "",
          });
        }
        parts[idx] = { ...parts[idx]!, imageUrl: compressed };
        next = {
          ...next,
          type: next.type === "mcq" ? "short_answer" : next.type,
          multipartEnabled: true,
          labelDiagramEnabled: false,
          answerParts: parts.length >= 2 ? parts : emptyMultipartParts(2).map((p, i) => parts[i] ?? p),
        };
      }

      updateQuestion(activeQuestion.id, next);
      setPendingCrop(null);
      setTool("select");
      setCrop(FULL_CROP);
      toast.success(`Assigned to ${cropTargetLabel(target).toLowerCase()}.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not assign crop.");
    }
  };

  const handleApplyCrop = (cropped: string) => {
    setPendingCrop(cropped);
  };

  const addQuestionFromPage = () => {
    const q = createEmptyQuestionDraft();
    q.question = `Question from page ${pageNumber}`;
    q.type = "short_answer";
    onDraftChange({ ...draft, questions: [...draft.questions, q] });
    setActiveQuestionId(q.id);
    toast.success("New question created.");
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-black/8 bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
        Use the question tabs on the right. For multi-box answers, open a part and choose{" "}
        <strong className="text-foreground">Add multiple input boxes (horizontal row)</strong>.
      </div>
      {/* PDF toolbar */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-black/8 bg-white p-3 shadow-sm">
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handlePdfFile(file);
            e.currentTarget.value = "";
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="gap-1.5"
          disabled={loading}
          onClick={() => fileRef.current?.click()}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : <FileUp className="size-4" />}
          {pdfName ? "Change PDF" : "Upload PDF"}
        </Button>
        {onReimport ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={onReimport}
          >
            Import PDF
          </Button>
        ) : null}
        {pdfName ? (
          <span className="max-w-[12rem] truncate text-xs text-muted-foreground sm:max-w-xs">
            {pdfName}
          </span>
        ) : null}
        {numPages > 0 ? (
          <>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={pageNumber <= 1 || loading}
                onClick={() => void loadPage(pageNumber - 1)}
              >
                <ChevronLeft className="size-4" />
              </Button>
              <span className="min-w-[5rem] text-center text-xs tabular-nums text-muted-foreground">
                Page {pageNumber} / {numPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 w-8 p-0"
                disabled={pageNumber >= numPages || loading}
                onClick={() => void loadPage(pageNumber + 1)}
              >
                <ChevronRight className="size-4" />
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="gap-1 text-xs"
              disabled={loading || !pdfFileRef.current}
              onClick={() => {
                const file = pdfFileRef.current;
                if (!file) {
                  toast.error("Upload a PDF first.");
                  return;
                }
                void scanNodentBlocks(file);
              }}
            >
              <Sparkles className="size-3.5" />
              Auto-detect questions
            </Button>
          </>
        ) : null}
        {loadProgress ? (
          <span className="text-xs text-muted-foreground">{loadProgress}</span>
        ) : null}
      </div>

      {!pageView ? (
        <div className="flex min-h-[420px] flex-col items-center justify-center rounded-2xl border border-dashed border-black/15 bg-[#fafbfc] p-8 text-center">
          <FileUp className="mb-3 size-10 text-muted-foreground/60" />
          <p className="font-medium text-[#0b0f19]">Upload a PDF to start building</p>
          <p className="mt-1 max-w-md text-sm text-muted-foreground">
            Select text and figures from exam papers, worksheets, or NODENT-tagged PDFs. Your
            questions appear in the panel on the right.
          </p>
          <Button
            type="button"
            className="mt-4 gap-2"
            onClick={() => fileRef.current?.click()}
          >
            <FileUp className="size-4" />
            Choose PDF
          </Button>
        </div>
      ) : (
        <div className="grid h-[calc(100dvh-14rem)] min-h-[520px] grid-cols-1 gap-4 overflow-hidden md:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] md:grid-rows-1">
          {/* PDF pane — left */}
          <div
            ref={viewerHostRef}
            className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm md:min-h-0"
          >
            <div className="shrink-0 space-y-2 border-b border-black/6 p-3">
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={applySelectionToQuestion}>
                  <Type className="size-3.5" />
                  → Main question
                </Button>
                <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={applySelectionToIntro}>
                  <BookText className="size-3.5" />
                  → Intro
                </Button>
                <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={applySelectionToPassage}>
                  <BookText className="size-3.5" />
                  → Passage
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={tool === "crop" ? "secondary" : "outline"}
                  className="gap-1.5"
                  onClick={() => setTool("crop")}
                >
                  <ImagePlus className="size-3.5" />
                  Select region
                </Button>
              </div>
              {pendingCrop ? (
                <CropAssignPanel
                  imageDataUrl={pendingCrop}
                  multipartEnabled={Boolean(activeQuestion?.multipartEnabled)}
                  partCount={activeQuestion?.answerParts.length ?? 2}
                  onAssign={(target) => void applyCropTarget(target)}
                  onCancel={() => {
                    setPendingCrop(null);
                    setTool("select");
                  }}
                />
              ) : null}
              {activeQuestion?.multipartEnabled && activeQuestion.answerParts.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    Part text:
                  </span>
                  {activeQuestion.answerParts.map((part, idx) => {
                    const letter = part.key?.trim() || String.fromCharCode(97 + idx);
                    return (
                      <button
                        key={`${letter}-${idx}`}
                        type="button"
                        onClick={() => setActivePartIndex(idx)}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-xs font-semibold transition-colors",
                          activePartIndex === idx
                            ? "bg-brand/15 text-brand"
                            : "bg-black/[0.04] text-muted-foreground hover:bg-black/[0.08]",
                        )}
                      >
                        {letter})
                      </button>
                    );
                  })}
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-7 gap-1 text-xs"
                    onClick={() => applySelectionToPart(activePartIndex)}
                  >
                    <Type className="size-3 h-3" />
                    → Part {String.fromCharCode(97 + activePartIndex)}
                  </Button>
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  For a/b/c parts: open the question on the right →{" "}
                  <strong className="font-medium text-foreground">Split into parts</strong>, then use Part
                  text buttons above.
                </p>
              )}
            </div>
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-3 pt-0">
              <CreatePdfPageViewer
                page={pageView}
                tool={pendingCrop ? "select" : tool}
                onToolChange={setTool}
                crop={crop}
                onCropChange={setCrop}
                onApplyCrop={handleApplyCrop}
                onCancelCrop={() => {
                  setTool("select");
                  setPendingCrop(null);
                }}
              />
            </div>
          </div>

          {/* Questions pane */}
          <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-black/8 bg-white shadow-sm">
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-black/6 px-3 py-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                Questions from PDF
              </Label>
              <Button type="button" size="sm" variant="secondary" className="gap-1.5" onClick={addQuestionFromPage}>
                <Plus className="size-3.5" />
                New question
              </Button>
            </div>

            <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-black/6 px-2 py-2">
              {draft.questions.map((q, i) => (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setActiveQuestionId(q.id)}
                  className={cn(
                    "shrink-0 rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    q.id === activeQuestionId
                      ? "bg-[#0b0f19] text-white"
                      : "bg-black/[0.04] text-muted-foreground hover:bg-black/[0.08]",
                  )}
                >
                  Q{i + 1}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {activeQuestion ? (
                <CreatePdfQuestionPanel
                  draft={activeQuestion}
                  index={draft.questions.findIndex((q) => q.id === activeQuestion.id)}
                  onChange={(next) => updateQuestion(activeQuestion.id, next)}
                />
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
