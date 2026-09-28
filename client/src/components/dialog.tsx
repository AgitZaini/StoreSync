import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../lib/utils";

/**
 * Dialog modal memakai elemen `<dialog>` bawaan (fokus terkunci, Esc menutup).
 * Di HP tampil sebagai bottom sheet, di layar lebar di tengah.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;

    if (!dialog) {
      return;
    }

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) {
          onClose();
        }
      }}
      className={cn(
        "fixed inset-x-0 bottom-0 top-auto m-0 max-h-[92dvh] w-full max-w-full overflow-hidden rounded-t-3xl border border-line bg-white p-0 text-ink shadow-pop backdrop:bg-ink/40 backdrop:backdrop-blur-[2px]",
        "sm:inset-0 sm:m-auto sm:max-h-[88dvh] sm:w-[calc(100%-2rem)] sm:rounded-3xl",
        wide ? "sm:max-w-2xl" : "sm:max-w-lg",
      )}
    >
      {open ? (
        <div className="flex max-h-[inherit] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold tracking-tight text-ink">{title}</h2>
              {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 shrink-0 place-items-center rounded-lg text-subtle hover:bg-canvas hover:text-ink"
              aria-label="Tutup"
            >
              <X className="size-[18px]" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:px-6">{children}</div>
        </div>
      ) : null}
    </dialog>
  );
}

/** Baris tombol di bagian bawah form dalam dialog. */
export function DialogActions({ children }: { children: ReactNode }) {
  return <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{children}</div>;
}
