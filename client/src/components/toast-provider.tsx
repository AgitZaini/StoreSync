import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "../lib/utils";
import { ToastContext } from "./toast-context";
import type { ToastTone } from "./toast-context";

type Toast = { id: number; message: string; tone: ToastTone };

let nextToastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, tone: ToastTone = "success") => {
    const id = ++nextToastId;
    setToasts((current) => [...current.slice(-2), { id, message, tone }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={showToast}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-4 top-4 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:bottom-6 sm:right-6 sm:top-auto sm:items-end"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === "error" ? "alert" : "status"}
            className={cn(
              "pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-2xl px-4 py-3 text-sm font-medium shadow-pop",
              toast.tone === "error" ? "bg-red-600 text-white" : "bg-ink text-white",
            )}
          >
            {toast.tone === "error" ? <XCircle className="size-4 shrink-0" /> : <CheckCircle2 className="size-4 shrink-0 text-green-400" />}
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
