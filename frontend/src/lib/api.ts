import { STORAGE_KEYS } from "@/lib/constants";
import { GENERIC_USER_ERROR, sanitizeUserFacingError } from "@/lib/userFacingErrors";

function resolveApiBase(): string {
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (
      host === "nodent.pages.dev" ||
      host.endsWith(".pages.dev") ||
      host === "nodentlearning.com" ||
      host === "www.nodentlearning.com"
    ) {
      // All production domains are attached to the same Pages Functions project.
      // Keep auth requests same-origin so browser privacy/CORS rules cannot block signup.
      return "";
    }
  }

  const raw = (import.meta.env.VITE_API_URL || "").trim();
  if (raw) {
    const normalized = raw.replace(/\/$/, "");
    // Same-origin /api (Vite proxy or Cloudflare Pages Functions)
    if (normalized === "/api" || normalized.endsWith("/api")) return "";
    return normalized;
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    // Vite dev: use proxy in vite.config.ts (same-origin /api → :8787)
    if (import.meta.env.DEV) return "";
    // Built app opened on localhost without proxy (e.g. vite preview)
    if (host === "localhost" || host === "127.0.0.1") {
      return "http://127.0.0.1:8787";
    }
  }

  return "";
}

const API_BASE = resolveApiBase();

/** Avoid hanging forever when the API is slow (cold start) or unreachable. */
const DEFAULT_FETCH_TIMEOUT_MS = 45_000;
/** Bootstrap returns the full question bank — allow extra time on cold starts. */
export const BOOTSTRAP_FETCH_TIMEOUT_MS = 90_000;
export const AI_FETCH_TIMEOUT_MS = 90_000;

function isLocalDevHost(): boolean {
  if (typeof window === "undefined") return import.meta.env.DEV;
  const host = window.location.hostname.toLowerCase();
  return import.meta.env.DEV || host === "localhost" || host === "127.0.0.1";
}

/** User-facing message when fetch fails or times out (dev vs production). */
export function apiUnreachableMessage(): string {
  if (isLocalDevHost()) {
    return "Could not reach the server. For local dev, run npm run dev:all (frontend + API on port 8787).";
  }
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host === "www.nodentlearning.com" || host === "nodentlearning.com") {
      return "Could not reach the server. Check your connection, refresh the page, and try again.";
    }
  }
  return "Could not reach the server. The connection timed out — wait a moment and refresh, or try again.";
}

/** @deprecated use apiUnreachableMessage() — kept for existing imports */
export const API_UNREACHABLE_MESSAGE = apiUnreachableMessage();

export type ApiFetchOptions = RequestInit & { timeoutMs?: number };

function mergeAbortSignals(
  timeoutMs: number,
  external?: AbortSignal | null,
): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  const onExternalAbort = () => controller.abort();
  if (external) {
    if (external.aborted) controller.abort();
    else external.addEventListener("abort", onExternalAbort, { once: true });
  }
  return {
    signal: controller.signal,
    clear: () => {
      window.clearTimeout(timeoutId);
      external?.removeEventListener("abort", onExternalAbort);
    },
  };
}

export function isFetchTimeoutError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

function isNetworkFetchError(err: unknown): boolean {
  return err instanceof TypeError;
}

/** Use for bare `fetch()` calls that must hit the Worker in production (e.g. token upload). */
export function getApiBase(): string {
  return resolveApiBase();
}

export class ApiError extends Error {
  status: number;
  code?: string;

  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const { signal, clear } = mergeAbortSignals(
    timeoutMs,
    init.signal ?? null,
  );
  try {
    return await fetch(url, { ...init, signal });
  } catch (err) {
    if (isFetchTimeoutError(err) || isNetworkFetchError(err)) {
      throw new ApiError(0, apiUnreachableMessage());
    }
    throw err;
  } finally {
    clear();
  }
}

export async function apiFetch<T>(
  path: string,
  options?: ApiFetchOptions,
): Promise<T> {
  const token = localStorage.getItem(STORAGE_KEYS.authToken);
  const method = options?.method?.toUpperCase() ?? "GET";
  const timeoutMs = options?.timeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
  const fetchOptions = { ...(options ?? {}) };
  delete fetchOptions.timeoutMs;

  const headers = new Headers(fetchOptions?.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const isFormData =
    typeof FormData !== "undefined" && fetchOptions?.body instanceof FormData;
  if (
    (method === "POST" || method === "PUT" || method === "PATCH") &&
    !headers.has("Content-Type") &&
    !isFormData
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetchWithTimeout(`${API_BASE}${path}`, {
    ...fetchOptions,
    headers,
  }, timeoutMs);

  if (response.status === 401) {
    // Don't auto-redirect — let the caller handle it.
    // AuthContext bootstrap handles session expiry; other pages just show error.
    const body = await response.json().catch(() => ({}));
    const message =
      (body as Record<string, unknown>).error ??
      (body as Record<string, unknown>).message ??
      "Session expired";
    const code = (body as Record<string, unknown>).code;
    throw new ApiError(
      401,
      sanitizeUserFacingError(String(message), "Session expired"),
      code != null ? String(code) : undefined,
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message =
      (body as Record<string, unknown>).error ??
      (body as Record<string, unknown>).message ??
      response.statusText;
    const code = (body as Record<string, unknown>).code;
    throw new ApiError(
      response.status,
      sanitizeUserFacingError(String(message), GENERIC_USER_ERROR),
      code != null ? String(code) : undefined,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export async function apiFetchAdmin<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const method = options?.method?.toUpperCase() ?? "GET";

  const headers = new Headers(options?.headers);

  // Admin endpoints require auth token (and optionally an admin key).
  const token = localStorage.getItem(STORAGE_KEYS.authToken);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  // Legacy: x-admin-key (optional). New default is admin-email auth.
  const adminKey = localStorage.getItem(STORAGE_KEYS.adminKey)?.trim() ?? "";
  if (adminKey && !headers.has("x-admin-key")) {
    headers.set("x-admin-key", adminKey);
  } else if (
    import.meta.env.DEV &&
    isLocalDevHost() &&
    !headers.has("x-admin-key")
  ) {
    headers.set("x-admin-key", "localdev");
  }

  const isFormData =
    typeof FormData !== "undefined" && options?.body instanceof FormData;
  if (
    (method === "POST" || method === "PUT" || method === "PATCH") &&
    !headers.has("Content-Type") &&
    !isFormData
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetchWithTimeout(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 || response.status === 403) {
    const body = await response.json().catch(() => ({}));
    const message =
      (body as Record<string, unknown>).error ??
      (body as Record<string, unknown>).message;
    throw new ApiError(
      response.status,
      message != null ? String(message) : "Admin access denied",
    );
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const message =
      (body as Record<string, unknown>).error ??
      (body as Record<string, unknown>).message ??
      response.statusText;
    throw new ApiError(response.status, String(message));
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}
