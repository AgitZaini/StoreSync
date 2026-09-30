import { Camera, CheckCircle2, RefreshCw, XCircle } from "lucide-react";
import { useCallback, useState } from "react";
import type { ReactNode } from "react";
import { CameraCapture } from "../../components/camera-capture";
import type { CapturedPhoto } from "../../components/camera-capture";
import { Dialog, DialogActions } from "../../components/dialog";
import { TextArea, TextInput } from "../../components/form-controls";
import { StoredImage } from "../../components/stored-image";
import { buttonStyles } from "../../components/styles";
import { BusyOverlay, Card, Field, Notice, Pill } from "../../components/ui";
import { getErrorMessage } from "../../lib/api";
import { formatCurrency, formatDateTime } from "../../lib/format";
import { uploadFile } from "../../lib/upload";
import { cn } from "../../lib/utils";
import type { ApprovalView, CashierIdentity, ReturnDoc, SalesReport } from "../../types/sales";
import { APPROVAL_STEP, readCashierName, rememberCashierName, REPORT_STATUS, RETURN_STATUS } from "./sales-labels";

export function ReportStatusPill({ report }: { report: SalesReport }) {
  const status = REPORT_STATUS[report.status];
  return <Pill tone={status.tone}>{status.label}</Pill>;
}

export function ReturnStatusPill({ doc }: { doc: ReturnDoc }) {
  const status = RETURN_STATUS[doc.status];
  return (
    <span className="flex flex-wrap gap-1.5">
      <Pill tone={status.tone}>{status.label}</Pill>
      {doc.hasDiscrepancy ? <Pill tone="red">Ada selisih</Pill> : null}
    </span>
  );
}

/** Rincian laporan: jumlah × harga saat dikirim = subtotal, dan total omzet. */
export function SalesItems({ report }: { report: SalesReport }) {
  return (
    <div>
      <ul className="divide-y divide-line">
        {report.items.map((item) => (
          <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
            <span className="min-w-0">
              <span className="block truncate font-medium text-ink">{item.product.name}</span>
              <span className="block text-xs text-muted">
                {item.qty} {item.product.unit} × {formatCurrency(item.unitPrice)}
              </span>
            </span>
            <span className="shrink-0 font-medium tabular-nums text-ink">{formatCurrency(item.subtotal)}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 flex justify-between border-t border-line pt-2 text-sm font-semibold text-ink">
        <span>Total</span>
        <span className="tabular-nums">{formatCurrency(report.totalAmount)}</span>
      </p>
    </div>
  );
}

export function ReturnItems({ doc }: { doc: ReturnDoc }) {
  return (
    <ul className="divide-y divide-line">
      {doc.items.map((item) => (
        <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
          <span className="min-w-0 truncate font-medium text-ink">{item.product.name}</span>
          <span className="shrink-0 text-xs text-muted">
            <strong className="text-sm tabular-nums text-ink">{item.qty}</strong> {item.product.unit}
            {item.receivedQty !== null ? (
              <span className={cn("ml-2", item.receivedQty !== item.qty && "font-semibold text-red-600")}>diterima {item.receivedQty}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Jejak keputusan: siapa (nama kasir bila akun kasir), kapan, dan alasannya. Foto kasir hanya
 * ditampilkan untuk peran yang boleh membukanya (kasir sendiri, Admin, Super Admin).
 */
export function ApprovalTrail({ approvals, showPhotos = false }: { approvals: ApprovalView[]; showPhotos?: boolean }) {
  if (approvals.length === 0) return null;

  return (
    <ol className="space-y-2 border-l-2 border-line pl-3 text-xs">
      {approvals.map((approval) => (
        <li key={approval.id} className="flex items-start gap-2">
          {showPhotos && approval.cashierPhotoFileId ? (
            <StoredImage fileId={approval.cashierPhotoFileId} alt={`Foto kasir ${approval.cashierName}`} className="size-10 shrink-0 rounded-lg" />
          ) : null}
          <span className="min-w-0">
            <span className={cn("block", approval.decision === "REJECTED" ? "text-red-600" : "text-muted")}>
              {approval.decision === "APPROVED" ? "Disetujui" : "Ditolak"} {APPROVAL_STEP[approval.step]}{" "}
              {approval.cashierName ? <strong className="text-ink">{approval.cashierName}</strong> : approval.approver.name} ·{" "}
              {formatDateTime(approval.decidedAt)}
            </span>
            {approval.reason ? <span className="block text-ink">“{approval.reason}”</span> : null}
          </span>
        </li>
      ))}
    </ol>
  );
}

/**
 * JUL-03/RTR-02: keputusan kasir wajib nama + foto wajah langsung dari kamera (AB-07); menolak wajib
 * beralasan. Nama terakhir diingat di perangkat ini supaya kasir yang sama tidak mengetik ulang.
 */
export function CashierDecisionDialog({
  title,
  description,
  pharmacyName,
  mode,
  onSubmit,
  onClose,
}: {
  title: string;
  description: string;
  pharmacyName: string;
  mode: "approve" | "reject";
  onSubmit: (identity: CashierIdentity, reason?: string) => Promise<unknown>;
  onClose: () => void;
}) {
  const [name, setName] = useState(readCashierName);
  const [reason, setReason] = useState("");
  const [photo, setPhoto] = useState<CapturedPhoto | null>(null);
  const [camera, setCamera] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmedName = name.trim();
  const rejecting = mode === "reject";

  const stampLines = useCallback(
    () => [
      `Kasir ${trimmedName || "-"} · ${rejecting ? "Menolak" : "Menyetujui"}`,
      `${pharmacyName} · ${new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date())} WIB`,
    ],
    [trimmedName, rejecting, pharmacyName],
  );

  const submit = async () => {
    if (!photo) return;
    setBusy(true);
    setError(null);
    try {
      const file = await uploadFile(photo.file, "CASHIER_PHOTO");
      rememberCashierName(trimmedName);
      await onSubmit({ cashierName: trimmedName, cashierPhotoFileId: file.id, faceCheck: photo.faceCheck }, rejecting ? reason.trim() : undefined);
      URL.revokeObjectURL(photo.previewUrl);
      onClose();
    } catch (submitError) {
      setError(getErrorMessage(submitError, "Foto gagal diunggah. Periksa koneksi lalu coba lagi."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Dialog modal selalu di lapisan teratas; disembunyikan selama kamera terbuka supaya kamera terlihat. */}
      <Dialog open={!camera} onClose={onClose} title={title} description={description}>
        <div className="space-y-4">
          <Field label="Nama kasir" hint="Akun apotek dipakai bersama, jadi nama dan foto Anda dicatat.">
            <TextInput value={name} onChange={(event) => setName(event.target.value)} maxLength={80} placeholder="Nama Anda" autoComplete="name" />
          </Field>
          <div className="grid gap-1.5">
            <span className="text-[13px] font-medium text-gray-700">Foto wajah kasir</span>
            {photo ? (
              <div className="flex items-center gap-3">
                <img src={photo.previewUrl} alt="Foto kasir" className="h-24 w-18 rounded-xl object-cover" />
                <button type="button" onClick={() => setCamera(true)} className={cn(buttonStyles.secondary, buttonStyles.small)}>
                  <RefreshCw />
                  Ulangi foto
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setCamera(true)} disabled={trimmedName.length < 2} className={cn(buttonStyles.secondary, "w-full")}>
                <Camera />
                Ambil foto wajah
              </button>
            )}
            {trimmedName.length < 2 ? <span className="text-xs text-muted">Isi nama dulu sebelum mengambil foto.</span> : null}
          </div>
          {rejecting ? (
            <Field label="Alasan penolakan" hint="Dikirim ke SPG supaya bisa diperbaiki.">
              <TextArea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} className="min-h-20" />
            </Field>
          ) : null}
          {error ? <Notice tone="red">{error}</Notice> : null}
        </div>
        <DialogActions>
          <button type="button" onClick={onClose} className={buttonStyles.secondary}>
            Batal
          </button>
          <button
            type="button"
            disabled={!photo || trimmedName.length < 2 || (rejecting && reason.trim().length < 3) || busy}
            onClick={() => void submit()}
            className={rejecting ? buttonStyles.dangerSolid : buttonStyles.primary}
          >
            {rejecting ? <XCircle /> : <CheckCircle2 />}
            {rejecting ? "Tolak" : "Setujui"}
          </button>
        </DialogActions>
      </Dialog>

      {camera ? (
        <CameraCapture
          title="Foto wajah kasir"
          stampLines={stampLines}
          fallback="plain"
          onClose={() => setCamera(false)}
          onCapture={(captured) => {
            if (photo) URL.revokeObjectURL(photo.previewUrl);
            setPhoto(captured);
            setCamera(false);
          }}
        />
      ) : null}

      {busy ? <BusyOverlay label={rejecting ? "Mengirim penolakan..." : "Mengirim persetujuan..."} /> : null}
    </>
  );
}

export function ReturnCard({ doc, showSpg = false, showPhotos = false, children }: { doc: ReturnDoc; showSpg?: boolean; showPhotos?: boolean; children?: ReactNode }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-base font-semibold text-ink">{doc.code}</p>
          <p className="text-xs text-muted">
            {doc.pharmacy.name}
            {showSpg ? ` · ${doc.spg.name}` : ""} · diajukan {formatDateTime(doc.submittedAt)}
          </p>
        </div>
        <ReturnStatusPill doc={doc} />
      </div>
      <div className="mt-3 flex gap-3">
        {doc.photoFileId ? <StoredImage fileId={doc.photoFileId} alt="Foto barang retur" className="size-16 shrink-0 rounded-xl" /> : null}
        <p className="text-sm text-ink">“{doc.reason}”</p>
      </div>
      <div className="mt-2">
        <ReturnItems doc={doc} />
      </div>
      {doc.status === "SA_APPROVED" && !showSpg ? (
        <p className="mt-3 rounded-xl bg-violet-50 px-3 py-2 text-sm text-violet-700">Disetujui. Bawa/kirim barangnya ke gudang pusat; Admin akan mengonfirmasi penerimaan.</p>
      ) : null}
      {doc.status === "REJECTED" ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          Ditolak {doc.rejectedStep === "KASIR" ? "kasir" : "Super Admin"}: {doc.rejectReason}
        </p>
      ) : null}
      {doc.receivedAt ? (
        <p className="mt-3 text-xs text-muted">
          Diterima gudang {formatDateTime(doc.receivedAt)} oleh {doc.receivedBy?.name ?? "Admin"}
          {doc.receiveNote ? ` · “${doc.receiveNote}”` : ""}
        </p>
      ) : null}
      <div className="mt-3">
        <ApprovalTrail approvals={doc.approvals} showPhotos={showPhotos} />
      </div>
      {children}
    </Card>
  );
}

