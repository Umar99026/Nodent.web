import { Progress } from "@/components/ui/progress";

interface QuizProgressProps {
  current: number;
  total: number;
}

export function QuizProgress({ current, total }: QuizProgressProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground">
          Question{" "}
          <span className="font-semibold text-brand-dark">
            {Math.min(current + 1, total)}
          </span>{" "}
          of <span className="font-semibold">{total}</span>
        </span>
        <span className="text-muted-foreground tabular-nums text-xs">
          {percentage}%
        </span>
      </div>
      <Progress value={percentage} />
    </div>
  );
}
