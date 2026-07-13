export const GENERIC_USER_ERROR = "Something went wrong. Please try again.";

export function isGenericUserFacingError(message: string): boolean {
  return message.trim() === GENERIC_USER_ERROR;
}

function readApiError(err: unknown): { status: number; message: string } | null {
  if (
    err &&
    typeof err === "object" &&
    (err as { name?: string }).name === "ApiError" &&
    "status" in err &&
    "message" in err
  ) {
    return {
      status: Number((err as { status: number }).status),
      message: String((err as { message: string }).message),
    };
  }
  return null;
}

/** Login/signup forms — never show the generic fallback toast/banner copy. */
export function loginFormErrorMessage(err: unknown, networkMessage: string): string {
  const apiErr = readApiError(err);
  if (apiErr) {
    if (apiErr.status === 0) return networkMessage;
    const msg = apiErr.message.trim();
    if (!msg || isGenericUserFacingError(msg)) {
      return "Check your email or username and password, then try again.";
    }
    return msg;
  }
  return "Check your email or username and password, then try again.";
}

export function signupFormErrorMessage(err: unknown, networkMessage: string): string {
  const apiErr = readApiError(err);
  if (apiErr) {
    if (apiErr.status === 0) return networkMessage;
    const msg = apiErr.message.trim();
    if (!msg || isGenericUserFacingError(msg)) {
      return "Couldn't create your account. Check your details and try again.";
    }
    return msg;
  }
  return "Couldn't create your account. Check your details and try again.";
}

/** Turn raw API / Gemini errors into short messages safe to show students. */
export function sanitizeUserFacingError(
  raw: unknown,
  fallback = GENERIC_USER_ERROR,
): string {
  const text = String(raw ?? "").trim();
  if (!text) return fallback;

  const lower = text.toLowerCase();

  if (
    lower.includes("insufficient_quota") ||
    lower.includes("exceeded your current quota") ||
    lower.includes("billing")
  ) {
    return "AI marking is temporarily unavailable. Try again later.";
  }
  if (
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    /\b429\b/.test(lower)
  ) {
    return "Too many requests. Wait a moment and try again.";
  }
  if (lower.includes("gemini error") || lower.includes("openai error") || lower.includes("invalid json")) {
    return fallback;
  }
  if (lower.includes("handwriting image is too large") || lower.includes("too large to mark")) {
    return "Your drawing is too large. Use a smaller area or less ink.";
  }
  if (
    lower.includes("gemini_api_key") ||
    lower.includes("openai_api_key") ||
    lower.includes("ai marking is not configured") ||
    lower.includes("not configured")
  ) {
    return "AI marking is not available right now.";
  }
  if (lower.includes("session expired") || lower.includes("unauthorized")) {
    return "Your session expired. Refresh the page and sign in again.";
  }

  // Never leak JSON error bodies or long technical dumps.
  if (text.includes("{") && (text.includes("error") || text.includes("message"))) {
    return fallback;
  }
  if (text.length > 140 || text.includes("Gemini error (") || text.includes("OpenAI error (")) {
    return fallback;
  }

  return text;
}

export function questionHelpUserError(raw?: unknown): string {
  const text = String(raw ?? "").trim();
  const lower = text.toLowerCase();
  if (
    lower.includes("gemini_api_key") ||
    lower.includes("question help is not configured")
  ) {
    if (typeof window !== "undefined") {
      const host = window.location.hostname.toLowerCase();
      if (host === "localhost" || host === "127.0.0.1" || import.meta.env.DEV) {
        return "Ask AI needs a Gemini API key. Add GEMINI_API_KEY=your_key to .dev.vars in the project root (AI Studio keys may start with AIza or AQ), then restart npm run dev:all.";
      }
    }
    return "Ask AI is not available right now.";
  }
  if (lower.includes("no free quota") || lower.includes("gemini-2.5-flash")) {
    return text;
  }
  return sanitizeUserFacingError(raw, "Could not get help right now. Try again.");
}

export function handwritingMarkUserError(raw?: unknown): string {
  return sanitizeUserFacingError(
    raw,
    "Could not read your drawing. Try again in a moment.",
  );
}

export function aiResponseMarkUserError(raw?: unknown): string {
  return sanitizeUserFacingError(
    raw,
    "Could not mark your answer. Try again in a moment.",
  );
}
