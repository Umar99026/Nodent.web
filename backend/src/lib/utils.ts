export function cleanText(value: unknown, maxLength: number = 1000): string {
  if (typeof value !== "string") return "";
  return value.replace(/\0/g, "").trim().slice(0, maxLength);
}

export function nowIso(): string {
  return new Date().toISOString();
}
