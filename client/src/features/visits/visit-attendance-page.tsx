import { CalendarRange, Clock, Flag, LogIn, LogOut, MapPin, Search, Store } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CameraCapture } from "../../components/camera-capture";
import type { CapturedPhoto } from "../../components/camera-capture";
import { ConfirmDialog } from "../../components/confirm-dialog";
import { Dialog, DialogActions } from "../../components/dialog";
import { TextInput } from "../../components/form-controls";
import { LocationBanner } from "../../components/location-banner";
import { buttonStyles } from "../../components/styles";
import { useToast } from "../../components/toast-context";
import { BusyOverlay, Card, EmptyState, Notice, PageHeader, Pill, Spinner } from "../../components/ui";
import { useLiveLocation } from "../../hooks/use-live-location";
import type { LivePosition } from "../../hooks/use-live-location";
import { getErrorCode, getErrorMessage } from "../../lib/api";
import { loadFaceLandmarker } from "../../lib/face-liveness";
import { formatDistance, formatDuration, formatLongDate, formatTime } from "../../lib/format";
import { distanceInMeters } from "../../lib/geo";
import { uploadFile } from "../../lib/upload";
import { cn } from "../../lib/utils";
import type { AttendanceKind } from "../../types/attendance";
import type { LeaderVisit, VisitTodayResponse, WorkDay } from "../../types/visits";
import { useCurrentUser } from "../auth/auth-context";
import { usePharmacies } from "../pharmacies/pharmacies-api";
import { useEndWorkDay, useSubmitVisitAttendance, useVisitToday } from "./visits-api";

const KIND_LABEL: Record<AttendanceKind, string> = { CHECK_IN: "Absen masuk", CHECK_OUT: "Absen keluar" };
const REJECTION_CODES = new Set(["OUTSIDE_RADIUS", "LOW_ACCURACY", "FACE_CHECK_FAILED"]);
/** Tanpa pencarian, daftar "Apotek lain" hanya menampilkan yang terdekat. */
const NEARBY_LIMIT = 6;

type VisitTarget = { id: string; name: string; address: string; latitude: number; longitude: number; radiusM: number };

type Rejection = {
  target: VisitTarget;
  kind: AttendanceKind;
  message: string;
  details?: { distanceM?: number; radiusM?: number; accuracyM?: number };
};

type Flow =
  | { step: "idle" }
  | { step: "camera"; target: VisitTarget; kind: AttendanceKind }
  | { step: "submitting"; kind: AttendanceKind }
  | { step: "rejected"; rejection: Rejection };

const minutesBetween = (from: string, to: string) => Math.max(0, Math.floor((new Date(to).getTime() - new Date(from).getTime()) / 60_000));

function DistanceLine({ target, position }: { target: VisitTarget; position: LivePosition | null }) {
  if (!position) return <span className="text-muted">Menunggu lokasi...</span>;

  const distance = distanceInMeters(position, target);
  const inside = distance <= target.radiusM;

  return (
    <span className={inside ? "text-green-700" : "text-muted"}>
      {inside ? `Di dalam radius (${formatDistance(distance)})` : `${formatDistance(distance)} dari apotek`}
    </span>
  );
}

function WorkDayCard({
  workDay,
  openVisit,
  lastPing,
  onEndDay,
}: {
  workDay: WorkDay;
  openVisit: LeaderVisit | null;
  lastPing: VisitTodayResponse["lastPing"];
  onEndDay: () => void;
}) {
  const until = `${formatTime(workDay.endsAt)} WIB`;

  return (
    <Card>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-semibold text-ink">Sesi kerja hari ini</p>
            {workDay.status === "ACTIVE" ? (
              <Pill tone="green">Aktif</Pill>
            ) : workDay.status === "ENDED" ? (
              <Pill tone="gray">Selesai</Pill>
            ) : (
              <Pill tone="blue">Belum mulai</Pill>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            {workDay.status === "NOT_STARTED"
              ? `Dimulai saat absen masuk pertama. Lokasi live dikirim tiap 5 menit sampai Anda menekan Selesai hari ini atau pukul ${until}.`
              : workDay.status === "ACTIVE"
                ? `Mulai ${formatTime(workDay.startedAt!)} WIB · berakhir otomatis ${until}${lastPing ? ` · lokasi terakhir ${formatTime(lastPing.recordedAt)} WIB` : ""}`
                : workDay.endedAt
                  ? `Selesai ${formatTime(workDay.endedAt)} WIB. Absen masuk lagi akan membuka sesi kembali.`
                  : `Batas jam kerja ${until} sudah lewat; lokasi live tidak dikirim lagi.`}
          </p>
        </div>
        {workDay.status === "ACTIVE" ? (
          <div className="shrink-0">
            <button type="button" onClick={onEndDay} disabled={Boolean(openVisit)} className={cn(buttonStyles.secondary, "w-full sm:w-auto")}>
              <Flag />
              Selesai hari ini
            </button>
            {openVisit ? <p className="mt-1 text-xs text-orange-600">Absen keluar dulu dari {openVisit.pharmacy.name}.</p> : null}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function OpenVisitCard({
  visit,
  serverTime,
  position,
  busy,
  onCheckOut,
}: {
  visit: LeaderVisit;
  serverTime: string;
  position: LivePosition | null;
  busy: boolean;
  onCheckOut: () => void;
}) {
  return (
    <Card className="border-brand-200 bg-brand-50/40">
      <p className="text-xs font-semibold uppercase tracking-[0.06em] text-brand-600">Sedang berkunjung</p>
      <p className="mt-1 text-lg font-semibold text-ink">{visit.pharmacy.name}</p>
      <p className="text-xs text-muted">{visit.pharmacy.address}</p>
      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="inline-flex items-center gap-1.5 text-ink">
          <Clock className="size-4 text-brand-500" />
          Masuk {formatTime(visit.checkInAt)} WIB · {formatDuration(minutesBetween(visit.checkInAt, serverTime))}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-4 text-brand-500" />
          <DistanceLine target={visit.pharmacy} position={position} />
        </span>
      </p>
      <button type="button" disabled={busy || !position} onClick={onCheckOut} className={cn(buttonStyles.primary, "mt-4 h-12 w-full text-base")}>
        <LogOut />
        Absen keluar
      </button>
    </Card>
  );
}

function PharmacyRow({
  target,
  position,
  badge,
  action,
}: {
  target: VisitTarget;
  position: LivePosition | null;
  badge?: ReactNode;
  action: ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">{target.name}</span>
          {badge}
        </span>
        <span className="block truncate text-xs text-muted">{target.address}</span>
        <span className="mt-0.5 block text-xs">
          <DistanceLine target={target} position={position} />
        </span>
      </span>
      {action}
    </li>
  );
}

function RejectionDialog({ rejection, onRetake, onClose }: { rejection: Rejection; onRetake: () => void; onClose: () => void }) {
  const { details } = rejection;

  return (
    <Dialog open onClose={onClose} title="Absen kunjungan belum tercatat" description={rejection.target.name}>
      <div className="space-y-4">
        <Notice tone="red">{rejection.message}</Notice>
        {details?.distanceM !== undefined ? (
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-canvas px-3 py-2">
              <dt className="text-xs text-muted">Jarak ke apotek</dt>
              <dd className="font-semibold text-ink">{formatDistance(details.distanceM)}</dd>
            </div>
            <div className="rounded-xl bg-canvas px-3 py-2">
              <dt className="text-xs text-muted">Akurasi GPS</dt>
              <dd className="font-semibold text-ink">±{Math.round(details.accuracyM ?? 0)} m</dd>
            </div>
          </dl>
        ) : null}
        <p className="text-sm leading-relaxed text-muted">
          {details?.distanceM !== undefined
            ? "Coba lagi di dekat pintu atau jendela apotek."
            : "Coba lagi di tempat yang lebih terang dengan wajah menghadap kamera dan berkedip."}{" "}
          Bila apotek rencana tetap tidak bisa diabsen, isi alasannya di Rencana Kunjungan → Evaluasi.
        </p>
      </div>
      <DialogActions>
        <button type="button" onClick={onClose} className={buttonStyles.secondary}>
          Tutup
        </button>
        <button type="button" onClick={onRetake} className={buttonStyles.primary}>
          Ulangi absen
        </button>
      </DialogActions>
    </Dialog>
  );
}

function TodayVisits({ data }: { data: VisitTodayResponse }) {
  return (
    <Card title="Kunjungan hari ini" action={data.visits.length > 0 ? <span className="text-xs text-muted">Total {formatDuration(data.totalMinutes)}</span> : null}>
      {data.visits.length === 0 ? (
        <EmptyState icon={Clock}>Belum ada kunjungan hari ini.</EmptyState>
      ) : (
        <ol className="divide-y divide-line">
          {data.visits.map((visit) => (
            <li key={visit.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">{visit.pharmacy.name}</span>
                <span className="block text-xs text-muted">
                  {formatTime(visit.checkInAt)} – {visit.checkOutAt ? formatTime(visit.checkOutAt) : "sekarang"}
                </span>
              </span>
              {visit.durationMin !== null ? (
                <span className="shrink-0 text-xs font-medium tabular-nums text-ink">{formatDuration(visit.durationMin)}</span>
              ) : (
                <Pill tone="blue">Berlangsung</Pill>
              )}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** ABS-02: absen masuk/keluar di setiap apotek yang dikunjungi, dengan foto + lokasi; ABS-03: sesi kerja. */
export function VisitAttendancePage() {
  const user = useCurrentUser();
  const today = useVisitToday();
  const pharmacies = usePharmacies({ status: "ACTIVE" });
  const location = useLiveLocation();
  const submitVisit = useSubmitVisitAttendance();
  const endDay = useEndWorkDay();
  const showToast = useToast();
  const [flow, setFlow] = useState<Flow>({ step: "idle" });
  const [search, setSearch] = useState("");
  const [confirmingEnd, setConfirmingEnd] = useState(false);
  const position = location.status === "denied" ? null : location.position;

  useEffect(() => {
    void loadFaceLandmarker().catch(() => undefined);
  }, []);

  const cameraTarget = flow.step === "camera" ? flow.target : null;
  const cameraKind = flow.step === "camera" ? flow.kind : null;
  const stampLines = useCallback(
    () => [
      `${user.name} · Kunjungan ${cameraKind === "CHECK_OUT" ? "keluar" : "masuk"}`,
      `${cameraTarget?.name ?? ""} · ${new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "medium",
        timeZone: "Asia/Jakarta",
      }).format(new Date())} WIB`,
    ],
    [cameraTarget, cameraKind, user.name],
  );

  const data = today.data;
  const plannedIds = useMemo(() => new Set((data?.plan ?? []).map((item) => item.pharmacy.id)), [data]);
  const others = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = (pharmacies.data ?? [])
      .filter((pharmacy) => !plannedIds.has(pharmacy.id))
      .filter((pharmacy) => !query || `${pharmacy.name} ${pharmacy.address}`.toLowerCase().includes(query))
      .map((pharmacy) => ({ pharmacy, distance: position ? distanceInMeters(position, pharmacy) : null }))
      .sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0) || a.pharmacy.name.localeCompare(b.pharmacy.name));
    return query ? list : list.slice(0, NEARBY_LIMIT);
  }, [pharmacies.data, plannedIds, search, position]);

  const handleCapture = async (target: VisitTarget, kind: AttendanceKind, photo: CapturedPhoto) => {
    const current = location.position;
    setFlow({ step: "submitting", kind });

    try {
      if (!current) {
        showToast("Lokasi belum didapat. Coba lagi.", "error");
        setFlow({ step: "idle" });
        return;
      }

      if (!photo.faceCheck.passed) {
        setFlow({
          step: "rejected",
          rejection: { target, kind, message: "Verifikasi wajah tidak berhasil. Absen kunjungan membutuhkan wajah yang terdeteksi dan berkedip." },
        });
        return;
      }

      let photoFileId: string;
      try {
        photoFileId = (await uploadFile(photo.file, "ATTENDANCE_PHOTO")).id;
      } catch (uploadError) {
        showToast(getErrorMessage(uploadError, "Foto gagal diunggah. Periksa koneksi lalu coba lagi."), "error");
        setFlow({ step: "idle" });
        return;
      }

      submitVisit.mutate(
        {
          pharmacyId: target.id,
          kind,
          photoFileId,
          latitude: current.latitude,
          longitude: current.longitude,
          accuracyM: current.accuracyM,
          faceCheck: photo.faceCheck,
        },
        {
          onSuccess: (visit) => {
            showToast(
              kind === "CHECK_IN"
                ? `Absen masuk tercatat di ${target.name}`
                : `Absen keluar tercatat · ${formatDuration(visit.durationMin ?? 0)} di ${target.name}`,
            );
            setFlow({ step: "idle" });
          },
          onError: (error) => {
            const code = getErrorCode(error);
            if (code && REJECTION_CODES.has(code)) {
              const details = (error as { response?: { data?: { details?: Rejection["details"] } } }).response?.data?.details;
              setFlow({ step: "rejected", rejection: { target, kind, message: getErrorMessage(error), details } });
            } else {
              showToast(getErrorMessage(error), "error");
              setFlow({ step: "idle" });
            }
          },
        },
      );
    } finally {
      URL.revokeObjectURL(photo.previewUrl);
    }
  };

  const busy = flow.step !== "idle";
  const openVisit = data?.openVisit ?? null;
  const startCheckIn = (target: VisitTarget) => setFlow({ step: "camera", target, kind: "CHECK_IN" });
  const checkInButton = (target: VisitTarget, visited = false) => (
    <button
      type="button"
      disabled={busy || !position || Boolean(openVisit)}
      onClick={() => startCheckIn(target)}
      className={cn(visited ? buttonStyles.secondary : buttonStyles.primary, "w-full sm:w-auto")}
    >
      <LogIn />
      {visited ? "Kunjungi lagi" : "Absen masuk"}
    </button>
  );

  return (
    <>
      <PageHeader title="Absen Kunjungan" description={`${formatLongDate(new Date())} · jam memakai jam server (WIB)`} />

      {!data ? (
        <div className="grid place-items-center py-16">
          {today.error ? <Notice tone="red">{getErrorMessage(today.error)}</Notice> : <Spinner />}
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <div className="min-w-0 space-y-4">
            <WorkDayCard workDay={data.workDay} openVisit={openVisit} lastPing={data.lastPing} onEndDay={() => setConfirmingEnd(true)} />
            <LocationBanner location={location} maxAccuracyM={data.maxAccuracyM} />
            {data.missingReasons.count > 0 ? (
              <Notice>
                {data.missingReasons.count} apotek rencana tidak dikunjungi dan belum diberi alasan.{" "}
                <Link to={`/rencana-kunjungan?tab=evaluasi&minggu=${data.missingReasons.weekStart}`} className="font-semibold underline">
                  Isi alasan
                </Link>
              </Notice>
            ) : null}

            {openVisit ? (
              <OpenVisitCard
                visit={openVisit}
                serverTime={data.serverTime}
                position={position}
                busy={busy}
                onCheckOut={() => setFlow({ step: "camera", target: openVisit.pharmacy, kind: "CHECK_OUT" })}
              />
            ) : null}

            <Card
              title="Rencana hari ini"
              action={
                <Link to="/rencana-kunjungan" className="text-xs font-semibold text-brand-600 hover:text-brand-700">
                  Ubah rencana
                </Link>
              }
            >
              {data.plan.length === 0 ? (
                <EmptyState icon={CalendarRange}>Tidak ada apotek di rencana hari ini. Pilih dari daftar apotek lain di bawah.</EmptyState>
              ) : (
                <ul className="divide-y divide-line">
                  {data.plan.map((item) => (
                    <PharmacyRow
                      key={item.id}
                      target={item.pharmacy}
                      position={position}
                      badge={
                        <>
                          {item.visited ? <Pill tone="green">Dikunjungi</Pill> : null}
                          {item.addedAfterLock ? <Pill tone="orange">Tambahan</Pill> : null}
                        </>
                      }
                      action={openVisit?.pharmacy.id === item.pharmacy.id ? <Pill tone="blue">Sedang dikunjungi</Pill> : checkInButton(item.pharmacy, item.visited)}
                    />
                  ))}
                </ul>
              )}
              {openVisit ? <p className="mt-2 text-xs text-orange-600">Absen keluar dulu dari {openVisit.pharmacy.name} sebelum masuk apotek lain.</p> : null}
            </Card>

            <Card title="Apotek lain">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" />
                <TextInput value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari nama atau alamat apotek" className="pl-10" />
              </label>
              {!pharmacies.data ? (
                <div className="grid place-items-center py-8">
                  <Spinner />
                </div>
              ) : others.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted">Tidak ada apotek yang cocok.</p>
              ) : (
                <ul className="mt-2 divide-y divide-line">
                  {others.map(({ pharmacy }) => (
                    <PharmacyRow
                      key={pharmacy.id}
                      target={pharmacy}
                      position={position}
                      action={openVisit?.pharmacy.id === pharmacy.id ? <Pill tone="blue">Sedang dikunjungi</Pill> : checkInButton(pharmacy)}
                    />
                  ))}
                </ul>
              )}
              {!search && pharmacies.data && pharmacies.data.length - plannedIds.size > NEARBY_LIMIT ? (
                <p className="mt-2 text-xs text-muted">Menampilkan {NEARBY_LIMIT} apotek terdekat. Cari untuk apotek lainnya.</p>
              ) : null}
            </Card>
          </div>
          <div className="min-w-0 space-y-4">
            <TodayVisits data={data} />
            <Card>
              <div className="flex gap-3 text-sm text-muted">
                <Store className="size-5 shrink-0 text-brand-500" />
                <p>
                  Absen kunjungan memakai foto langsung dan lokasi dalam radius apotek, sama seperti absen SPG. Lama kunjungan dihitung otomatis dari
                  jam masuk sampai jam keluar.
                </p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {flow.step === "camera" ? (
        <CameraCapture
          title={`${KIND_LABEL[flow.kind]} · ${flow.target.name}`}
          stampLines={stampLines}
          fallback="retry"
          onClose={() => setFlow({ step: "idle" })}
          onCapture={(photo) => void handleCapture(flow.target, flow.kind, photo)}
        />
      ) : null}

      {flow.step === "submitting" ? <BusyOverlay label={`Mengirim ${KIND_LABEL[flow.kind].toLowerCase()}...`} /> : null}

      {flow.step === "rejected" ? (
        <RejectionDialog
          rejection={flow.rejection}
          onClose={() => setFlow({ step: "idle" })}
          onRetake={() => setFlow({ step: "camera", target: flow.rejection.target, kind: flow.rejection.kind })}
        />
      ) : null}

      <ConfirmDialog
        open={confirmingEnd}
        onClose={() => setConfirmingEnd(false)}
        title="Selesai hari ini?"
        message="Lokasi live berhenti dikirim. Bila masih ada kunjungan, absen masuk lagi akan membuka sesi kerja kembali."
        confirmLabel="Selesai hari ini"
        onConfirm={async () => {
          await endDay.mutateAsync();
          showToast("Hari kerja diselesaikan. Lokasi live berhenti.");
        }}
      />
    </>
  );
}
