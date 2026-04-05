export function cleanText(value: unknown, maxLength: number = 1000): string {
  if (typeof value !== "string") return "";
  return value.replace(/\0/g, "").trim().slice(0, maxLength);
}

export function canonicalSubjectId(raw: unknown): string {
  const s = cleanText(raw, 80).toLowerCase().replace(/\s+/g, " ");
  const aliases: Record<string, string> = {
    "mathematical methods": "methods",
    "mathematical-methods": "methods",
    "math methods": "methods",
    mm: "methods",
    "general mathematics": "general-maths",
    "general maths": "general-maths",
    "general-mathematics": "general-maths",
    "further mathematics": "further-maths",
    "further maths": "further-maths",
    "specialist mathematics": "specialist-maths",
    "specialist maths": "specialist-maths",
  };
  return aliases[s] || s;
}

export function nowIso(): string {
  return new Date().toISOString();
}
