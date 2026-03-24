import { formatSeconds } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Clock, Zap, Target } from "lucide-react";

interface DailyStatsProps {
  /** Total seconds studied today */
  dailySeconds: number;
  /** Number of completed pomodoro sessions */
  sessionsCompleted: number;
  /** Daily goal in minutes */
  goalMinutes: number;
}

export function DailyStats({
  dailySeconds,
  sessionsCompleted,
  goalMinutes,
}: DailyStatsProps) {
  const goalSeconds = goalMinutes * 60;
  const goalProgress = goalSeconds > 0
    ? Math.min(100, (dailySeconds / goalSeconds) * 100)
    : 0;
  const studiedMinutes = Math.floor(dailySeconds / 60);

  return (
    <Card className="border-border bg-cream">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-xl text-brand-dark">
          Today's Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Time Studied */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-brand/10">
            <Clock className="size-5 text-brand" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Time Studied</p>
            <p className="font-display text-lg font-semibold text-brand-dark">
              {formatSeconds(dailySeconds)}
            </p>
          </div>
        </div>

        {/* Sessions */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-success/10">
            <Zap className="size-5 text-success" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Sessions</p>
            <p className="font-display text-lg font-semibold text-brand-dark">
              {sessionsCompleted}
            </p>
          </div>
        </div>

        {/* Daily Goal */}
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-lg bg-amber/10">
            <Target className="size-5 text-amber" />
          </div>
          <div className="flex-1">
            <p className="text-sm text-muted-foreground">Daily Goal</p>
            <p className="font-display text-lg font-semibold text-brand-dark">
              {studiedMinutes} / {goalMinutes} min
            </p>
          </div>
        </div>

        {/* Goal progress bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Goal Progress</span>
            <span className="font-semibold text-brand">
              {Math.round(goalProgress)}%
            </span>
          </div>
          <Progress value={goalProgress} className="h-3" />
        </div>
      </CardContent>
    </Card>
  );
}
