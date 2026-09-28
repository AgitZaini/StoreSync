import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Copy, Package, Pencil, Plus, Target } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Dialog, DialogActions } from "../../components/dialog";
import { RupiahInput, TextInput } from "../../components/form-controls";
import { buttonStyles, iconButtonClass } from "../../components/styles";
import { Tabs } from "../../components/tabs";
import { useToast } from "../../components/toast-context";
import { Card, DataTable, EmptyState, Field, Notice, PageHeader, Pill, Spinner } from "../../components/ui";
import { api, getErrorMessage } from "../../lib/api";
import { currentMonth, formatCurrency, formatDateTime, formatMonth, shiftMonth } from "../../lib/format";
import { cn } from "../../lib/utils";
import type { Product, TargetRow, TargetsResponse } from "../../types/master-data";
import { useProducts, useSaveProduct, useSaveTargets, useTargets } from "./products-api";

const productSchema = z.object({
  code: z
    .string()
    .trim()
    .min(1, "Kode wajib diisi")
    .regex(/^[A-Za-z0-9._-]+$/, "Hanya huruf, angka, titik, strip, atau garis bawah"),
  name: z.string().trim().min(2, "Nama minimal 2 karakter"),
  unit: z.string().trim().min(1, "Satuan wajib diisi"),
  price: z
    .number()
    .int()
    .min(0)
    .nullable()
    .refine((price) => price !== null, "Harga wajib diisi"),
  isActive: z.boolean(),
});

type ProductFormInput = z.input<typeof productSchema>;
type ProductFormOutput = z.output<typeof productSchema>;

function ProductDialog({ open, onClose, product }: { open: boolean; onClose: () => void; product?: Product }) {
  const saveProduct = useSaveProduct();
  const showToast = useToast();
  const defaults: ProductFormInput = {
    code: product?.code ?? "",
    name: product?.name ?? "",
    unit: product?.unit ?? "",
    price: product ? Number(product.price) : null,
    isActive: product?.isActive ?? true,
  };
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormInput, unknown, ProductFormOutput>({ resolver: zodResolver(productSchema), defaultValues: defaults });

  const close = () => {
    saveProduct.reset();
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    await saveProduct.mutateAsync({ productId: product?.id, ...values });
    showToast(product ? "Produk disimpan" : "Produk ditambahkan");
    close();
  });

  return (
    <Dialog open={open} onClose={close} title={product ? "Ubah produk" : "Tambah produk"}>
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-[160px_minmax(0,1fr)]">
          <Field label="Kode" error={errors.code?.message}>
            <TextInput {...register("code")} className="uppercase" invalid={Boolean(errors.code)} />
          </Field>
          <Field label="Nama produk" error={errors.name?.message}>
            <TextInput {...register("name")} invalid={Boolean(errors.name)} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Satuan" error={errors.unit?.message} hint="Misalnya botol, strip, kotak.">
            <TextInput {...register("unit")} invalid={Boolean(errors.unit)} />
          </Field>
          <Field label="Harga jual" error={errors.price?.message} hint="Dipakai menghitung omzet.">
            <Controller
              control={control}
              name="price"
              render={({ field }) => (
                <RupiahInput value={field.value} onChange={field.onChange} invalid={Boolean(errors.price)} />
              )}
            />
          </Field>
        </div>
        {product ? (
          <label className="flex items-center gap-2.5 text-sm text-ink">
            <input type="checkbox" {...register("isActive")} className="size-4 accent-brand-600" />
            Produk aktif (bisa dipesan dan dilaporkan)
          </label>
        ) : null}
        {product && Number(product.price) > 0 ? (
          <p className="text-xs text-muted">Perubahan harga tidak mengubah laporan penjualan yang sudah tercatat.</p>
        ) : null}
        {saveProduct.error ? <Notice tone="red">{getErrorMessage(saveProduct.error)}</Notice> : null}
        <DialogActions>
          <button type="button" onClick={close} className={buttonStyles.secondary}>
            Batal
          </button>
          <button type="submit" disabled={isSubmitting} className={buttonStyles.primary}>
            {isSubmitting ? "Menyimpan..." : "Simpan"}
          </button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

function ProductsPanel({ creating, onCloseCreate }: { creating: boolean; onCloseCreate: () => void }) {
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const products = useProducts({ includeInactive: showInactive });

  return (
    <Card
      action={
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} className="size-4 accent-brand-600" />
          Tampilkan nonaktif
        </label>
      }
      title={`${products.data?.length ?? 0} produk`}
    >
      {products.isPending ? (
        <div className="grid place-items-center py-12">
          <Spinner />
        </div>
      ) : products.data?.length === 0 ? (
        <EmptyState icon={Package}>Belum ada produk. Tambahkan produk beserta harga jualnya.</EmptyState>
      ) : (
        <DataTable
          minWidth="min-w-[640px]"
          headers={["Kode", "Produk", "Satuan", "Harga jual", "Status", ""]}
          rows={(products.data ?? []).map((product) => [
            <span key="code" className="font-mono text-xs">
              {product.code}
            </span>,
            <span key="name" className="font-medium text-ink">
              {product.name}
            </span>,
            product.unit,
            formatCurrency(product.price),
            product.isActive ? <Pill key="status" tone="green">Aktif</Pill> : <Pill key="status" tone="gray">Nonaktif</Pill>,
            <button key="edit" type="button" onClick={() => setEditing(product)} className={cn(buttonStyles.ghost, buttonStyles.small)}>
              <Pencil />
              Ubah
            </button>,
          ])}
        />
      )}
      {creating ? <ProductDialog open onClose={onCloseCreate} /> : null}
      {editing ? <ProductDialog key={editing.id} open onClose={() => setEditing(null)} product={editing} /> : null}
    </Card>
  );
}

const toDraft = (targets: TargetRow[]) =>
  Object.fromEntries(targets.map((target) => [target.spg.id, target.amount === null ? null : Number(target.amount)]));

function TargetsTable({ month, data }: { month: string; data: TargetsResponse }) {
  const saveTargets = useSaveTargets(month);
  const queryClient = useQueryClient();
  const showToast = useToast();
  const [draft, setDraft] = useState<Record<string, number | null>>(() => toDraft(data.targets));
  const [copyError, setCopyError] = useState<string | null>(null);
  const original = toDraft(data.targets);
  const changed = data.targets.filter((target) => draft[target.spg.id] !== original[target.spg.id]);
  const draftTotal = Object.values(draft).reduce<number>((sum, amount) => sum + (amount ?? 0), 0);

  const copyPreviousMonth = async () => {
    setCopyError(null);
    const previousMonth = shiftMonth(month, -1);

    try {
      const previous = await queryClient.fetchQuery({
        queryKey: ["targets", previousMonth],
        queryFn: async () => (await api.get<TargetsResponse>("/targets", { params: { month: previousMonth } })).data,
      });
      const previousAmounts = toDraft(previous.targets);
      setDraft((current) =>
        Object.fromEntries(
          Object.entries(current).map(([spgId, amount]) => [spgId, previousAmounts[spgId] ?? amount]),
        ),
      );
    } catch (error) {
      setCopyError(getErrorMessage(error));
    }
  };

  const save = () =>
    saveTargets.mutate(
      changed.map((target) => ({ spgId: target.spg.id, amount: draft[target.spg.id] })),
      { onSuccess: () => showToast(`Target ${formatMonth(month)} disimpan`) },
    );

  if (data.targets.length === 0) {
    return <EmptyState icon={Target}>Belum ada SPG aktif untuk diberi target.</EmptyState>;
  }

  return (
    <>
      <DataTable
        emphasizeFirst={false}
        minWidth="min-w-[560px]"
        headers={["SPG", "Target omzet", "Terakhir diubah"]}
        rows={data.targets.map((target) => [
          <span key="spg" className="block">
            <span className="block font-medium text-ink">{target.spg.name}</span>
            <span className="block text-xs text-muted">
              {target.spg.team?.name ?? "Tanpa tim"}
              {target.spg.status === "INACTIVE" ? " · nonaktif" : ""}
            </span>
          </span>,
          <span key="amount" className="block w-48">
            <RupiahInput
              value={draft[target.spg.id] ?? null}
              onChange={(amount) => setDraft((current) => ({ ...current, [target.spg.id]: amount }))}
              aria-label={`Target ${target.spg.name}`}
              placeholder="Belum diatur"
            />
          </span>,
          target.updatedAt ? formatDateTime(target.updatedAt) : "-",
        ])}
      />
      <div className="mt-5 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          Total target <span className="font-semibold text-ink tabular-nums">{formatCurrency(draftTotal)}</span>
          {changed.length > 0 ? <span className="text-orange-600"> · {changed.length} belum disimpan</span> : null}
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => void copyPreviousMonth()} className={buttonStyles.secondary}>
            <Copy />
            Salin dari {formatMonth(shiftMonth(month, -1))}
          </button>
          <button type="button" onClick={save} disabled={changed.length === 0 || saveTargets.isPending} className={buttonStyles.primary}>
            {saveTargets.isPending ? "Menyimpan..." : "Simpan target"}
          </button>
        </div>
      </div>
      {copyError || saveTargets.error ? (
        <div className="mt-3">
          <Notice tone="red">{copyError ?? getErrorMessage(saveTargets.error)}</Notice>
        </div>
      ) : null}
    </>
  );
}

function TargetsPanel() {
  const [month, setMonth] = useState(currentMonth);
  const targets = useTargets(month);

  return (
    <Card
      title={
        <span className="flex items-center gap-1">
          <button type="button" onClick={() => setMonth(shiftMonth(month, -1))} className={cn(iconButtonClass, "size-8")} aria-label="Bulan sebelumnya">
            <ChevronLeft className="size-4" />
          </button>
          <span className="min-w-36 text-center">{formatMonth(month)}</span>
          <button type="button" onClick={() => setMonth(shiftMonth(month, 1))} className={cn(iconButtonClass, "size-8")} aria-label="Bulan berikutnya">
            <ChevronRight className="size-4" />
          </button>
        </span>
      }
      action={<span className="hidden text-xs text-muted sm:inline">Target omzet per SPG per bulan (AKN-04)</span>}
    >
      {targets.isPending ? (
        <div className="grid place-items-center py-12">
          <Spinner />
        </div>
      ) : targets.data ? (
        <TargetsTable key={`${month}-${targets.dataUpdatedAt}`} month={month} data={targets.data} />
      ) : (
        <Notice tone="red">{getErrorMessage(targets.error)}</Notice>
      )}
    </Card>
  );
}

export function ProductsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab") === "target" ? "targets" : "products";
  const [creating, setCreating] = useState(false);

  return (
    <>
      <PageHeader
        title="Produk & Target"
        description="Produk yang dijual SPG beserta harga jualnya, dan target omzet bulanan setiap SPG."
        actions={
          tab === "products" ? (
            <button type="button" onClick={() => setCreating(true)} className={buttonStyles.primary}>
              <Plus />
              Tambah produk
            </button>
          ) : null
        }
      />
      <Tabs
        tabs={[
          { key: "products", label: "Produk" },
          { key: "targets", label: "Target omzet" },
        ]}
        value={tab}
        onChange={(key) => setSearchParams(key === "targets" ? { tab: "target" } : {}, { replace: true })}
      />
      {tab === "products" ? <ProductsPanel creating={creating} onCloseCreate={() => setCreating(false)} /> : <TargetsPanel />}
    </>
  );
}
