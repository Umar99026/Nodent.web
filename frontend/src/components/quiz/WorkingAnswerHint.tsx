/** Shown above ruled answer areas — matches local marking (search last line upward). */
export function WorkingAnswerHint() {
  return (
    <p className="text-[11px] leading-snug text-muted-foreground">
      Show your working on the ruled lines. We mark your{" "}
      <span className="font-medium text-foreground/75">final answer</span> — starting from the
      last line and working upward until we find a match.
    </p>
  );
}
