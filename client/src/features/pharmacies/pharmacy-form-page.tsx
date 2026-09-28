import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, KeyRound, LocateFixed, Power, RefreshCw, Store, UserRound } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { Link, useNavigate, useParams } from "react-router-dom";
import { z } from "zod";
import { PharmacyStatusPill, UserStatusPill } from "../../components/badges";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { CredentialSummary } from "../../components/copy-button";
import { Dialog, DialogActions } from "../../components/dialog";
import { TextArea, TextInput } from "../../components/form-controls";
import { buttonStyles } from "../../components/styles";
import { useToast } from "../../components/toast-context";
import { Card, EmptyState, Field, Notice, PageHeader, Pill, Spinner } from "../../components/ui";
import { getErrorMessage } from "../../lib/api";
import { formatDateTime, formatPhone } from "../../lib/format";
import { generateTemporaryPassword } from "../../lib/password";
import { cn } from "../../lib/utils";
import { newPasswordField, phoneField } from "../../lib/validation";
import type { Pharmacy } from "../../types/master-data";
import { AuditTimeline } from "../audit-log/audit-timeline";
import { ResetPasswordDialog } from "../users/user-dialogs";
import type { Coordinates } from "./map-picker";
import { usePharmacy, useSavePharmacy, useUpdatePharmacyStatus } from "./pharmacies-api";

// Leaflet cukup besar; hanya dimuat di halaman form apotek.
const MapPicker = lazy(() => import("./map-picker"));

const OUTSIDE_INDONESIA = "Titik lokasi harus berada di Indonesia";

const pharmacySchema = z
  .object({
    name: z.string().trim().min(2, "Nama apotek minimal 2 karakter"),
    address: z.string().trim().min(5, "Alamat minimal 5 karakter"),
    location: z
      .object({ latitude: z.number(), longitude: z.number() })
      .nullable()
      .refine((value) => value !== null, "Pilih titik lokasi apotek di peta")
      .refine(
        (value) => !value || (value.latitude >= -11.5 && value.latitude <= 6.5 && value.longitude >= 94.5 && value.longitude <= 141.5),
        OUTSIDE_INDONESIA,
      ),
    radiusM: z.number({ message: "Isi radius" }).int().min(10, "Radius minimal 10 m").max(500, "Radius maksimal 500 m"),
    is24h: z.boolean(),
    openTime: z.string(),
    closeTime: z.string(),
    kasirPhone: phoneField,
    kasirPassword: z.string(),
    isNew: z.boolean(),
  })
  .superRefine((values, ctx) => {
    if (!values.is24h && (!values.openTime || !values.closeTime || values.openTime === values.closeTime)) {
      ctx.addIssue({ code: "custom", path: ["openTime"], message: "Isi jam buka dan tutup yang berbeda, atau centang buka 24 jam" });
    }

    if (values.isNew && !newPasswordField.safeParse(values.kasirPassword).success) {
      ctx.addIssue({ code: "custom", path: ["kasirPassword"], message: "Minimal 8 karakter, berisi huruf dan angka" });
    }
  });

type PharmacyFormInput = z.input<typeof pharmacySchema>;
type PharmacyFormOutput = z.output<typeof pharmacySchema>;

const toFormValues = (pharmacy?: Pharmacy): PharmacyFormInput => ({
  name: pharmacy?.name ?? "",
  address: pharmacy?.address ?? "",
  location: pharmacy ? { latitude: pharmacy.latitude, longitude: pharmacy.longitude } : null,
  radiusM: pharmacy?.radiusM ?? 20,
  is24h: pharmacy?.is24h ?? false,
  openTime: pharmacy?.openTime ?? "08:00",
  closeTime: pharmacy?.closeTime ?? "21:00",
  kasirPhone: pharmacy?.kasir ? formatPhone(pharmacy.kasir.phone) : "",
  kasirPassword: pharmacy ? "" : generateTemporaryPassword(),
  isNew: !pharmacy,
});

/** "-6.2, 106.8" (mis. disalin dari Google Maps) → koordinat. */
const parseCoordinates = (text: string): Coordinates | null => {
  const match = text.match(/(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)/);
  return match ? { latitude: Number(match[1]), longitude: Number(match[2]) } : null;
};

const roundCoordinate = (value: number) => Math.round(value * 1e6) / 1e6;

function LocationField({
  value,
  radiusM,
  onChange,
  error,
}: {
  value: Coordinates | null;
  radiusM: number;
  onChange: (coordinates: Coordinates) => void;
  error?: string;
}) {
  const [pasted, setPasted] = useState("");
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const setRounded = (coordinates: Coordinates) =>
    onChange({ latitude: roundCoordinate(coordinates.latitude), longitude: roundCoordinate(coordinates.longitude) });

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setLocateError("Perangkat ini tidak mendukung lokasi.");
      return;
    }

    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        setRounded({ latitude: position.coords.latitude, longitude: position.coords.longitude });
      },
      () => {
        setLocating(false);
        setLocateError("Lokasi tidak bisa diambil. Izinkan akses lokasi atau pilih titik di peta.");
      },
      { enableHighAccuracy: true, timeout: 15000 },
    );
  };

  const applyPasted = () => {
    const coordinates = parseCoordinates(pasted);

    if (coordinates) {
      setRounded(coordinates);
      setPasted("");
    }
  };

  return (
    <div className="grid gap-1.5">
      <span className="text-[13px] font-medium text-gray-700">Titik lokasi apotek</span>
      <p className="text-xs text-muted">Klik peta atau geser penanda ke pintu apotek. Lingkaran biru adalah radius absen.</p>
      <Suspense fallback={<div className="grid h-72 place-items-center rounded-2xl border border-line sm:h-96"><Spinner /></div>}>
        <MapPicker value={value} radiusM={radiusM} onChange={setRounded} />
      </Suspense>
      <div className="mt-1 flex flex-col gap-2 sm:flex-row">
        <TextInput
          value={pasted}
          onChange={(event) => setPasted(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              applyPasted();
            }
          }}
          onBlur={applyPasted}
          placeholder={value ? `${value.latitude}, ${value.longitude}` : "Tempel koordinat, mis. -6.1754, 106.8272"}
          aria-label="Koordinat"
        />
        <button type="button" onClick={useMyLocation} disabled={locating} className={cn(buttonStyles.secondary, "sm:w-auto")}>
          <LocateFixed />
          {locating ? "Mencari..." : "Lokasi saya"}
        </button>
      </div>
      {error || locateError ? (
        <span role="alert" className="text-xs font-medium text-red-600">
          {error ?? locateError}
        </span>
      ) : value ? (
        <span className="text-xs text-muted tabular-nums">
          {value.latitude}, {value.longitude}
        </span>
      ) : null}
    </div>
  );
}

function PharmacyForm({ pharmacy }: { pharmacy?: Pharmacy }) {
  const navigate = useNavigate();
  const showToast = useToast();
  const savePharmacy = useSavePharmacy(pharmacy?.id);
  const [created, setCreated] = useState<{ pharmacy: Pharmacy; password: string } | null>(null);
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<PharmacyFormInput, unknown, PharmacyFormOutput>({
    resolver: zodResolver(pharmacySchema),
    // Form di-remount (key = updatedAt) saat data apotek berubah, jadi nilai awal cukup dibaca sekali.
    defaultValues: toFormValues(pharmacy),
  });
  const is24h = useWatch({ control, name: "is24h" });
  const radiusM = useWatch({ control, name: "radiusM" });

  const onSubmit = handleSubmit(async ({ location, kasirPassword, isNew, ...values }) => {
    const saved = await savePharmacy.mutateAsync({
      ...values,
      latitude: location.latitude,
      longitude: location.longitude,
      openTime: values.is24h ? null : values.openTime,
      closeTime: values.is24h ? null : values.closeTime,
      ...(isNew ? { kasirPassword } : {}),
    });

    if (isNew) {
      setCreated({ pharmacy: saved, password: kasirPassword });
    } else {
      showToast("Data apotek disimpan");
    }
  });

  return (
    <Card>
      <form onSubmit={onSubmit} noValidate className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Nama apotek" error={errors.name?.message}>
            <TextInput {...register("name")} invalid={Boolean(errors.name)} />
          </Field>
          <Field label="Radius absen (meter)" error={errors.radiusM?.message} hint="Bawaan 20 m (AB-02).">
            <TextInput
              {...register("radiusM", { valueAsNumber: true })}
              type="number"
              inputMode="numeric"
              min={10}
              max={500}
              invalid={Boolean(errors.radiusM)}
            />
          </Field>
        </div>
        <Field label="Alamat" error={errors.address?.message}>
          <TextArea {...register("address")} rows={2} className="min-h-0" invalid={Boolean(errors.address)} />
        </Field>

        <Controller
          control={control}
          name="location"
          render={({ field, fieldState }) => (
            <LocationField
              value={field.value}
              radiusM={Number.isFinite(radiusM) ? radiusM : 20}
              onChange={(coordinates) => field.onChange(coordinates)}
              error={fieldState.error?.message}
            />
          )}
        />

        <div className="grid gap-1.5">
          <span className="text-[13px] font-medium text-gray-700">Jam buka (WIB)</span>
          <label className="flex items-center gap-2.5 text-sm text-ink">
            <input type="checkbox" {...register("is24h")} className="size-4 rounded border-line accent-brand-600" />
            Buka 24 jam
          </label>
          {!is24h ? (
            <div className="grid grid-cols-2 gap-3">
              <TextInput {...register("openTime")} type="time" aria-label="Jam buka" invalid={Boolean(errors.openTime)} />
              <TextInput {...register("closeTime")} type="time" aria-label="Jam tutup" invalid={Boolean(errors.openTime)} />
            </div>
          ) : null}
          {errors.openTime ? (
            <span role="alert" className="text-xs font-medium text-red-600">
              {errors.openTime.message}
            </span>
          ) : null}
        </div>

        <div className="rounded-2xl border border-line p-4">
          <p className="text-sm font-semibold text-ink">Akun Kasir Apotek</p>
          <p className="mt-0.5 text-xs text-muted">
            Satu akun dipakai bersama kasir apotek untuk menyetujui penjualan dan retur SPG.
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Nomor HP untuk login kasir" error={errors.kasirPhone?.message}>
              <TextInput {...register("kasirPhone")} type="tel" inputMode="tel" placeholder="0812-3456-7890" invalid={Boolean(errors.kasirPhone)} />
            </Field>
            {!pharmacy ? (
              <Field label="Kata sandi sementara" error={errors.kasirPassword?.message}>
                <span className="flex gap-2">
                  <TextInput {...register("kasirPassword")} className="font-mono" invalid={Boolean(errors.kasirPassword)} autoComplete="off" />
                  <button
                    type="button"
                    onClick={() => setValue("kasirPassword", generateTemporaryPassword(), { shouldValidate: true })}
                    className={buttonStyles.secondary}
                    aria-label="Buat kata sandi baru"
                  >
                    <RefreshCw />
                  </button>
                </span>
              </Field>
            ) : null}
          </div>
        </div>

        {savePharmacy.error ? <Notice tone="red">{getErrorMessage(savePharmacy.error)}</Notice> : null}

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Link to="/apotek" className={buttonStyles.secondary}>
            {pharmacy ? "Kembali" : "Batal"}
          </Link>
          <button type="submit" disabled={isSubmitting || (pharmacy && !isDirty)} className={buttonStyles.primary}>
            {isSubmitting ? "Menyimpan..." : pharmacy ? "Simpan perubahan" : "Daftarkan apotek"}
          </button>
        </div>
      </form>

      <Dialog
        open={Boolean(created)}
        onClose={() => navigate(`/apotek/${created?.pharmacy.id}`)}
        title="Apotek terdaftar"
        description={created?.pharmacy.name}
      >
        {created?.pharmacy.kasir ? (
          <>
            <p className="mb-4 text-sm text-muted">Berikan akun ini ke kasir apotek:</p>
            <CredentialSummary phone={formatPhone(created.pharmacy.kasir.phone)} password={created.password} />
          </>
        ) : null}
        <DialogActions>
          <button type="button" onClick={() => navigate(`/apotek/${created?.pharmacy.id}`)} className={buttonStyles.primary}>
            Lihat apotek
          </button>
        </DialogActions>
      </Dialog>
    </Card>
  );
}

function PharmacySideCards({ pharmacy }: { pharmacy: Pharmacy }) {
  const updateStatus = useUpdatePharmacyStatus(pharmacy.id);
  const showToast = useToast();
  const [togglingStatus, setTogglingStatus] = useState(false);
  const [resettingKasir, setResettingKasir] = useState(false);
  const deactivating = pharmacy.status === "ACTIVE";

  return (
    <>
      <Card title="Status">
        <div className="flex items-center justify-between gap-3">
          <PharmacyStatusPill status={pharmacy.status} />
          {pharmacy.status !== "PROSPECT" ? (
            <button
              type="button"
              onClick={() => setTogglingStatus(true)}
              className={cn(deactivating ? buttonStyles.danger : buttonStyles.secondary, buttonStyles.small)}
            >
              <Power />
              {deactivating ? "Nonaktifkan" : "Aktifkan"}
            </button>
          ) : null}
        </div>
        {deactivating && pharmacy.placements.length > 0 ? (
          <p className="mt-3 text-xs text-muted">Lepas semua penempatan SPG sebelum menonaktifkan apotek.</p>
        ) : null}
      </Card>

      {pharmacy.kasir ? (
        <Card
          title="Akun kasir"
          action={
            <button type="button" onClick={() => setResettingKasir(true)} className={cn(buttonStyles.secondary, buttonStyles.small)}>
              <KeyRound />
              Reset sandi
            </button>
          }
        >
          <dl className="space-y-2.5 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Nomor HP</dt>
              <dd className="font-medium text-ink tabular-nums">{formatPhone(pharmacy.kasir.phone)}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Status</dt>
              <dd className="flex flex-wrap justify-end gap-1.5">
                <UserStatusPill status={pharmacy.kasir.status} />
                {pharmacy.kasir.mustChangePassword ? <Pill tone="orange">Belum ganti sandi</Pill> : null}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-muted">Login terakhir</dt>
              <dd className="text-right font-medium text-ink">
                {pharmacy.kasir.lastLoginAt ? formatDateTime(pharmacy.kasir.lastLoginAt) : "Belum pernah"}
              </dd>
            </div>
          </dl>
          <ResetPasswordDialog
            open={resettingKasir}
            onClose={() => setResettingKasir(false)}
            userId={pharmacy.kasir.id}
            userName={pharmacy.kasir.name}
            phone={pharmacy.kasir.phone}
          />
        </Card>
      ) : null}

      <Card title={`SPG ditempatkan · ${pharmacy.placements.length}`}>
        {pharmacy.placements.length === 0 ? (
          <EmptyState icon={UserRound}>Belum ada SPG. Tempatkan SPG dari halaman detail SPG.</EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {pharmacy.placements.map((placement) => (
              <li key={placement.id}>
                <Link to={`/pengguna/${placement.spg.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:text-brand-600">
                  <span className="text-sm font-medium">{placement.spg.name}</span>
                  <span className="text-xs text-muted">sejak {formatDateTime(placement.startedAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmDialog
        open={togglingStatus}
        onClose={() => setTogglingStatus(false)}
        title={deactivating ? "Nonaktifkan apotek" : "Aktifkan apotek"}
        message={
          deactivating
            ? `${pharmacy.name} tidak bisa lagi dipakai untuk penempatan dan absen. Akun kasirnya ikut dinonaktifkan.`
            : `${pharmacy.name} dan akun kasirnya aktif kembali.`
        }
        confirmLabel={deactivating ? "Nonaktifkan" : "Aktifkan"}
        tone={deactivating ? "danger" : "primary"}
        onConfirm={async () => {
          await updateStatus.mutateAsync(deactivating ? "INACTIVE" : "ACTIVE");
          showToast(deactivating ? "Apotek dinonaktifkan" : "Apotek diaktifkan");
        }}
      />
    </>
  );
}

export function PharmacyFormPage() {
  const { id } = useParams();
  const pharmacy = usePharmacy(id);
  const isNew = !id;

  if (!isNew && pharmacy.isPending) {
    return (
      <div className="grid place-items-center py-20">
        <Spinner />
      </div>
    );
  }

  if (!isNew && !pharmacy.data) {
    return (
      <Card>
        <EmptyState icon={Store}>
          {getErrorMessage(pharmacy.error, "Apotek tidak ditemukan.")}{" "}
          <Link to="/apotek" className="text-brand-600 hover:underline">
            Kembali ke daftar apotek
          </Link>
        </EmptyState>
      </Card>
    );
  }

  return (
    <>
      <Link to="/apotek" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink">
        <ArrowLeft className="size-4" />
        Apotek
      </Link>
      <PageHeader
        title={pharmacy.data?.name ?? "Daftarkan apotek"}
        description={
          pharmacy.data
            ? pharmacy.data.address
            : "Titik lokasi dan radius dipakai untuk memeriksa absen SPG dan Team Leader. Akun kasir dibuat otomatis."
        }
      />

      {pharmacy.data ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,360px)]">
          <div className="min-w-0 space-y-5">
            <PharmacyForm key={pharmacy.data.updatedAt} pharmacy={pharmacy.data} />
            <Card title="Riwayat perubahan">
              <AuditTimeline filters={{ entity: "Pharmacy", entityId: pharmacy.data.id }} showEntity={false} />
            </Card>
          </div>
          <div className="min-w-0 space-y-5">
            <PharmacySideCards pharmacy={pharmacy.data} />
          </div>
        </div>
      ) : (
        <div className="max-w-4xl">
          <PharmacyForm />
        </div>
      )}
    </>
  );
}
