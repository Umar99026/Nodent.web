import type { LucideIcon } from "lucide-react";
import { Eraser, Pencil, Type } from "lucide-react";
import { cn } from "@/lib/utils";

export type AnswerInputMode = "text" | "pencil" | "eraser";

const TOOLBAR_ITEMS: { id: AnswerInputMode; label: string; icon: LucideIcon }[] = [
  { id: "text", label: "Text", icon: Type },
  { id: "pencil", label: "Pencil", icon: Pencil },
  { id: "eraser", label: "Eraser", icon: Eraser },
];

type AnswerInputToolbarProps = {
  mode: AnswerInputMode;
  onModeChange: (mode: AnswerInputMode) => void;
  disabled?: boolean;
  disabledModes?: Partial<Record<AnswerInputMode, boolean>>;
  note?: string;
};

export function AnswerInputToolbar({
  mode,
  onModeChange,
  disabled = false,
  disabledModes,
  note,
}: AnswerInputToolbarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 bg-[#f8fafc] px-1.5 py-1">
      <div role="toolbar" aria-label="Answer input mode" className="flex items-center gap-0.5">
        {TOOLBAR_ITEMS.map(({ id, label, icon: Icon }) => {
          const locked = Boolean(disabledModes?.[id]);
          const isDisabled = disabled || locked;
          return (
            <button
              key={id}
              type="button"
              disabled={isDisabled}
              aria-pressed={mode === id}
              aria-label={locked ? `${label} (locked)` : label}
              onClick={() => {
                if (locked) return;
                onModeChange(id);
              }}
              className={cn(
                "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                mode === id
                  ? "bg-[#0b0f19] text-white"
                  : "text-slate-600 hover:bg-black/5 hover:text-[#0b0f19]",
                isDisabled && "pointer-events-none opacity-50",
              )}
            >
              <Icon className="size-3.5 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          );
        })}
      </div>
      {note ? (
        <p className="px-2 text-[11px] text-slate-500">
          {note}
        </p>
      ) : null}
    </div>
  );
}
