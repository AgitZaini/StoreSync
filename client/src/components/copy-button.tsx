import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { buttonStyles } from "./styles";
import { cn } from "../lib/utils";

export function CopyButton({ text, label = "Salin" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 2000);
        });
      }}
      className={cn(buttonStyles.secondary, buttonStyles.small)}
    >
      {copied ? <Check /> : <Copy />}
      {copied ? "Tersalin" : label}
    </button>
  );
}

/** Ringkasan akun baru/sandi sementara untuk diserahkan ke pengguna. */
export function CredentialSummary({ phone, password }: { phone: string; password: string }) {
  const text = `Nomor HP: ${phone}\nKata sandi sementara: ${password}`;

  return (
    <div className="space-y-3">
      <dl className="space-y-2 rounded-2xl bg-canvas p-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Nomor HP</dt>
          <dd className="font-semibold text-ink tabular-nums">{phone}</dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-muted">Kata sandi sementara</dt>
          <dd className="font-mono font-semibold text-ink">{password}</dd>
        </div>
      </dl>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-muted">Pengguna wajib mengganti kata sandi ini saat login pertama.</p>
        <CopyButton text={text} />
      </div>
    </div>
  );
}
