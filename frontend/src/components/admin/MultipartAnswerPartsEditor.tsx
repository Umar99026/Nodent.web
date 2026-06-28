import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Plus, Trash2 } from "lucide-react";

import { overlayToPayload, type DiagramLabelPart, type InlineInputBox } from "@/lib/diagramLabels";
import { splitAnswerValueAndUnit } from "@/lib/utils";

export type MultipartPartDraft = {
  key: string;
  label: string;
  placeholder?: string;
  marks?: number;
  imageUrl?: string;
  acceptedAnswer?: string;
  overlayX?: number;
  overlayY?: number;
  overlayW?: number;
  overlayH?: number;
  /** Input boxes placed on this part's figure image (legacy). */
  labelOverlays?: DiagramLabelPart[];
  inlineInputs?: InlineInputBox[];
};

type MultipartAnswerPartsEditorProps = {
  parts: MultipartPartDraft[];
  onChange: (parts: MultipartPartDraft[]) => void;
  onUploadPartImage?: (file: File, partIndex: number) => Promise<void>;
  uploadingPartIndex?: number | null;
};

function defaultPart(index: number): MultipartPartDraft {
  const letter = String.fromCharCode(97 + index);
  return {
    key: letter,
    label: `${letter})`,
    marks: 1,
    placeholder: "",
    acceptedAnswer: "",
  };
}

export function emptyMultipartParts(count = 2): MultipartPartDraft[] {
  return Array.from({ length: count }, (_, i) => defaultPart(i));
}

export function buildAnswerPartsPayload(parts: MultipartPartDraft[]) {
  return parts.map((p, idx) => ({
    key: p.key.trim() || `part${idx + 1}`,
    label: p.label.trim(),
    ...(p.placeholder?.trim() ? { placeholder: p.placeholder.trim() } : {}),
    ...(typeof p.marks === "number" && p.marks > 0 ? { marks: p.marks } : {}),
    ...(p.imageUrl?.trim() ? { imageUrl: p.imageUrl.trim() } : {}),
    ...(overlayToPayload(p) ?? {}),
    ...(p.inlineInputs?.length
      ? {
          inlineInputs: p.inlineInputs.map((box, boxIdx) => {
            const raw = box.acceptedAnswer?.trim() ?? "";
            const { value, unit } = splitAnswerValueAndUnit(raw);
            const storedUnit = box.unit?.trim() || unit;
            return {
              key: box.key?.trim() || String(boxIdx + 1),
              label: box.label?.trim() || String(boxIdx + 1),
              ...(box.placeholder?.trim() ? { placeholder: box.placeholder.trim() } : {}),
              ...(typeof box.marks === "number" && box.marks > 0 ? { marks: box.marks } : {}),
              ...(value ? { acceptedAnswer: value } : {}),
              ...(storedUnit ? { unit: storedUnit } : {}),
            };
          }),
        }
      : {}),
    ...(p.labelOverlays?.length
      ? {
          labelOverlays: p.labelOverlays.map((overlay, overlayIdx) => ({
            key: overlay.key?.trim() || String(overlayIdx + 1),
            label: overlay.label?.trim() || String(overlayIdx + 1),
            ...(overlay.placeholder?.trim() ? { placeholder: overlay.placeholder.trim() } : {}),
            ...(typeof overlay.marks === "number" && overlay.marks > 0
              ? { marks: overlay.marks }
              : {}),
            ...(overlay.acceptedAnswer?.trim()
              ? { acceptedAnswer: overlay.acceptedAnswer.trim() }
              : {}),
            ...(overlayToPayload(overlay) ?? {}),
          })),
        }
      : {}),
  }));
}

export function mergePartsWithAcceptedAnswers(
  parts: Array<Omit<MultipartPartDraft, "acceptedAnswer">>,
  accepted?: string[],
): MultipartPartDraft[] {
  return parts.map((p, i) => ({
    ...p,
    acceptedAnswer: accepted?.[i]?.trim() ?? "",
  }));
}

export function MultipartAnswerPartsEditor({
  parts,
  onChange,
  onUploadPartImage,
  uploadingPartIndex = null,
}: MultipartAnswerPartsEditorProps) {
  const updatePart = (index: number, patch: Partial<MultipartPartDraft>) => {
    onChange(parts.map((p, i) => (i === index ? { ...p, ...patch } : p)));
  };

  const removePart = (index: number) => {
    if (parts.length <= 2) return;
    onChange(parts.filter((_, i) => i !== index));
  };

  const addPart = () => {
    onChange([...parts, defaultPart(parts.length)]);
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Each part gets its own answer box in practice. Put shared stimulus (diagrams, data) in
        Question Images / Passage above; use part images for figures tied to one sub-question.
      </p>
      {parts.map((part, idx) => (
        <div
          key={`${part.key}-${idx}`}
          className="space-y-2 rounded-lg border border-black/10 bg-white/60 p-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Part {idx + 1}
            </p>
            {parts.length > 2 ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-danger hover:text-danger"
                onClick={() => removePart(idx)}
              >
                <Trash2 className="size-3.5" />
                Remove
              </Button>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Part label</Label>
              <Input
                className="h-8"
                placeholder="e.g. a) Find the median"
                value={part.label}
                onChange={(e) => updatePart(idx, { label: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Marks</Label>
              <Input
                type="number"
                min={1}
                max={10}
                className="h-8"
                value={part.marks ?? 1}
                onChange={(e) =>
                  updatePart(idx, { marks: Math.max(1, Number(e.target.value) || 1) })
                }
              />
            </div>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="space-y-1">
              <Label className="text-xs">Input placeholder</Label>
              <Input
                className="h-8"
                placeholder="e.g. Enter a number"
                value={part.placeholder ?? ""}
                onChange={(e) => updatePart(idx, { placeholder: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Accepted answer</Label>
              <Input
                className="h-8"
                placeholder="Exact answer for auto-marking"
                value={part.acceptedAnswer ?? ""}
                onChange={(e) => updatePart(idx, { acceptedAnswer: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Part figure (optional)</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                className="h-8 min-w-[12rem] flex-1"
                placeholder="Image URL or drop a file →"
                value={part.imageUrl ?? ""}
                onChange={(e) => updatePart(idx, { imageUrl: e.target.value })}
              />
              {onUploadPartImage ? (
                <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-black/10 bg-white px-2 py-1 text-xs font-medium hover:bg-muted/50">
                  {uploadingPartIndex === idx ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    "Upload"
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingPartIndex != null}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void onUploadPartImage(file, idx);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              ) : null}
            </div>
            {part.imageUrl?.trim() ? (
              <img
                src={part.imageUrl}
                alt={`Part ${idx + 1} figure`}
                className="mt-1 max-h-32 rounded-md border border-black/10 object-contain"
              />
            ) : null}
          </div>
        </div>
      ))}
      <Button type="button" variant="secondary" size="sm" className="gap-1" onClick={addPart}>
        <Plus className="size-3.5" />
        Add part
      </Button>
    </div>
  );
}
