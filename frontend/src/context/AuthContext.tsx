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
  setProfilePhoto: (profilePhoto: string | null) => void;
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

function profilePhotoStorageKey(userId: number | string): string {
  return `${STORAGE_KEYS.profilePhotoPrefix}${userId}`;
}

function readProfilePhoto(userId: number | string): string | null {
  try {
    return localStorage.getItem(profilePhotoStorageKey(userId));
  } catch {
    return null;
  }
}

function withProfilePhoto(user: User): User {
  return {
    ...user,
    profilePhoto: readProfilePhoto(user.id),
  };
}

function persistCurrentUser(user: User | null) {
  if (!user) {
    localStorage.removeItem(STORAGE_KEYS.currentUser);
    return;
  }
  localStorage.setItem(STORAGE_KEYS.currentUser, JSON.stringify(user));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: null,
    isAuthenticated: false,
    isLoading: true,
  });

  // Hydrate on mount — check localStorage for existing token, then validate
  useEffect(() => {
    const storedToken = localStorage.getItem(STORAGE_KEYS.authToken);
    const storedUser = localStorage.getItem(STORAGE_KEYS.currentUser);

    if (!storedToken) {
      setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
      return;
    }

    // Optimistically set user from cache, then confirm with server
    let cachedUser: User | null = null;
    try {
      if (storedUser) {
        cachedUser = JSON.parse(storedUser) as User;
      }
    } catch {
      // ignore
    }

    // Call bootstrap to confirm token validity and get fresh user data
    apiFetch<BootstrapResponse>(API_PATHS.bootstrap)
      .then((data) => {
        const user = withProfilePhoto(data.user);
        persistCurrentUser(user);
        if (data.customQuestions) {
          // Cache admin-added questions so practice pages can render them.
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
        // If 401, apiFetch already cleared storage and redirected
        if (err instanceof ApiError && err.status === 401) {
          setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
          return;
        }
        // Network error — use cached user if available
        if (cachedUser) {
          setState({
            user: cachedUser,
            token: storedToken,
            isAuthenticated: true,
            isLoading: false,
          });
        } else {
          setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      });
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiFetch<AuthResponse>(API_PATHS.auth.login, {
        method: "POST",
        body: JSON.stringify({ email, password }),
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
    try {
      await apiFetch(API_PATHS.auth.logout, { method: "POST" });
    } catch {
      // Logout endpoint failure is non-critical — clear local state anyway
    }

    localStorage.removeItem(STORAGE_KEYS.authToken);
    localStorage.removeItem(STORAGE_KEYS.currentUser);

    setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
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

  const setProfilePhoto = useCallback((profilePhoto: string | null) => {
    setState((prev) => {
      if (!prev.user) return prev;

      const key = profilePhotoStorageKey(prev.user.id);
      if (profilePhoto) {
        localStorage.setItem(key, profilePhoto);
      } else {
        localStorage.removeItem(key);
      }

      const nextUser = { ...prev.user, profilePhoto };
      persistCurrentUser(nextUser);

      return {
        ...prev,
        user: nextUser,
      };
    });
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
