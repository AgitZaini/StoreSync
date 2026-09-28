import { CheckCircle2, Clock, LocateFixed, LogIn, LogOut, MapPin, ScanFace } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { CameraCapture } from "../../components/camera-capture";
import type { CapturedPhoto } from "../../components/camera-capture";
import { Dialog, DialogActions } from "../../components/dialog";
import { TextArea } from "../../components/form-controls";
import { buttonStyles } from "../../components/styles";
import { useToast } from "../../components/toast-context";
import { Card, EmptyState, Field, Notice, PageHeader, Pill, Spinner } from "../../components/ui";
import { useLiveLocation } from "../../hooks/use-live-location";
import type { LivePosition } from "../../hooks/use-live-location";
import { getErrorCode, getErrorMessage } from "../../lib/api";
import { loadFaceLandmarker } from "../../lib/face-liveness";
import {
  formatBusinessDate,
  formatDistance,
  formatLongDate,
  formatOpeningHours,
  formatScheduleValue,
  formatTime,
  shiftDate,
  todayDate,
} from "../../lib/format";
import { distanceInMeters } from "../../lib/geo";
import { uploadFile } from "../../lib/upload";
import { cn } from "../../lib/utils";
import type { AttendanceKind, FaceCheck, TodayPharmacy } from "../../types/attendance";
import { useCurrentUser } from "../auth/auth-context";
import { useAttendanceHistory, useSubmitAttendance, useSubmitException, useTodayAttendance } from "./attendance-api";
import type { AttendancePayload } from "./attendance-api";
import { AttendanceStatusPill } from "./attendance-status-pill";

const KIND_LABEL: Record<AttendanceKind, string> = { CHECK_IN: "Absen masuk", CHECK_OUT: "Absen pulang" };

type Rejection = {
  payload: AttendancePayload;
  pharmacyName: string;
  message: string;
  details?: { distanceM?: number; radiusM?: number; accuracyM?: number };
};

type Flow =
  | { step: "idle" }
  | { step: "camera"; item: TodayPharmacy; kind: AttendanceKind }
  | { step: "submitting"; kind: AttendanceKind }
  | { step: "rejected"; rejection: Rejection };

const REJECTION_CODES = new Set(["OUTSIDE_RADIUS", "LOW_ACCURACY", "FACE_CHECK_FAILED"]);

function LocationBanner({ location, maxAccuracyM }: { location: ReturnType<typeof useLiveLocation>; maxAccuracyM: number }) {
  if (location.status === "ready" || (location.position && location.status !== "denied")) {
    const accuracy = Math.round(location.position!.accuracyM);
    const good = accuracy <= maxAccuracyM;

    return (
      <div className={cn("flex items-center gap-3 rounded-2xl px-4 py-3 text-sm", good ? "bg-green-50 text-green-800" : "bg-orange-50 text-orange-800")}>
        <LocateFixed className="size-5 shrink-0" />
        <span>
          Lokasi terkunci, akurasi <strong>±{accuracy} m</strong>
          {good ? "" : `. Tunggu sampai di bawah ±${maxAccuracyM} m (dekat pintu/jendela).`}
        </span>
      </div>
    );
  }

  if (location.status === "locating") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-canvas px-4 py-3 text-sm text-muted">
        <Spinner className="size-4" />
        Mencari lokasi GPS...
      </div>
    );
  }

  return <Notice tone="red">{location.message}</Notice>;
}

function PharmacyAttendanceCard({
  item,
  position,
  maxAccuracyM,
  blockedBy,
  busy,
  onStart,
}: {
  item: TodayPharmacy;
  position: LivePosition | null;
  maxAccuracyM: number;
  blockedBy: string | null;
  busy: boolean;
  onStart: (kind: AttendanceKind) => void;
}) {
  const { pharmacy } = item;
  const distance = position ? distanceInMeters(position, pharmacy) : null;
  const inside = distance !== null && distance <= pharmacy.radiusM;
  const pendingKinds = new Set(item.pendingExceptions.map((exception) => exception.kind));

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-semibold text-ink">{pharmacy.name}</p>
          <p className="mt-0.5 text-xs text-muted">{pharmacy.address}</p>
        </div>
        {item.status ? <AttendanceStatusPill status={item.status} lateMinutes={item.lateMinutes} /> : null}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-xl bg-canvas px-3 py-2">
          <dt className="text-xs text-muted">Jadwal hari ini</dt>
          <dd className="mt-0.5 font-medium text-ink">{item.schedule ? formatScheduleValue(item.schedule) : "Tidak ada jadwal"}</dd>
        </div>
        <div className="rounded-xl bg-canvas px-3 py-2">
          <dt className="text-xs text-muted">Jam apotek</dt>
          <dd className="mt-0.5 font-medium text-ink">{formatOpeningHours(pharmacy)}</dd>
        </div>
        <div className="rounded-xl bg-canvas px-3 py-2">
          <dt className="text-xs text-muted">Masuk</dt>
          <dd className="mt-0.5 font-medium text-ink">
            {item.checkIn ? `${formatTime(item.checkIn.serverAt)} WIB` : pendingKinds.has("CHECK_IN") ? "Menunggu Admin" : "-"}
          </dd>
        </div>
        <div className="rounded-xl bg-canvas px-3 py-2">
          <dt className="text-xs text-muted">Pulang</dt>
          <dd className="mt-0.5 font-medium text-ink">
            {item.checkOut ? `${formatTime(item.checkOut.serverAt)} WIB` : pendingKinds.has("CHECK_OUT") ? "Menunggu Admin" : "-"}
          </dd>
        </div>
      </dl>

      {item.nextAction ? (
        <>
          <p className={cn("mt-4 flex items-center gap-2 text-sm", distance === null ? "text-muted" : inside ? "text-green-700" : "text-red-600")}>
            <MapPin className="size-4 shrink-0" />
            {distance === null
              ? "Menunggu lokasi..."
              : inside
                ? `Anda di dalam radius (${formatDistance(distance)} dari apotek)`
                : `Anda ${formatDistance(distance)} dari apotek (maks. ${pharmacy.radiusM} m)`}
          </p>
          {blockedBy ? <p className="mt-2 text-xs text-orange-600">Absen pulang dulu dari {blockedBy}.</p> : null}
          <button
            type="button"
            disabled={busy || !position || Boolean(blockedBy)}
            onClick={() => onStart(item.nextAction!)}
            className={cn(buttonStyles.primary, "mt-4 h-12 w-full text-base")}
          >
            {item.nextAction === "CHECK_IN" ? <LogIn /> : <LogOut />}
            {KIND_LABEL[item.nextAction]}
          </button>
          {position && position.accuracyM > maxAccuracyM ? (
            <p className="mt-2 text-center text-xs text-muted">Akurasi GPS masih rendah; absen bisa ditolak.</p>
          ) : null}
        </>
      ) : (
        <p className="mt-4 flex items-center gap-2 text-sm font-medium text-green-700">
          <CheckCircle2 className="size-4" />
          {pendingKinds.size > 0 ? "Menunggu persetujuan Admin untuk pengecualian absen." : "Absen hari ini sudah lengkap."}
        </p>
      )}
    </Card>
  );
}

function RejectionDialog({
  rejection,
  onRetake,
  onClose,
}: {
  rejection: Rejection;
  onRetake: () => void;
  onClose: () => void;
}) {
  const submitException = useSubmitException();
  const showToast = useToast();
  const [reason, setReason] = useState("");
  const { details } = rejection;

  const submit = () =>
    submitException.mutate(
      { ...rejection.payload, reason: reason.trim() },
      {
        onSuccess: () => {
          showToast("Pengecualian dikirim ke Admin");
          onClose();
        },
      },
    );

  return (
    <Dialog open onClose={onClose} title="Absen belum tercatat" description={rejection.pharmacyName}>
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
            ? "Coba lagi di dekat pintu atau jendela apotek. Bila tetap gagal padahal Anda sudah di apotek, ajukan pengecualian."
            : "Coba lagi di tempat yang lebih terang dengan wajah menghadap kamera. Bila tetap gagal, ajukan pengecualian."}{" "}
          Admin akan memeriksa foto dan lokasi Anda; bila disetujui, jam absen dicatat sesuai jam sekarang.
        </p>
        <Field label="Alasan pengecualian">
          <TextArea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Contoh: sudah di dalam apotek, GPS meleset karena gedung bertingkat"
            maxLength={300}
          />
        </Field>
        {submitException.error ? <Notice tone="red">{getErrorMessage(submitException.error)}</Notice> : null}
      </div>
      <DialogActions>
        <button type="button" onClick={onRetake} className={buttonStyles.secondary}>
          Ulangi absen
        </button>
        <button
          type="button"
          disabled={reason.trim().length < 5 || submitException.isPending}
          onClick={submit}
          className={buttonStyles.primary}
        >
          {submitException.isPending ? "Mengirim..." : "Ajukan pengecualian"}
        </button>
      </DialogActions>
    </Dialog>
  );
}

function RecentAttendance() {
  const today = todayDate();
  const history = useAttendanceHistory({ from: shiftDate(today, -6), to: today });

  return (
    <Card title="Riwayat 7 hari">
      {!history.data ? (
        <div className="grid place-items-center py-8">
          <Spinner />
        </div>
      ) : history.data.length === 0 ? (
        <EmptyState icon={Clock}>Belum ada absen dalam 7 hari terakhir.</EmptyState>
      ) : (
        <ul className="divide-y divide-line">
          {history.data.map((record) => (
            <li key={record.id} className="flex items-center justify-between gap-3 py-3 text-sm">
              <span className="min-w-0">
                <span className="block font-medium text-ink">
                  {KIND_LABEL[record.kind]} · {formatTime(record.serverAt)}
                </span>
                <span className="block truncate text-xs text-muted">
                  {formatBusinessDate(record.businessDate)} · {record.pharmacy.name}
                </span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted">
                {formatDistance(record.distanceM)}
                {record.exceptionId ? <Pill tone="blue">Pengecualian</Pill> : null}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** ABS-01: absen masuk/pulang SPG dengan foto langsung + lokasi dalam radius apotek tugas. */
export function AttendancePage() {
  const user = useCurrentUser();
  const today = useTodayAttendance();
  const location = useLiveLocation();
  const submitAttendance = useSubmitAttendance();
  const showToast = useToast();
  const [flow, setFlow] = useState<Flow>({ step: "idle" });

  // Siapkan model wajah di latar belakang supaya kamera langsung siap saat tombol absen ditekan.
  useEffect(() => {
    void loadFaceLandmarker().catch(() => undefined);
  }, []);

  const cameraItem = flow.step === "camera" ? flow.item : null;
  const cameraKind = flow.step === "camera" ? flow.kind : null;
  const stampLines = useCallback(
    () => [
      `${user.name} · ${cameraKind ? KIND_LABEL[cameraKind] : ""}`,
      `${cameraItem?.pharmacy.name ?? ""} · ${new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "medium",
        timeZone: "Asia/Jakarta",
      }).format(new Date())} WIB`,
    ],
    [cameraItem, cameraKind, user.name],
  );

  const handleCapture = async (item: TodayPharmacy, kind: AttendanceKind, photo: CapturedPhoto) => {
    const position = location.position;
    setFlow({ step: "submitting", kind });

    if (!position) {
      showToast("Lokasi belum didapat. Coba lagi.", "error");
      setFlow({ step: "idle" });
      return;
    }

    let payload: AttendancePayload;

    try {
      const file = await uploadFile(photo.file, "ATTENDANCE_PHOTO");
      payload = {
        pharmacyId: item.pharmacy.id,
        kind,
        photoFileId: file.id,
        latitude: position.latitude,
        longitude: position.longitude,
        accuracyM: position.accuracyM,
        faceCheck: photo.faceCheck satisfies FaceCheck,
      };
    } catch (uploadError) {
      showToast(getErrorMessage(uploadError, "Foto gagal diunggah. Periksa koneksi lalu coba lagi."), "error");
      setFlow({ step: "idle" });
      return;
    } finally {
      URL.revokeObjectURL(photo.previewUrl);
    }

    if (!photo.faceCheck.passed) {
      setFlow({
        step: "rejected",
        rejection: {
          payload,
          pharmacyName: item.pharmacy.name,
          message: "Verifikasi wajah tidak berhasil di perangkat ini, jadi absen perlu disetujui Admin.",
        },
      });
      return;
    }

    submitAttendance.mutate(payload, {
      onSuccess: () => {
        showToast(`${KIND_LABEL[kind]} tercatat di ${item.pharmacy.name}`);
        setFlow({ step: "idle" });
      },
      onError: (error) => {
        const code = getErrorCode(error);

        if (code && REJECTION_CODES.has(code)) {
          const details = (error as { response?: { data?: { details?: Rejection["details"] } } }).response?.data?.details;
          setFlow({
            step: "rejected",
            rejection: { payload, pharmacyName: item.pharmacy.name, message: getErrorMessage(error), details },
          });
        } else {
          showToast(getErrorMessage(error), "error");
          setFlow({ step: "idle" });
        }
      },
    });
  };

  const data = today.data;
  const openPharmacy = data?.pharmacies.find((item) => item.pharmacy.id === data.openPharmacyId);

  return (
    <>
      <PageHeader title="Absen" description={`${formatLongDate(new Date())} · jam absen memakai jam server (WIB)`} />

      {!data ? (
        <div className="grid place-items-center py-16">
          {today.error ? <Notice tone="red">{getErrorMessage(today.error)}</Notice> : <Spinner />}
        </div>
      ) : data.pharmacies.length === 0 ? (
        <Card>
          <EmptyState icon={ScanFace}>Anda belum ditempatkan di apotek. Hubungi Super Admin.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,380px)]">
          <div className="min-w-0 space-y-4">
            <LocationBanner location={location} maxAccuracyM={data.maxAccuracyM} />
            {data.pharmacies.map((item) => (
              <PharmacyAttendanceCard
                key={item.pharmacy.id}
                item={item}
                position={location.status === "denied" ? null : location.position}
                maxAccuracyM={data.maxAccuracyM}
                blockedBy={
                  item.nextAction === "CHECK_IN" && openPharmacy && openPharmacy.pharmacy.id !== item.pharmacy.id
                    ? openPharmacy.pharmacy.name
                    : null
                }
                busy={flow.step !== "idle"}
                onStart={(kind) => setFlow({ step: "camera", item, kind })}
              />
            ))}
          </div>
          <div className="min-w-0 space-y-4">
            <RecentAttendance />
          </div>
        </div>
      )}

      {flow.step === "camera" ? (
        <CameraCapture
          title={`${KIND_LABEL[flow.kind]} · ${flow.item.pharmacy.name}`}
          stampLines={stampLines}
          onClose={() => setFlow({ step: "idle" })}
          onCapture={(photo) => void handleCapture(flow.item, flow.kind, photo)}
        />
      ) : null}

      {flow.step === "submitting" ? (
        <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/50 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-8 py-6 shadow-pop">
            <Spinner />
            <p className="text-sm font-medium text-ink">Mengirim {KIND_LABEL[flow.kind].toLowerCase()}...</p>
          </div>
        </div>
      ) : null}

      {flow.step === "rejected" ? (
        <RejectionDialog
          rejection={flow.rejection}
          onClose={() => setFlow({ step: "idle" })}
          onRetake={() => {
            const item = data?.pharmacies.find((candidate) => candidate.pharmacy.id === flow.rejection.payload.pharmacyId);
            setFlow(item ? { step: "camera", item, kind: flow.rejection.payload.kind } : { step: "idle" });
          }}
        />
      ) : null}
    </>
  );
}
