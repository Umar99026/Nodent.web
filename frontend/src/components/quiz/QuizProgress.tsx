import { Progress } from "@/components/ui/progress";

interface QuizProgressProps {
  currentIndex: number;
  answeredCount: number;
  total: number;
}

export function QuizProgress({ currentIndex, answeredCount, total }: QuizProgressProps) {
  const percentage = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-foreground">
          Answered{" "}
          <span className="font-semibold text-brand-dark">{answeredCount}</span>{" "}
          / <span className="font-semibold">{total}</span>
        </span>
        <span className="text-muted-foreground tabular-nums text-xs">
          {percentage}%
        </span>
      </div>
      <Progress value={percentage} />
    </div>
  );
}
