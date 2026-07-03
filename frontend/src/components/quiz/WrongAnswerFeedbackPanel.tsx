import { SmartMarkingBulletList } from "@/components/quiz/AiMarkingFeedbackPanel";
import { cn } from "@/lib/utils";
import { XCircle } from "lucide-react";

type WrongAnswerFeedbackPanelProps = {
  bullets: string[];
  title?: string;
  className?: string;
};

export function WrongAnswerFeedbackPanel({
  bullets,
  title = "What to fix",
  className,
}: WrongAnswerFeedbackPanelProps) {
  const items = bullets.map((b) => String(b ?? "").trim()).filter(Boolean);
  if (!items.length) return null;

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-danger/20 bg-danger/[0.04] px-4 py-3 text-sm",
        className,
      )}
    >
      <XCircle className="mt-0.5 size-4 shrink-0 text-danger" />
      <div className="min-w-0 flex-1 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-foreground">{title}</p>
        <SmartMarkingBulletList text={items.map((b) => `• ${b}`).join("\n")} />
      </div>
    </div>
  );
}
