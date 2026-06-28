import { useEffect, useMemo, useState } from "react";
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
import { PdfPageCropEditor } from "@/components/admin/PdfPageCropEditor";
import { PracticeExamMcqCard } from "@/components/quiz/PracticeExamMcqCard";
import {
  buildMcqRows,
  mergeParsedMcqTsv,
  normalizeMcqLetter,
  parseMcqTsv,
} from "@/lib/practiceExamImport";
import { mcqItemHasCrop, mcqItemHasText } from "@/lib/practiceExamMcq";
import { FULL_CROP, type CropRect } from "@/lib/pdfImageCrop";
import type { PracticeExamMcqItem, PracticeExamPage } from "@/lib/practiceExamTypes";
import { MCQ_OPTION_LETTERS } from "@/lib/practiceExamTypes";
import { resolveQuestionImageSrc } from "@/lib/practiceQuestions";
import { cn } from "@/lib/utils";
import { Crop, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  mcqCount: number;
  defaultMcqCount: number;
  items: PracticeExamMcqItem[];
  pages: PracticeExamPage[];
  selectedId: string | null;
  onSelectId: (id: string) => void;
  onChangeItems: (items: PracticeExamMcqItem[]) => void;
  onMcqCountChange: (count: number) => void;
};

function updateItem(
  items: PracticeExamMcqItem[],
  id: string,
  patch: Partial<PracticeExamMcqItem>,
): PracticeExamMcqItem[] {
  return items.map((item) => (item.id === id ? { ...item, ...patch } : item));
}

export function AdminPracticeExamMcqEditor({
  mcqCount,
  defaultMcqCount: defaultCount,
  items,
  pages,
  selectedId,
  onSelectId,
  onChangeItems,
  onMcqCountChange,
}: Props) {
  const [pasteMcqText, setPasteMcqText] = useState("");
  const rows = useMemo(() => buildMcqRows(mcqCount, items), [mcqCount, items]);
  const selected = rows.find((item) => item.id === selectedId) ?? rows[0] ?? null;

  const [cropOpen, setCropOpen] = useState(false);
  const [cropDraft, setCropDraft] = useState<CropRect>(FULL_CROP);
  const [cropBusy, setCropBusy] = useState(false);

  const sourcePage =
    pages.find((p) => p.pageNumber === (selected?.pageNumber ?? pages[0]?.pageNumber)) ??
    pages[0] ??
    null;

  useEffect(() => {
    if (!selected && rows[0]) onSelectId(rows[0].id);
  }, [selected, rows, onSelectId]);

  const patchSelected = (patch: Partial<PracticeExamMcqItem>) => {
    if (!selected) return;
    onChangeItems(updateItem(items, selected.id, patch));
  };

  const handleParseMcqTsv = () => {
    const parsed = parseMcqTsv(pasteMcqText);
    if (!parsed.length) {
      toast.error(
        "Couldn't parse MCQ TSV. Use: q, question, option_a, option_b, option_c, option_d, answer, marks.",
      );
      return;
    }
    const count = Math.max(
      mcqCount || defaultCount,
      ...parsed.map((item) => item.questionNumber),
    );
    if (count !== mcqCount) onMcqCountChange(count);
    const merged = mergeParsedMcqTsv(items, parsed);
    const base = buildMcqRows(count, merged);
    onChangeItems(base);
    if (!selectedId && base[0]) onSelectId(base[0].id);
    toast.success(`Loaded ${parsed.length} MCQ(s). Pick each question and crop any figures.`);
  };

  const handleApplyCrop = async (croppedDataUrl: string) => {
    if (!selected || !sourcePage) return;
    setCropBusy(true);
    try {
      patchSelected({
        pageNumber: sourcePage.pageNumber,
        stimulusImageUrl: croppedDataUrl,
        stimulusCrop: cropDraft,
        showStimulus: true,
      });
      setCropOpen(false);
    } finally {
      setCropBusy(false);
    }
  };

  const handleClearCrop = () => {
    patchSelected({
      stimulusImageUrl: undefined,
      stimulusCrop: undefined,
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2 rounded-xl border border-black/10 bg-[#fafbfc] p-3">
        <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          MCQ TSV
        </Label>
        <Textarea
          value={pasteMcqText}
          onChange={(e) => setPasteMcqText(e.target.value)}
          placeholder={
            "q\tquestion\toption_a\toption_b\toption_c\toption_d\tanswer\tmarks\n" +
            "1\tFind the derivative of $x^2$.\t$x$\t$2x$\t$x^2$\t$2x^2$\tB\t1"
          }
          rows={7}
          className="font-mono text-xs"
        />
        <p className="text-[11px] text-muted-foreground">
          Paste all MCQs here. Nodent formats the text and options. Then select each question below
          and crop any diagram from the exam PDF.
        </p>
        <Button type="button" variant="secondary" size="sm" onClick={handleParseMcqTsv}>
          Load MCQs from TSV
        </Button>
      </div>

      {!pages.length ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Upload the <span className="font-medium">Exam PDF</span> above to crop images per question.
          You can paste and load MCQ TSV now.
        </p>
      ) : null}

      {!rows.length ? (
        <p className="text-sm text-muted-foreground">Load MCQs from TSV to start.</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
          <aside className="max-h-[70vh] space-y-1 overflow-y-auto rounded-xl border border-black/10 bg-[#fafbfc] p-2">
            <p className="px-1 pb-1 text-[11px] text-muted-foreground">
              Select a question → pick page → crop figure if needed.
            </p>
            {rows.map((item) => {
              const hasText = mcqItemHasText(item);
              const hasCrop = mcqItemHasCrop(item);
              const answerLetter = normalizeMcqLetter(item.acceptedAnswer);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectId(item.id)}
                  className={cn(
                    "flex w-full flex-col gap-1.5 rounded-lg border px-2 py-2 text-left text-xs",
                    selected?.id === item.id
                      ? "border-brand bg-brand/10"
                      : !hasText
                        ? "border-amber-400/60 bg-amber-50/50"
                        : "border-black/10 bg-white hover:bg-black/[0.02]",
                  )}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span className="font-medium">Q{item.questionNumber}</span>
                    <span className="flex gap-1">
                      {hasCrop ? (
                        <span className="rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                          img
                        </span>
                      ) : null}
                      <span
                        className={cn(
                          "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                          hasText ? "bg-success/15 text-success" : "bg-amber-100 text-amber-800",
                        )}
                      >
                        {hasText ? "ok" : "?"}
                      </span>
                    </span>
                  </div>
                  <div className="flex gap-1">
                    {MCQ_OPTION_LETTERS.map((letter) => (
                      <span
                        key={letter}
                        className={cn(
                          "flex-1 rounded border py-0.5 text-center text-[10px] font-bold",
                          answerLetter === letter
                            ? "border-success bg-success text-white"
                            : "border-black/10 bg-white text-muted-foreground",
                        )}
                      >
                        {letter}
                      </span>
                    ))}
                  </div>
                  {item.pageNumber ? (
                    <span className="text-[10px] text-muted-foreground">p.{item.pageNumber}</span>
                  ) : null}
                </button>
              );
            })}
          </aside>

          {selected ? (
            <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Page for crop</Label>
                  <Select
                    value={String(selected.pageNumber ?? sourcePage?.pageNumber ?? "")}
                    onValueChange={(v) => patchSelected({ pageNumber: Number(v) })}
                    disabled={!pages.length}
                  >
                    <SelectTrigger className="h-8 w-36 text-xs">
                      <SelectValue placeholder="Page" />
                    </SelectTrigger>
                    <SelectContent>
                      {pages.map((page) => (
                        <SelectItem key={page.pageNumber} value={String(page.pageNumber)}>
                          Page {page.pageNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={cropOpen ? "accent" : "outline"}
                    className="gap-1.5"
                    disabled={!sourcePage}
                    onClick={() => {
                      setCropDraft(selected.stimulusCrop ?? FULL_CROP);
                      setCropOpen(true);
                    }}
                  >
                    <Crop className="size-3.5" />
                    {selected.stimulusImageUrl ? "Re-crop image" : "Crop image"}
                  </Button>
                  {selected.stimulusImageUrl ? (
                    <Button type="button" size="sm" variant="ghost" onClick={handleClearCrop}>
                      Remove image
                    </Button>
                  ) : null}
                </div>
              </div>

              {sourcePage && cropOpen ? (
                <div className="rounded-xl border border-brand/30 bg-white p-2">
                  <p className="px-2 pb-2 text-xs text-muted-foreground">
                    Q{selected.questionNumber} — drag on page {sourcePage.pageNumber} to crop.
                  </p>
                  <PdfPageCropEditor
                    imageDataUrl={sourcePage.imageDataUrl}
                    crop={cropDraft}
                    onCropChange={setCropDraft}
                    onApply={handleApplyCrop}
                    onCancel={() => setCropOpen(false)}
                  />
                  {cropBusy ? (
                    <p className="flex items-center gap-2 px-2 py-1 text-xs text-muted-foreground">
                      <Loader2 className="size-3 animate-spin" />
                      Saving crop…
                    </p>
                  ) : null}
                </div>
              ) : sourcePage ? (
                <div className="overflow-hidden rounded-xl border border-black/10 bg-[#f3f4f6]">
                  <img
                    src={resolveQuestionImageSrc(sourcePage.imageDataUrl)}
                    alt={`Page ${sourcePage.pageNumber}`}
                    className="max-h-56 w-full object-contain"
                  />
                </div>
              ) : null}

              {selected.stimulusImageUrl && !cropOpen ? (
                <div className="overflow-hidden rounded-xl border border-black/10">
                  <img
                    src={resolveQuestionImageSrc(selected.stimulusImageUrl)}
                    alt={`Question ${selected.questionNumber} figure`}
                    className="max-h-48 w-full object-contain bg-white"
                  />
                </div>
              ) : null}

              <div className="rounded-xl border border-dashed border-black/15 bg-[#fafbfc] p-4">
                <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Preview
                </p>
                <PracticeExamMcqCard item={selected} showAnswerKey />
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
