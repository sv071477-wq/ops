"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from "react";
import { User, api } from "@/lib/api";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = "auth_token";
const REFRESH_KEY = "refresh_token";
// Non-sensitive presence flag read by `middleware.ts` so unauthenticated
// requests are redirected before the page renders.
const SESSION_COOKIE = "ops_session";

function setSessionCookie(present: boolean) {
  if (typeof document === "undefined") return;
  if (present) {
    document.cookie = `${SESSION_COOKIE}=1; path=/; SameSite=Lax`;
  } else {
    document.cookie = `${SESSION_COOKIE}=; path=/; Max-Age=0; SameSite=Lax`;
  }
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const router = useRouter();

  // `logout` is captured by `refreshAccessToken` and by the cross-tab listener.
  // Using a ref keeps a single stable identity without the stale-closure bug
  // that a `useCallback(..., [])` over a re-created `logout` would introduce.
  const logoutRef = useRef<() => void>(() => {});

  const clearSession = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(REFRESH_KEY);
    }
    setSessionCookie(false);
    setUser(null);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    router.replace("/login");
    router.refresh();
  }, [clearSession, router]);

  logoutRef.current = logout;

  const storeSession = useCallback((data: { access_token: string; refresh_token: string; user?: User }) => {
    if (typeof window !== "undefined") {
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(REFRESH_KEY, data.refresh_token);
    }
    setSessionCookie(true);
    if (data.user) setUser(data.user);
  }, []);

  const refreshAccessToken = useCallback(async (): Promise<boolean> => {
    if (typeof window === "undefined") return false;
    const storedRefreshToken = localStorage.getItem(REFRESH_KEY);
    if (!storedRefreshToken) {
      logoutRef.current();
      return false;
    }
    try {
      const data = await api.refreshToken(storedRefreshToken);
      storeSession(data);
      return true;
    } catch (err) {
      console.error("Token refresh failed:", err);
      logoutRef.current();
      return false;
    }
  }, [storeSession]);

  // Keep the API client's in-client refresh and this context in sync. Without
  // this, a silent refresh inside `api` updated localStorage while the context
  // kept serving stale tokens.
  useEffect(() => {
    api.setTokenRefreshListener((tokens) => {
      storeSession(tokens);
    });
    return () => api.setTokenRefreshListener(null);
  }, [storeSession]);

  // Bootstrap the session on mount.
  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      if (typeof window === "undefined") {
        if (!cancelled) setIsLoading(false);
        return;
      }

      const storedToken = localStorage.getItem(TOKEN_KEY);
      if (!storedToken) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      try {
        const profile = await api.getMe();
        if (cancelled) return;
        setUser(profile);
        // Restore the presence flag if it was cleared while tokens remained.
        setSessionCookie(true);
      } catch (err) {
        if (cancelled) return;
        console.error("Session expired or invalid, attempting refresh:", err);
        const hadRefreshToken = Boolean(localStorage.getItem(REFRESH_KEY));
        if (hadRefreshToken) {
          await refreshAccessToken();
        } else {
          clearSession();
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    initAuth();
    return () => {
      cancelled = true;
    };
  }, [refreshAccessToken, clearSession]);

  // Keep multiple tabs consistent: logging out in one tab signs out the others.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== TOKEN_KEY) return;
      if (!event.newValue) {
        setUser(null);
        router.replace("/login");
        router.refresh();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [router]);

  const login = useCallback(
    async (email: string, password: string) => {
      setIsLoading(true);
      clearSession();
      try {
        const data = await api.login(email, password);
        storeSession(data);
        router.replace(data.user?.role?.toLowerCase() === "admin" ? "/admin" : "/");
        router.refresh();
      } catch (error) {
        clearSession();
        throw error;
      } finally {
        setIsLoading(false);
      }
    },
    [clearSession, storeSession, router]
  );

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshAccessToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
