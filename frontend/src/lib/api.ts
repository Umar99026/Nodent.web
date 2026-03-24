import { STORAGE_KEYS } from "@/lib/constants";

const API_BASE = import.meta.env.VITE_API_URL || "";

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

  if (
    (method === "POST" || method === "PUT" || method === "PATCH") &&
    !headers.has("Content-Type")
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
  const adminKey = localStorage.getItem(STORAGE_KEYS.adminKey);
  const method = options?.method?.toUpperCase() ?? "GET";

  const headers = new Headers(options?.headers);

  if (adminKey) {
    headers.set("x-admin-key", adminKey);
  }

  // Also include the auth token for admin endpoints that check both
  const token = localStorage.getItem(STORAGE_KEYS.authToken);
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (
    (method === "POST" || method === "PUT" || method === "PATCH") &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401 || response.status === 403) {
    throw new ApiError(response.status, "Admin access denied");
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
