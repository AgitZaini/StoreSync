import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api, onSessionEvent } from "../../lib/api";
import { authStorage } from "../../lib/auth-storage";
import type { AuthResponse, AuthUser, MeResponse } from "../../types/auth";
import { AuthContext } from "./auth-context";
import type { AuthContextValue, AuthStatus } from "./auth-context";

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>(() => (authStorage.getAccessToken() ? "loading" : "anonymous"));
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  const endSession = useCallback(
    (message: string | null) => {
      authStorage.clear();
      queryClient.clear();
      setUser(null);
      setStatus("anonymous");
      setSessionMessage(message);
    },
    [queryClient],
  );

  const applySession = useCallback((session: AuthResponse) => {
    authStorage.setTokens(session.accessToken, session.refreshToken);
    authStorage.setLastActivityAt(Date.now());
    setUser(session.user);
    setStatus("authenticated");
    setSessionMessage(null);
  }, []);

  useEffect(() => {
    if (status !== "loading") {
      return;
    }

    api
      .get<MeResponse>("/auth/me")
      .then(({ data }) => {
        setUser(data.user);
        setStatus("authenticated");
      })
      .catch(() => endSession(null));
  }, [endSession, status]);

  useEffect(
    () =>
      onSessionEvent((event) => {
        if (event.type === "expired") {
          endSession(event.message);
        } else {
          setUser((current) => (current ? { ...current, mustChangePassword: true } : current));
        }
      }),
    [endSession],
  );

  const login = useCallback(
    async (phone: string, password: string) => {
      const { data } = await api.post<AuthResponse>("/auth/login", { phone, password });
      applySession(data);
      return data.user;
    },
    [applySession],
  );

  const logout = useCallback(
    async (message?: string) => {
      const refreshToken = authStorage.getRefreshToken();
      endSession(message ?? null);

      if (refreshToken) {
        await api.post("/auth/logout", { refreshToken }).catch(() => undefined);
      }
    },
    [endSession],
  );

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, sessionMessage, login, logout, applySession }),
    [applySession, login, logout, sessionMessage, status, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
