import { STORAGE_KEYS } from "@/lib/constants";

function resolveApiBase(): string {
  const envBase = (import.meta.env.VITE_API_URL || "").trim().replace(/\/$/, "");
  if (envBase) return envBase;

  // Production safety-net: if the frontend is served from Pages, use the Worker API.
  // This avoids 404s from same-origin `/api/*` when Pages is not hosting the API routes.
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host === "nodent.pages.dev" || host.endsWith(".pages.dev")) {
      return "https://nodent-api.nodent-vce.workers.dev";
    }
  }

  return "";
}

const API_BASE = resolveApiBase();

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

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    localStorage.removeItem(STORAGE_KEYS.authToken);
    localStorage.removeItem(STORAGE_KEYS.currentUser);
    window.location.href = "/login";
    throw new ApiError(401, "Unauthorized");
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

  const response = await fetch(`${API_BASE}${path}`, {
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
