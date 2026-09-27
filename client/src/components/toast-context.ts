import { createContext, useContext } from "react";

export type ToastTone = "success" | "error";
export type ShowToast = (message: string, tone?: ToastTone) => void;

export const ToastContext = createContext<ShowToast>(() => undefined);

/** Menampilkan pesan singkat setelah aksi berhasil atau gagal. */
export const useToast = () => useContext(ToastContext);
