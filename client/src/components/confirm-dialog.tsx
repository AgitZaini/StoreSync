import { useState } from "react";
import type { ReactNode } from "react";
import { getErrorMessage } from "../lib/api";
import { cn } from "../lib/utils";
import { Dialog, DialogActions } from "./dialog";
import { TextArea } from "./form-controls";
import { buttonStyles } from "./styles";
import { Field, Notice } from "./ui";

/** Konfirmasi aksi penting; bila `reasonLabel` diisi, alasan wajib ditulis (AB-14: tercatat di riwayat). */
export function ConfirmDialog({
  open,
  onClose,
  title,
  message,
  confirmLabel,
  tone = "primary",
  reasonLabel,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  tone?: "primary" | "danger";
  reasonLabel?: string;
  onConfirm: (reason: string) => Promise<unknown>;
}) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const reasonMissing = Boolean(reasonLabel) && reason.trim().length < 3;

  const close = () => {
    setReason("");
    setError(null);
    onClose();
  };

  const confirm = async () => {
    setPending(true);
    setError(null);

    try {
      await onConfirm(reason.trim());
      close();
    } catch (confirmError) {
      setError(getErrorMessage(confirmError));
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onClose={close} title={title}>
      <div className="space-y-4">
        <div className="text-sm leading-relaxed text-muted">{message}</div>
        {reasonLabel ? (
          <Field label={reasonLabel}>
            <TextArea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} />
          </Field>
        ) : null}
        {error ? <Notice tone="red">{error}</Notice> : null}
      </div>
      <DialogActions>
        <button type="button" onClick={close} className={buttonStyles.secondary}>
          Batal
        </button>
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={pending || reasonMissing}
          className={cn(tone === "danger" ? buttonStyles.dangerSolid : buttonStyles.primary)}
        >
          {pending ? "Memproses..." : confirmLabel}
        </button>
      </DialogActions>
    </Dialog>
  );
}
