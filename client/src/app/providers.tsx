import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import type { ReactNode } from "react";
import { ToastProvider } from "../components/toast-provider";
import { AuthProvider } from "../features/auth/auth-provider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      // Error 4xx (akses ditolak, data tidak ada) tidak akan berubah bila diulang.
      retry: (failureCount, error) =>
        failureCount < 2 && !(isAxiosError(error) && error.response && error.response.status < 500),
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>{children}</ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
