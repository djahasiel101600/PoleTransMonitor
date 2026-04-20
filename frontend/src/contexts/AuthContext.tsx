/* eslint react-refresh/only-export-components: off */
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { API_BASE, authFetch, registerAuthFailureHandler } from "../api/client";

export type Me = {
  id: number;
  username: string;
  is_staff: boolean;
  is_superuser: boolean;
  is_approved: boolean;
};

type AuthContextValue = {
  accessToken: string | null;
  refreshToken: string | null;
  me: Me | null;
  isAdmin: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshMe: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function getStoredToken(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessToken] = useState<string | null>(() => getStoredToken("accessToken"));
  const [refreshToken, setRefreshToken] = useState<string | null>(() => getStoredToken("refreshToken"));
  const [me, setMe] = useState<Me | null>(null);

  const isAdmin = !!me && (me.is_staff || me.is_superuser);

  const logout = useCallback(() => {
    setAccessToken(null);
    setRefreshToken(null);
    setMe(null);
    try {
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    registerAuthFailureHandler(() => logout());
    return () => registerAuthFailureHandler(null);
  }, [logout]);

  // Keep React state in sync when authFetch refreshes the access token (localStorage updated first).
  useEffect(() => {
    const onAccessRefreshed = (e: Event) => {
      const ce = e as CustomEvent<{ access: string }>;
      if (ce.detail?.access) setAccessToken(ce.detail.access);
    };
    window.addEventListener("poletrans:access-token", onAccessRefreshed);
    return () => window.removeEventListener("poletrans:access-token", onAccessRefreshed);
  }, []);

  const refreshMe = useCallback(async () => {
    const t = getStoredToken("accessToken");
    if (!t) return;
    const res = await authFetch(`${API_BASE}/me/`, {});
    if (!res.ok) {
      logout();
      return;
    }
    const data = (await res.json()) as Me;
    setMe(data);
  }, [logout]);

  useEffect(() => {
    if (!accessToken) return;
    queueMicrotask(() => void refreshMe());
  }, [accessToken, refreshMe]);

  const login = async (username: string, password: string) => {
    const res = await fetch(`${API_BASE}/token/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      throw new Error("Login failed. Check your username/password.");
    }

    const data = await res.json();
    const nextAccess: string | null = data.access ?? null;
    const nextRefresh: string | null = data.refresh ?? null;
    if (!nextAccess) throw new Error("Login failed: missing access token");

    setAccessToken(nextAccess);
    setRefreshToken(nextRefresh);
    try {
      localStorage.setItem("accessToken", nextAccess);
      if (nextRefresh) localStorage.setItem("refreshToken", nextRefresh);
    } catch {
      // ignore
    }

    await refreshMe();
  };

  const value = useMemo<AuthContextValue>(
    () => ({ accessToken, refreshToken, me, isAdmin, login, logout, refreshMe }),
    [accessToken, refreshToken, me, isAdmin, refreshMe, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
