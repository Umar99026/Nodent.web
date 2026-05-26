/** Minimum password length for public signup / reset (matches API). */
export const MIN_PASSWORD_LENGTH = 8;

export function passwordPolicyError(password: string): string | null {
  const p = String(password ?? "");
  if (!p) return "Password is required.";
  if (p.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  return null;
}
