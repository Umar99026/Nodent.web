import type { InlineInputBox } from "@/lib/diagramLabels";
import { QuizAnswerField } from "@/components/quiz/QuizAnswerField";
import { useHandwritingModeActive } from "@/context/HandwritingModeContext";
import { cn } from "@/lib/utils";

export type HorizontalInputFieldsProps = {
  boxes: InlineInputBox[];
  values?: string[];
  onChange?: (index: number, value: string) => void;
  disabled?: boolean;
  submitted?: boolean;
  partResults?: (boolean | null)[];
  subjectId?: string;
  examPaperMode?: boolean;
};

function unitPrefix(unit: string): boolean {
  return unit === "$" || unit === "%";
}

export function HorizontalInputFields({
  boxes,
  values = [],
  onChange,
  disabled = false,
  submitted = false,
  partResults = [],
  subjectId,
  examPaperMode = false,
}: HorizontalInputFieldsProps) {
  const handwritingMode = useHandwritingModeActive(subjectId);

  if (!boxes.length) return null;

  if (handwritingMode) {
    return (
      <div className="grid gap-4 sm:grid-cols-2">
        {boxes.map((box, index) => {
          const result = partResults[index];
          const showResult = submitted && result != null;
          return (
            <QuizAnswerField
              key={`${box.key}-${index}`}
              value={values[index] ?? ""}
              onChange={(value) => onChange?.(index, value)}
              disabled={disabled}
              label={box.label?.trim() || `Answer ${index + 1}`}
              handwritingSize="md"
              subjectId={subjectId}
              examPaperMode={examPaperMode}
              className={cn(
                showResult && result === true && "border-success/60",
                showResult && result === false && "border-danger/60",
              )}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-wrap items-end gap-3", examPaperMode && "w-full flex-col")}>
      {boxes.map((box, index) => {
        const result = partResults[index];
        const showResult = submitted && result != null;
        const unit = box.unit?.trim() ?? "";
        const prefix = unit && unitPrefix(unit);
        return (
          <div
            key={`${box.key}-${index}`}
            className={cn("flex flex-col gap-1", examPaperMode ? "w-full min-w-0" : "min-w-[5rem]")}
          >
            {box.label?.trim() ? (
              <span className="text-[11px] font-medium text-muted-foreground">{box.label}</span>
            ) : null}
            <div className={cn("flex items-stretch", examPaperMode && "w-full")}>
              {prefix ? (
                <span className="inline-flex items-center rounded-l-md border border-r-0 border-black/15 bg-muted px-2 text-xs font-semibold text-muted-foreground">
                  {unit}
                </span>
              ) : null}
              <QuizAnswerField
                value={values[index] ?? ""}
                onChange={(value) => onChange?.(index, value)}
                placeholder={examPaperMode ? undefined : box.placeholder?.trim() || "…"}
                disabled={disabled}
                subjectId={subjectId}
                examPaperMode={examPaperMode}
                multiline={examPaperMode}
                rows={examPaperMode ? 2 : 1}
                className={cn(
                  !examPaperMode && prefix && "rounded-l-none",
                  !examPaperMode && !prefix && unit && "rounded-r-none",
                  !examPaperMode && "min-w-[4.5rem] max-w-[10rem] bg-white/60 text-base",
                  examPaperMode && "w-full min-w-0 flex-1",
                  !examPaperMode && prefix && "flex-1",
                  showResult && result === true && !examPaperMode && "border-success/60 bg-success/5",
                  showResult && result === false && !examPaperMode && "border-danger/60 bg-danger/5",
                )}
              />
              {!prefix && unit ? (
                <span className="inline-flex items-center rounded-r-md border border-l-0 border-black/15 bg-muted px-2 text-xs font-semibold text-muted-foreground">
                  {unit}
                </span>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}
