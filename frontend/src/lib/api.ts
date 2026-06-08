import { STORAGE_KEYS } from "@/lib/constants";

function resolveApiBase(): string {
  const raw = (import.meta.env.VITE_API_URL || "").trim();
  if (raw) {
    const normalized = raw.replace(/\/$/, "");
    // Same-origin /api (Vite proxy or Cloudflare Pages Functions)
    if (normalized === "/api" || normalized.endsWith("/api")) return "";
    return normalized;
  }

  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host === "nodent.pages.dev" || host.endsWith(".pages.dev")) {
      return "";
    }
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

/** Avoid hanging forever when the local API is not running (Vite proxy → :8787). */
const DEFAULT_FETCH_TIMEOUT_MS = 20_000;

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

export const API_UNREACHABLE_MESSAGE =
  "Could not reach the server. For local dev, run npm run dev:all (frontend + API on port 8787).";

/** Use for bare `fetch()` calls that must hit the Worker in production (e.g. token upload). */
export function getApiBase(): string {
  return resolveApiBase();
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const { signal, clear } = mergeAbortSignals(
    DEFAULT_FETCH_TIMEOUT_MS,
    init.signal ?? null,
  );
  try {
    return await fetch(url, { ...init, signal });
  } catch (err) {
    if (isFetchTimeoutError(err)) {
      throw new ApiError(0, API_UNREACHABLE_MESSAGE);
    }
    throw err;
  } finally {
    clear();
  }
}

export async function apiFetch<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const token = localStorage.getItem(STORAGE_KEYS.authToken);
  const method = options?.method?.toUpperCase() ?? "GET";

  const headers = new Headers(options?.headers);

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
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

  if (response.status === 401) {
    // Don't auto-redirect — let the caller handle it.
    // AuthContext bootstrap handles session expiry; other pages just show error.
    const body = await response.json().catch(() => ({}));
    const message =
      (body as Record<string, unknown>).error ??
      (body as Record<string, unknown>).message ??
      "Session expired";
    throw new ApiError(401, String(message));
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
  if (adminKey && !headers.has("x-admin-key")) headers.set("x-admin-key", adminKey);

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
