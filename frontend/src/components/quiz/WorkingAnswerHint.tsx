/** Shown above ruled answer areas — matches local marking (final answer on last line). */
export function WorkingAnswerHint() {
  return (
    <p className="text-[11px] leading-snug text-muted-foreground">
      Show your working on the lines above; put your{" "}
      <span className="font-medium text-foreground/75">final answer on the last line</span>.
    </p>
  );
}
