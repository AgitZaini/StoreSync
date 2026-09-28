import axios, { isAxiosError } from "axios";
import type { InternalAxiosRequestConfig } from "axios";
import type { AuthResponse } from "../types/auth";
import { authStorage } from "./auth-storage";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:4000/api";

export const api = axios.create({ baseURL, timeout: 15000 });

type ApiErrorBody = { message?: string; code?: string };

/** Pesan error dari server, atau pesan umum bila server tidak terjangkau. */
export function getErrorMessage(error: unknown, fallback = "Terjadi kesalahan. Coba lagi.") {
  if (isAxiosError<ApiErrorBody>(error)) {
    if (!error.response) {
      return "Tidak dapat terhubung ke server. Periksa koneksi internet Anda.";
    }

    return error.response.data?.message ?? fallback;
  }

  return fallback;
}

export function getErrorCode(error: unknown) {
  return isAxiosError<ApiErrorBody>(error) ? error.response?.data?.code : undefined;
}

type SessionEvent = { type: "expired"; message: string } | { type: "password-change-required" };
type SessionListener = (event: SessionEvent) => void;

const sessionListeners = new Set<SessionListener>();

/** AuthProvider mendengarkan ini untuk mengeluarkan pengguna saat sesinya berakhir. */
export function onSessionEvent(listener: SessionListener) {
  sessionListeners.add(listener);
  return () => {
    sessionListeners.delete(listener);
  };
}

const emitSessionEvent = (event: SessionEvent) => sessionListeners.forEach((listener) => listener(event));

// Endpoint ini menangani 401-nya sendiri (mis. sandi salah) dan tidak boleh memicu logout.
const AUTH_ENDPOINTS = ["/auth/login", "/auth/refresh", "/auth/logout"];

let refreshInFlight: Promise<string> | null = null;

const refreshAccessToken = async () => {
  const refreshToken = authStorage.getRefreshToken();

  if (!refreshToken) {
    throw new Error("Tidak ada refresh token");
  }

  const { data } = await axios.post<AuthResponse>(`${baseURL}/auth/refresh`, { refreshToken }, { timeout: 15000 });
  authStorage.setTokens(data.accessToken, data.refreshToken);
  return data.accessToken;
};

api.interceptors.request.use((config) => {
  const token = authStorage.getAccessToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(undefined, async (error: unknown) => {
  if (!isAxiosError<ApiErrorBody>(error) || !error.response || !error.config) {
    throw error;
  }

  const request = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
  const { status, data } = error.response;

  if (AUTH_ENDPOINTS.some((endpoint) => request.url?.startsWith(endpoint))) {
    throw error;
  }

  if (status === 401 && data?.code === "ACCESS_TOKEN_EXPIRED" && !request._retried) {
    request._retried = true;

    try {
      // Beberapa request bisa kedaluwarsa bersamaan; semuanya menunggu satu refresh yang sama.
      refreshInFlight ??= refreshAccessToken().finally(() => {
        refreshInFlight = null;
      });
      request.headers.Authorization = `Bearer ${await refreshInFlight}`;
      return api(request);
    } catch (refreshError) {
      // Koneksi putus bukan alasan mengeluarkan pengguna; hanya penolakan dari server.
      const rejectedByServer = !isAxiosError(refreshError) || Boolean(refreshError.response);

      if (rejectedByServer) {
        emitSessionEvent({
          type: "expired",
          message: getErrorMessage(refreshError, "Sesi berakhir. Silakan masuk lagi."),
        });
      }

      throw refreshError;
    }
  }

  if (status === 401) {
    emitSessionEvent({ type: "expired", message: data?.message ?? "Sesi berakhir. Silakan masuk lagi." });
  } else if (status === 403 && data?.code === "PASSWORD_CHANGE_REQUIRED") {
    emitSessionEvent({ type: "password-change-required" });
  }

  throw error;
});
