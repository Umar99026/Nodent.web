export function createToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function sessionExpiry(): string {
  const date = new Date();
  date.setDate(date.getDate() + 30);
  return date.toISOString();
}
