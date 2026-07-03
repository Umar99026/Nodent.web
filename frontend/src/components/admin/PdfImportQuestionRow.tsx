import { ImagePlus } from "lucide-react";
import { RichQuestionContent } from "@/components/quiz/RichQuestionContent";
import { Button } from "@/components/ui/button";
import type { ExamImportPart, ExamImportRow } from "@/lib/examPdfImport";
import { studentFacingPartText } from "@/lib/questionDisplay";
import { cn } from "@/lib/utils";

type CropTarget =
  | { kind: "row"; rowId: string }
  | { kind: "part"; rowId: string; partKey: string };

type PdfImportQuestionRowProps = {
  row: ExamImportRow;
  rowLabel: string;
  incomplete?: boolean;
  parseSource: "nodent" | "generic" | null;
  cropTarget: CropTarget | null;
  onToggleSelected: (selected: boolean) => void;
  onPickFigure: (target: CropTarget) => void;
};

function isTargetActive(cropTarget: CropTarget | null, target: CropTarget): boolean {
  if (!cropTarget) return false;
  if (cropTarget.kind !== target.kind) return false;
  if (cropTarget.rowId !== target.rowId) return false;
  if (target.kind === "part" && cropTarget.kind === "part") {
    return cropTarget.partKey.trim().toLowerCase() === target.partKey.trim().toLowerCase();
  }
  return target.kind === "row";
}

function partPrompt(part: ExamImportPart): string {
  const text = studentFacingPartText(part.descriptor?.trim() || "");
  if (text) return text;
  return `Part ${part.key}`;
}

export function PdfImportQuestionRow({
  row,
  rowLabel,
  incomplete,
  parseSource,
  cropTarget,
  onToggleSelected,
  onPickFigure,
}: PdfImportQuestionRowProps) {
  const stem = row.question.trim();
  const writtenParts = row.type !== "mcq" ? row.parts : [];
  const hasAnswers =
    row.type === "mcq"
      ? Boolean(row.correctAnswer.trim())
      : writtenParts.some((p) => p.acceptedAnswer.trim());

  return (
    <article
      className={cn(
        "rounded-xl border bg-white p-4 shadow-sm",
        row.selected ? "border-brand/30" : "border-black/10 opacity-90",
        incomplete && "border-amber-300/80",
        cropTarget?.rowId === row.id && "ring-2 ring-brand/20",
      )}
    >
      <div className="flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-1"
          checked={row.selected}
          onChange={(e) => onToggleSelected(e.target.checked)}
        />
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-[#0b0f19]">
            {rowLabel}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              {row.marks} mark{row.marks === 1 ? "" : "s"}
              {row.type === "mcq" ? " · MCQ" : writtenParts.length ? ` · ${writtenParts.length} part(s)` : ""}
            </span>
            {parseSource === "nodent" && row.fromNodent ? (
              <span className="ml-1 text-[10px] text-brand">NODENT</span>
            ) : null}
          </p>
          {row.examSection ? (
            <p className="mt-0.5 text-xs text-muted-foreground">{row.examSection}</p>
          ) : null}
          {!hasAnswers && !stem && writtenParts.length === 0 ? (
            <p className="mt-1 text-[11px] text-amber-700">
              No TSV rows yet — add stem + part rows for question {row.questionNumber ?? "?"} in the
              spreadsheet above
            </p>
          ) : !hasAnswers ? (
            <p className="mt-1 text-[11px] text-amber-700">No TSV answers matched yet</p>
          ) : null}
        </div>
      </div>

      {row.type === "mcq" ? (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-lg border border-black/8 bg-[#fafbfc] p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Question
            </p>
            {stem ? (
              <RichQuestionContent
                text={stem.slice(0, 1200)}
                className="prose prose-sm max-w-none text-[#0b0f19]"
              />
            ) : (
              <p className="text-sm italic text-muted-foreground">See figure.</p>
            )}
          </div>
          <div className="rounded-lg border border-black/8 bg-[#fafbfc] p-3">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Answer
            </p>
            <p className="font-mono text-sm text-emerald-900">
              {row.correctAnswer.trim() || "—"}
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {stem ? (
            <section className="rounded-lg border border-black/8 bg-[#fafbfc] p-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                Stimulus
              </p>
              <RichQuestionContent
                text={stem.slice(0, 2000)}
                className="prose prose-sm max-w-none text-[#0b0f19]"
              />
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-black/6 pt-3">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={cn(
                    "h-8 gap-1.5 text-xs",
                    isTargetActive(cropTarget, { kind: "row", rowId: row.id }) &&
                      "border-brand bg-brand/5",
                  )}
                  onClick={() => onPickFigure({ kind: "row", rowId: row.id })}
                >
                  <ImagePlus className="size-3.5" />
                  Pick figure for stimulus
                </Button>
                {row.imageDataUrl ? (
                  <img
                    src={row.imageDataUrl}
                    alt=""
                    className="h-14 max-w-[8rem] rounded-md border border-black/10 object-contain"
                  />
                ) : null}
              </div>
            </section>
          ) : null}

          {writtenParts.length ? (
            writtenParts.map((part) => (
              <section
                key={part.key}
                className="grid gap-3 rounded-lg border border-black/10 bg-white p-3 md:grid-cols-2"
              >
                <div className="min-w-0">
                  <p className="mb-2 text-xs font-semibold text-[#0b0f19]">
                    Part {part.key}
                    <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                      {part.marks} mark{part.marks === 1 ? "" : "s"}
                    </span>
                  </p>
                  <RichQuestionContent
                    text={partPrompt(part).slice(0, 1200)}
                    className="prose prose-sm max-w-none text-[#0b0f19]"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className={cn(
                        "h-7 gap-1 text-[11px]",
                        isTargetActive(cropTarget, {
                          kind: "part",
                          rowId: row.id,
                          partKey: part.key,
                        }) && "border-brand bg-brand/5",
                      )}
                      onClick={() =>
                        onPickFigure({ kind: "part", rowId: row.id, partKey: part.key })
                      }
                    >
                      <ImagePlus className="size-3" />
                      Pick figure
                    </Button>
                    {part.imageDataUrl ? (
                      <img
                        src={part.imageDataUrl}
                        alt=""
                        className="h-10 max-w-[5rem] rounded border border-black/10 object-contain"
                      />
                    ) : null}
                  </div>
                </div>
                <div className="min-w-0 rounded-md border border-emerald-100 bg-emerald-50/40 p-3">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-900/70">
                    Answer
                  </p>
                  <p className="font-mono text-sm text-emerald-900">
                    {part.acceptedAnswer.trim() || "—"}
                  </p>
                </div>
              </section>
            ))
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-black/8 bg-[#fafbfc] p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Question
                </p>
                <p className="text-sm italic text-muted-foreground">See figure.</p>
              </div>
              <div className="rounded-lg border border-black/8 bg-[#fafbfc] p-3">
                <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Answer
                </p>
                <p className="font-mono text-sm text-emerald-900">
                  {row.parts[0]?.acceptedAnswer.trim() || "—"}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {row.type === "mcq" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "h-8 gap-1.5 text-xs",
              isTargetActive(cropTarget, { kind: "row", rowId: row.id }) && "border-brand bg-brand/5",
            )}
            onClick={() => onPickFigure({ kind: "row", rowId: row.id })}
          >
            <ImagePlus className="size-3.5" />
            Pick figure from PDF
          </Button>
          {row.imageDataUrl ? (
            <img
              src={row.imageDataUrl}
              alt=""
              className="h-14 max-w-[8rem] rounded-md border border-black/10 object-contain"
            />
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
