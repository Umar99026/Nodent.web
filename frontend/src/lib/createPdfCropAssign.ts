/** Where a PDF crop region is assigned on the active question. */
export type CropAssignTarget =
  | { kind: "stimulus" }
  | { kind: "part-figure"; partIndex: number };

export function cropTargetLabel(target: CropAssignTarget, partKey?: string): string {
  if (target.kind === "stimulus") return "Question stimulus";
  const letter = partKey ?? String.fromCharCode(97 + target.partIndex);
  return `Part ${letter}) figure`;
}
