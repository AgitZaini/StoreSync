import { Camera, Plus, Undo2 } from "lucide-react";
import { useRef, useState } from "react";
import { Dialog, DialogActions } from "../../components/dialog";
import { QuantityInput, SelectInput, TextArea } from "../../components/form-controls";
import { buttonStyles } from "../../components/styles";
import { useToast } from "../../components/toast-context";
import { Card, EmptyState, Field, Notice, PageHeader, Spinner } from "../../components/ui";
import { getErrorMessage } from "../../lib/api";
import { uploadFile } from "../../lib/upload";
import { cn } from "../../lib/utils";
import { usePharmacies } from "../pharmacies/pharmacies-api";
import { useAvailableStock, useReturns, useSubmitReturn } from "./sales-api";
import { ReturnCard } from "./sales-parts";

/** RTR-01: produk, jumlah (≤ stok tersedia), alasan, dan foto barang opsional. Tujuan selalu gudang pusat (AB-08). */
function NewReturnDialog({ onClose }: { onClose: () => void }) {
  const pharmacies = usePharmacies();
  const [pharmacyState, setPharmacyId] = useState("");
  const pharmacyId = pharmacyState || pharmacies.data?.[0]?.id || "";
  const available = useAvailableStock(pharmacyId || null);
  const submit = useSubmitReturn();
  const showToast = useToast();
  const fileInput = useRef<HTMLInputElement>(null);
  const [quantities, setQuantities] = useState<Record<string, number | null>>({});
  const [reason, setReason] = useState("");
  const [photo, setPhoto] = useState<{ file: File; previewUrl: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rows = available.data ?? [];
  const lines = rows.map((row) => ({ row, qty: quantities[row.product.id] ?? 0 })).filter((line) => line.qty > 0);
  const over = lines.some((line) => line.qty > line.row.available);

  const send = async () => {
    setError(null);
    try {
      let photoFileId: string | undefined;
      if (photo) {
        setUploading(true);
        photoFileId = (await uploadFile(photo.file, "RETURN_PHOTO")).id;
      }
      const created = await submit.mutateAsync({
        pharmacyId,
        reason: reason.trim(),
        photoFileId,
        items: lines.map((line) => ({ productId: line.row.product.id, qty: line.qty })),
      });
      showToast(`${created.code} dikirim ke kasir apotek`);
      onClose();
    } catch (sendError) {
      setError(getErrorMessage(sendError, "Foto gagal diunggah. Periksa koneksi lalu coba lagi."));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open onClose={onClose} title="Ajukan retur" description="Barang retur selalu kembali ke gudang pusat. Disetujui kasir, lalu Super Admin." wide>
      <div className="space-y-4">
        <Field label="Apotek">
          <SelectInput
            value={pharmacyId}
            onChange={(event) => {
              setPharmacyId(event.target.value);
              setQuantities({});
            }}
          >
            {(pharmacies.data ?? []).map((pharmacy) => (
              <option key={pharmacy.id} value={pharmacy.id}>
                {pharmacy.name}
              </option>
            ))}
          </SelectInput>
        </Field>

        {!available.data ? (
          <div className="grid place-items-center py-8">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted">Tidak ada stok di apotek ini.</p>
        ) : (
          <ul className="max-h-[35vh] divide-y divide-line overflow-y-auto rounded-xl border border-line px-3">
            {rows.map((row) => {
              const qty = quantities[row.product.id] ?? null;
              return (
                <li key={row.product.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-ink">{row.product.name}</span>
                    <span className={cn("block text-xs", qty !== null && qty > row.available ? "text-red-600" : "text-muted")}>
                      Tersedia {row.available} {row.product.unit}
                    </span>
                  </span>
                  <QuantityInput
                    value={qty}
                    max={row.available}
                    onChange={(value) => setQuantities((current) => ({ ...current, [row.product.id]: value }))}
                    placeholder="0"
                    aria-label={`Retur ${row.product.name}`}
                  />
                </li>
              );
            })}
          </ul>
        )}

        <Field label="Alasan retur" hint="Wajib, minimal 5 karakter.">
          <TextArea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={300} className="min-h-16" placeholder="Contoh: kemasan rusak, mendekati kedaluwarsa" />
        </Field>

        <div className="grid gap-1.5">
          <span className="text-[13px] font-medium text-gray-700">Foto barang (opsional)</span>
          {photo ? (
            <div className="flex items-center gap-3">
              <img src={photo.previewUrl} alt="Foto barang retur" className="size-20 rounded-xl object-cover" />
              <button type="button" onClick={() => setPhoto(null)} className={cn(buttonStyles.ghost, buttonStyles.small)}>
                Hapus foto
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => fileInput.current?.click()} className={cn(buttonStyles.secondary, "w-full sm:w-auto")}>
              <Camera />
              Foto barang
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) setPhoto({ file, previewUrl: URL.createObjectURL(file) });
              event.target.value = "";
            }}
          />
        </div>

        {over ? <Notice tone="red">Jumlah retur melebihi stok tersedia.</Notice> : null}
        {error ? <Notice tone="red">{error}</Notice> : null}
      </div>
      <DialogActions>
        <button type="button" onClick={onClose} className={buttonStyles.secondary}>
          Batal
        </button>
        <button
          type="button"
          disabled={!pharmacyId || lines.length === 0 || over || reason.trim().length < 5 || uploading || submit.isPending}
          onClick={() => void send()}
          className={buttonStyles.primary}
        >
          {uploading ? "Mengunggah foto..." : submit.isPending ? "Mengirim..." : `Ajukan retur (${lines.length} produk)`}
        </button>
      </DialogActions>
    </Dialog>
  );
}

/** RTR-01 untuk SPG: ajukan retur dan pantau statusnya sampai diterima gudang. */
export function ReturnPage() {
  const returns = useReturns({}, { live: true });
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="Retur"
        description="Kembalikan barang ke gudang pusat. Stok Anda berkurang saat Admin mengonfirmasi barang diterima."
        actions={
          <button type="button" onClick={() => setCreating(true)} className={buttonStyles.primary}>
            <Plus />
            Ajukan retur
          </button>
        }
      />
      {!returns.data ? (
        <div className="grid place-items-center py-16">
          {returns.error ? <Notice tone="red">{getErrorMessage(returns.error)}</Notice> : <Spinner />}
        </div>
      ) : returns.data.length === 0 ? (
        <Card>
          <EmptyState icon={Undo2}>Belum ada retur.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {returns.data.map((doc) => (
            <ReturnCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}
      {creating ? <NewReturnDialog onClose={() => setCreating(false)} /> : null}
    </>
  );
}
