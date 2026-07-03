import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { apiFetch, ApiError, BOOTSTRAP_FETCH_TIMEOUT_MS } from "@/lib/api";
import { STORAGE_KEYS, API_PATHS, type AccountRole } from "@/lib/constants";

export interface User {
  id: number;
  email: string;
  username: string;
  profilePhoto?: string | null;
  accountRole?: AccountRole | null;
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
    accountRole: AccountRole,
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

interface SessionResponse {
  user: User;
}

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

const SESSION_TIMEOUT_MS = 8_000;

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
  if (!cachedUser) {
    localStorage.removeItem(STORAGE_KEYS.authToken);
    return {
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    };
  }

  // Trust cache for instant UI; validate session in the background (no spinner).
  return {
    user: cachedUser,
    token: storedToken,
    isAuthenticated: true,
    isLoading: false,
  };
}

function isAbortError(err: unknown): boolean {
  return (
    (err instanceof DOMException && err.name === "AbortError") ||
    (err instanceof Error && err.name === "AbortError")
  );
}

/** Warm customQuestions in localStorage without blocking login or routes. */
function prefetchQuestionBankInBackground() {
  void apiFetch<BootstrapResponse>(API_PATHS.bootstrap, {
    timeoutMs: BOOTSTRAP_FETCH_TIMEOUT_MS,
  })
    .then((data) => {
      if (data.customQuestions) {
        localStorage.setItem(
          STORAGE_KEYS.customQuestions,
          JSON.stringify(data.customQuestions),
        );
      }
    })
    .catch(() => {});
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(readInitialAuthState);

  // Validate stored token with a small payload (not full bootstrap).
  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_KEYS.authToken);
    if (!storedToken) return;

    const cachedUser = readCachedUser();
    const controller = new AbortController();
    const timeoutId = window.setTimeout(
      () => controller.abort(),
      SESSION_TIMEOUT_MS,
    );

    apiFetch<SessionResponse>(API_PATHS.auth.session, {
      signal: controller.signal,
    })
      .then((data) => {
        const user = withProfilePhoto(data.user);
        persistCurrentUser(user);
        setState({
          user,
          token: storedToken,
          isAuthenticated: true,
          isLoading: false,
        });
        prefetchQuestionBankInBackground();
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

        // Network/API down: keep cached session so login page is not blocked for minutes.
        if (cachedUser) {
          setState({
            user: withProfilePhoto(cachedUser),
            token: storedToken,
            isAuthenticated: true,
            isLoading: false,
          });
          return;
        }

        if (isAbortError(err)) {
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
    async (identity: string, password: string) => {
      const rememberMe = localStorage.getItem(STORAGE_KEYS.rememberLogin) === "true";
      const trimmed = identity.trim();
      const isEmail = trimmed.includes("@");
      const data = await apiFetch<AuthResponse>(API_PATHS.auth.login, {
        method: "POST",
        body: JSON.stringify({
          email: isEmail ? trimmed.toLowerCase() : "",
          username: isEmail ? "" : trimmed,
          password,
          rememberMe,
        }),
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

      prefetchQuestionBankInBackground();
    },
    [],
  );

  const signup = useCallback(
    async (
      username: string,
      email: string,
      password: string,
      accountRole: AccountRole,
    ) => {
      const data = await apiFetch<AuthResponse>(API_PATHS.auth.signup, {
        method: "POST",
        body: JSON.stringify({ username, email, password, accountRole }),
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

      prefetchQuestionBankInBackground();
    },
    [],
  );

  const logout = useCallback(async () => {
    localStorage.removeItem(STORAGE_KEYS.authToken);
    localStorage.removeItem(STORAGE_KEYS.currentUser);

    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });

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
