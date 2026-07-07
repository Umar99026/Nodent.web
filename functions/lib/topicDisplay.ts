/** DB/import placeholder — not a real curriculum topic for reports. */
export function isPlaceholderTopic(topic: unknown): boolean {
  const raw = String(topic ?? "").trim();
  if (!raw) return true;
  if (/^general$/i.test(raw)) return true;
  if (/^(?:test(?:\s*pdf)?|pdf\s*test)$/i.test(raw)) return true;
  return false;
}
