import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { HorizontalInputFields } from "@/components/quiz/HorizontalInputFields";
import { createInlineInputBox, type InlineInputBox } from "@/lib/diagramLabels";
import { normalizeAcceptedAnswerForStorage, splitAnswerValueAndUnit } from "@/lib/utils";

type InlineInputsEditorProps = {
  inputs: InlineInputBox[];
  onChange: (inputs: InlineInputBox[]) => void;
};

export function InlineInputsEditor({ inputs, onChange }: InlineInputsEditorProps) {
  const updateBox = (index: number, patch: Partial<InlineInputBox>) => {
    onChange(inputs.map((box, i) => (i === index ? { ...box, ...patch } : box)));
  };

  const addBox = () => {
    onChange([...inputs, createInlineInputBox(inputs.length)]);
  };

  const removeBox = (index: number) => {
    onChange(inputs.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-3 rounded-lg border border-black/10 bg-[#f8fafc] p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Input boxes (horizontal row)
        </p>
        <Button type="button" size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={addBox}>
          <Plus className="size-3.5" />
          Add box
        </Button>
      </div>

      <div className="rounded-md border border-black/10 bg-white px-3 py-2">
        <p className="mb-2 text-[11px] text-muted-foreground">Student preview</p>
        <HorizontalInputFields boxes={inputs} disabled />
      </div>

      <div className="space-y-2">
        {inputs.map((box, index) => (
          <div
            key={`${box.key}-${index}`}
            className="grid gap-2 rounded-md border border-black/8 bg-white p-2 sm:grid-cols-2"
          >
            <div className="space-y-1">
              <Label className="text-xs">Label (optional)</Label>
              <Input
                className="h-8 text-sm"
                placeholder="e.g. 1, x, Name"
                value={box.label ?? ""}
                onChange={(e) => updateBox(index, { label: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Marks</Label>
              <Input
                type="number"
                min={1}
                className="h-8 w-20 text-sm"
                value={box.marks ?? 1}
                onChange={(e) =>
                  updateBox(index, { marks: Math.max(1, Number(e.target.value) || 1) })
                }
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Placeholder</Label>
              <Input
                className="h-8 text-sm"
                placeholder="Grey hint in the box"
                value={box.placeholder ?? ""}
                onChange={(e) => updateBox(index, { placeholder: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Unit (shown beside box)</Label>
              <Input
                className="h-8 w-24 text-sm"
                placeholder="e.g. kg, $"
                value={box.unit ?? ""}
                onChange={(e) => updateBox(index, { unit: e.target.value })}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label className="text-xs">Correct answer</Label>
              <Input
                className="h-8 text-sm"
                placeholder="Accepted answer (e.g. 42 kg)"
                value={box.acceptedAnswer ?? ""}
                onChange={(e) => updateBox(index, { acceptedAnswer: e.target.value })}
                onBlur={(e) => {
                  const { value, unit } = splitAnswerValueAndUnit(e.target.value);
                  const normalized = normalizeAcceptedAnswerForStorage(value);
                  updateBox(index, {
                    acceptedAnswer: normalized,
                    ...(unit && !box.unit?.trim() ? { unit } : {}),
                  });
                }}
              />
            </div>
            {inputs.length > 1 ? (
              <div className="sm:col-span-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 gap-1 text-xs text-danger hover:text-danger"
                  onClick={() => removeBox(index)}
                >
                  <Trash2 className="size-3.5" />
                  Remove box
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
