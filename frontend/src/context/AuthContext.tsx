import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { apiFetch, ApiError } from "@/lib/api";
import { STORAGE_KEYS, API_PATHS } from "@/lib/constants";

export interface User {
  id: number;
  email: string;
  username: string;
  profilePhoto?: string | null;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (
    username: string,
    email: string,
    password: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateAccount: (payload: {
    username?: string;
    currentPassword?: string;
    newPassword?: string;
  }) => Promise<void>;
  setProfilePhoto: (profilePhoto: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface BootstrapResponse {
  user: User;
  customQuestions?: Record<string, unknown[]>;
  [key: string]: unknown;
}

interface AuthResponse {
  token: string;
  user: User;
}

interface UpdateAccountResponse {
  user: User;
}

function withProfilePhoto(user: User): User {
  return {
    ...user,
    profilePhoto:
      typeof user.profilePhoto === "string" && user.profilePhoto.trim()
        ? user.profilePhoto
        : null,
  };
}

function persistCurrentUser(user: User | null) {
  if (!user) {
    localStorage.removeItem(STORAGE_KEYS.currentUser);
    return;
  }
  localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
}

const BOOTSTRAP_TIMEOUT_MS = 12_000;

function readCachedUser(): User | null {
  try {
    const storedUser = localStorage.getItem(STORAGE_KEYS.currentUser);
    if (!storedUser) return null;
    return JSON.parse(storedUser) as User;
  } catch {
    return null;
  }
}

/** Guests should not block on a spinner while useEffect runs. */
function readInitialAuthState(): AuthState {
  if (typeof window === "undefined") {
    return {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
    };
  }

  const storedToken = localStorage.getItem(STORAGE_KEYS.authToken);
  if (!storedToken) {
    return {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    };
  }

  const cachedUser = readCachedUser();
  // If a token exists but we don't have the cached user payload, treat it as logged out.
  // This prevents an infinite spinner on first load / partial storage clears.
  if (!cachedUser) {
    localStorage.removeItem(STORAGE_KEYS.authToken);
    return {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    };
  }
  return {
    user: cachedUser,
    token: storedToken,
    isAuthenticated: !!cachedUser,
    isLoading: true,
  };
}

function isBootstrapTimeoutError(err: unknown): boolean {
  return (
    err instanceof DOMException && err.name === "AbortError"
  ) || (err instanceof Error && err.name === "AbortError");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(readInitialAuthState);

  // Validate stored token (with timeout so a dead API cannot spin forever).
  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_KEYS.authToken);
    if (!storedToken) return;

    const cachedUser = readCachedUser();
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      BOOTSTRAP_TIMEOUT_MS,
    );

    apiFetch<BootstrapResponse>(API_PATHS.bootstrap, { signal: controller.signal })
      .then((data) => {
        const user = withProfilePhoto(data.user);
        persistCurrentUser(user);
        if (data.customQuestions) {
          localStorage.setItem(
            STORAGE_KEYS.customQuestions,
            JSON.stringify(data.customQuestions),
          );
        }
        setState({
          user,
          token: storedToken,
          isAuthenticated: true,
          isLoading: false,
        });
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          localStorage.removeItem(STORAGE_KEYS.authToken);
          localStorage.removeItem(STORAGE_KEYS.currentUser);
          setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
          return;
        }

        if (cachedUser) {
          setState({
            user: withProfilePhoto(cachedUser),
            token: storedToken,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }

        if (isBootstrapTimeoutError(err)) {
          localStorage.removeItem(STORAGE_KEYS.authToken);
        }

        setState({
          user: null,
          token: null,
          isAuthenticated: false,
          isLoading: false,
        });
      })
      .finally(() => {
        window.clearTimeout(timeoutId);
      });
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const rememberMe = localStorage.getItem(STORAGE_KEYS.rememberLogin) === "true";
      const data = await apiFetch<AuthResponse>(API_PATHS.auth.login, {
        method: "POST",
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const user = withProfilePhoto(data.user);
      localStorage.setItem(STORAGE_KEYS.authToken, data.token);
      persistCurrentUser(user);

      setState({
        user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
      });
    },
    [],
  );

  const signup = useCallback(
    async (username: string, email: string, password: string) => {
      const data = await apiFetch<AuthResponse>(API_PATHS.auth.signup, {
        method: "POST",
        body: JSON.stringify({ username, email, password }),
      });

      const user = withProfilePhoto(data.user);
      localStorage.setItem(STORAGE_KEYS.authToken, data.token);
      persistCurrentUser(user);

      setState({
        user,
        token: data.token,
        isAuthenticated: true,
        isLoading: false,
      });
    },
    [],
  );

  const logout = useCallback(async () => {
    // Clear local state immediately so the UI can redirect reliably.
    localStorage.removeItem(STORAGE_KEYS.authToken);
    localStorage.removeItem(STORAGE_KEYS.currentUser);

    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });

    // Best-effort server logout (don't block UI).
    void apiFetch(API_PATHS.auth.logout, { method: "POST" }).catch(() => {});
  }, []);

  const updateAccount = useCallback(
    async (payload: {
      username?: string;
      currentPassword?: string;
      newPassword?: string;
    }) => {
      const data = await apiFetch<UpdateAccountResponse>(API_PATHS.auth.account, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      const user = withProfilePhoto(data.user);
      persistCurrentUser(user);
      setState((prev) => ({
        ...prev,
        user,
      }));
    },
    [],
  );

  const setProfilePhoto = useCallback(async (profilePhoto: string | null) => {
    const data = await apiFetch<UpdateAccountResponse>(API_PATHS.auth.account, {
      method: "PATCH",
      body: JSON.stringify({ profilePhoto }),
    });
    const user = withProfilePhoto(data.user);
    persistCurrentUser(user);
    setState((prev) => ({
      ...prev,
      user,
    }));
  }, []);

  return (
    <AuthContext.Provider
      value={{ ...state, login, signup, logout, updateAccount, setProfilePhoto }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
