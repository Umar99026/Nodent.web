import { Button } from "@/components/ui/button";
import { cropTargetLabel, type CropAssignTarget } from "@/lib/createPdfCropAssign";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

type CropAssignPanelProps = {
  imageDataUrl: string;
  multipartEnabled: boolean;
  partCount: number;
  onAssign: (target: CropAssignTarget) => void;
  onCancel: () => void;
};

export function CropAssignPanel({
  imageDataUrl,
  multipartEnabled,
  partCount,
  onAssign,
  onCancel,
}: CropAssignPanelProps) {
  const partTargets: CropAssignTarget[] = Array.from(
    { length: Math.max(multipartEnabled ? partCount : 3, 3) },
    (_, i) => ({
      kind: "part-figure" as const,
      partIndex: i,
    }),
  );

  const options: CropAssignTarget[] = [{ kind: "stimulus" }, ...partTargets];

  return (
    <div className="rounded-xl border border-brand/30 bg-brand/5 p-4 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[#0b0f19]">Assign cropped region</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Choose where this figure appears in the question on the right.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full p-1 text-muted-foreground hover:bg-black/5 hover:text-foreground"
          aria-label="Cancel"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mb-4 overflow-hidden rounded-lg border border-black/10 bg-white">
        <img
          src={imageDataUrl}
          alt="Cropped preview"
          className="max-h-48 w-full object-contain"
        />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((target) => {
          const letter =
            target.kind === "part-figure"
              ? String.fromCharCode(97 + target.partIndex)
              : undefined;
          const label = cropTargetLabel(target, letter);
          const hint =
            target.kind === "stimulus"
              ? "Main figure shown with the question"
              : `Figure above part ${letter}) answer`;

          return (
            <button
              key={`${target.kind}-${target.kind === "part-figure" ? target.partIndex : ""}`}
              type="button"
              onClick={() => onAssign(target)}
              className={cn(
                "flex flex-col items-start rounded-lg border border-black/10 bg-white px-3 py-2.5 text-left transition-colors hover:border-brand/40 hover:bg-brand/5",
              )}
            >
              <span className="text-sm font-medium text-[#0b0f19]">{label}</span>
              <span className="mt-0.5 text-[11px] text-muted-foreground">{hint}</span>
            </button>
          );
        })}
      </div>

      <Button type="button" variant="ghost" size="sm" className="mt-3 w-full" onClick={onCancel}>
        Cancel crop
      </Button>
    </div>
  );
}
