import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, RefreshCw, X } from "lucide-react";
import { BlinkTracker, LIVENESS_METHOD, loadFaceLandmarker, readFaceFrame } from "../lib/face-liveness";
import { cn } from "../lib/utils";
import type { FaceCheck } from "../types/attendance";
import { buttonStyles } from "./styles";
import { Spinner } from "./ui";

export type CapturedPhoto = { file: File; previewUrl: string; faceCheck: FaceCheck };

type Phase = "starting" | "loading-model" | "detecting" | "manual" | "captured" | "error";

const MIN_FACE_WIDTH = 0.28;
const MANUAL_FALLBACK_AFTER_MS = 30_000;

const cameraErrorMessage = (error: unknown) => {
  if (!window.isSecureContext) return "Kamera hanya bisa dipakai lewat koneksi aman (HTTPS).";
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") return "Izin kamera ditolak. Izinkan akses kamera untuk situs ini di pengaturan browser.";
    if (error.name === "NotFoundError" || error.name === "OverconstrainedError") return "Kamera depan tidak ditemukan di perangkat ini.";
    if (error.name === "NotReadableError") return "Kamera sedang dipakai aplikasi lain. Tutup aplikasi itu lalu coba lagi.";
  }
  return "Kamera tidak bisa dibuka.";
};

/** Menggambar frame video ke JPEG, dengan cap waktu/nama di bagian bawah sebagai bukti. */
const captureFrame = async (video: HTMLVideoElement, stampLines: string[]) => {
  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const context = canvas.getContext("2d")!;
  context.drawImage(video, 0, 0, canvas.width, canvas.height);

  const fontSize = Math.max(14, Math.round(canvas.width / 30));
  const lineHeight = fontSize * 1.35;
  const barHeight = lineHeight * stampLines.length + fontSize;
  context.fillStyle = "rgb(0 0 0 / 0.55)";
  context.fillRect(0, canvas.height - barHeight, canvas.width, barHeight);
  context.fillStyle = "#fff";
  context.font = `600 ${fontSize}px Inter, system-ui, sans-serif`;
  stampLines.forEach((line, index) => {
    context.fillText(line, fontSize * 0.6, canvas.height - barHeight + fontSize * 0.5 + lineHeight * (index + 0.8));
  });

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((result) => (result ? resolve(result) : reject(new Error("Gagal membuat foto"))), "image/jpeg", 0.9),
  );
  return new File([blob], `absen-${Date.now()}.jpg`, { type: "image/jpeg" });
};

/**
 * Kamera depan layar penuh untuk foto absen (AB-01): hanya dari kamera langsung, tanpa galeri,
 * dengan deteksi satu wajah + kedip. Bila deteksi tidak bisa berjalan, foto tetap bisa diambil
 * dengan `faceCheck.passed = false`. `fallback` menentukan apa yang ditawarkan bila deteksi gagal:
 * - "exception" (absen SPG): ambil foto lalu ajukan pengecualian ke Admin;
 * - "retry" (absen kunjungan TL, tanpa pengecualian): hanya bisa mengulang;
 * - "plain" (foto kasir, AB-07): foto tetap diambil, hasil deteksi ikut dicatat.
 */
export type CameraFallback = "exception" | "retry" | "plain";

export function CameraCapture({
  title,
  stampLines,
  onCapture,
  onClose,
  fallback = "exception",
}: {
  title: string;
  stampLines: () => string[];
  onCapture: (photo: CapturedPhoto) => void;
  onClose: () => void;
  fallback?: CameraFallback;
}) {
  const allowUnverified = fallback !== "retry";
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraSupported = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices);
  const [phase, setPhase] = useState<Phase>(cameraSupported ? "starting" : "error");
  const [hint, setHint] = useState("Menyiapkan kamera...");
  const [error, setError] = useState<string | null>(cameraSupported ? null : cameraErrorMessage(null));
  const [captured, setCaptured] = useState<CapturedPhoto | null>(null);
  const [showManual, setShowManual] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const startedAtRef = useRef(0);
  // Parent bisa re-render tiap pembaruan GPS; ref menjaga loop deteksi tidak ikut mulai ulang.
  const stampLinesRef = useRef(stampLines);

  useEffect(() => {
    stampLinesRef.current = stampLines;
  }, [stampLines]);

  const takePhoto = useCallback(
    async (faceCheck: Omit<FaceCheck, "method" | "durationMs">) => {
      const video = videoRef.current;
      if (!video || !video.videoWidth) return;

      const file = await captureFrame(video, stampLinesRef.current());
      setCaptured({
        file,
        previewUrl: URL.createObjectURL(file),
        faceCheck: { ...faceCheck, method: LIVENESS_METHOD, durationMs: Math.round(performance.now() - startedAtRef.current) },
      });
      setPhase("captured");
    },
    [],
  );

  // Buka kamera depan; hentikan saat komponen ditutup atau diulang.
  useEffect(() => {
    if (!cameraSupported) return;

    let stream: MediaStream | null = null;
    let cancelled = false;

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } }, audio: false })
      .then(async (media) => {
        if (cancelled) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = media;
        const video = videoRef.current!;
        video.srcObject = media;
        await video.play();
        startedAtRef.current = performance.now();
        setPhase("loading-model");
        setHint("Menyiapkan verifikasi wajah...");
      })
      .catch((cameraError: unknown) => {
        setError(cameraErrorMessage(cameraError));
        setPhase("error");
      });

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [attempt, cameraSupported]);

  const detecting = phase === "loading-model" || phase === "detecting";

  // Deteksi wajah + kedip per frame; ambil foto otomatis begitu kedip terdeteksi.
  useEffect(() => {
    if (!detecting) return;

    let frameRequest = 0;
    let stopped = false;
    const tracker = new BlinkTracker();
    const manualTimer = window.setTimeout(() => setShowManual(true), MANUAL_FALLBACK_AFTER_MS);

    loadFaceLandmarker()
      .then((landmarker) => {
        if (stopped) return;
        setPhase("detecting");
        setHint("Posisikan wajah di dalam bingkai");

        let lastVideoTime = -1;
        const loop = () => {
          if (stopped) return;
          const video = videoRef.current;

          if (video && video.readyState >= 2 && video.currentTime !== lastVideoTime) {
            lastVideoTime = video.currentTime;
            const frame = readFaceFrame(landmarker.detectForVideo(video, performance.now()));
            tracker.update(frame);

            if (frame.faces === 0) setHint("Wajah belum terlihat. Pastikan cukup terang.");
            else if (frame.faces > 1) setHint("Hanya satu wajah di dalam bingkai");
            else if (frame.faceWidth < MIN_FACE_WIDTH || !frame.centered) setHint("Dekatkan wajah ke tengah bingkai");
            else if (!tracker.blinked) setHint("Kedipkan mata perlahan");

            if (tracker.blinked && frame.faces === 1 && frame.eyesOpen && frame.faceWidth >= MIN_FACE_WIDTH && frame.centered) {
              stopped = true;
              void takePhoto({ passed: true, faces: 1, blinkDetected: true });
              return;
            }
          }

          frameRequest = requestAnimationFrame(loop);
        };
        loop();
      })
      .catch(() => {
        if (stopped) return;
        setPhase("manual");
        setHint(
          fallback === "exception"
            ? "Verifikasi wajah tidak bisa berjalan di perangkat ini. Ambil foto lalu ajukan pengecualian ke Admin."
            : fallback === "plain"
              ? "Verifikasi wajah tidak bisa berjalan di perangkat ini. Pastikan wajah terlihat jelas, lalu ambil foto."
              : "Verifikasi wajah tidak bisa berjalan di perangkat ini. Muat ulang halaman atau pakai Chrome/Safari terbaru.",
        );
      });

    return () => {
      stopped = true;
      cancelAnimationFrame(frameRequest);
      window.clearTimeout(manualTimer);
    };
  }, [detecting, attempt, takePhoto, fallback]);

  const retake = () => {
    if (captured) URL.revokeObjectURL(captured.previewUrl);
    setCaptured(null);
    setShowManual(false);
    setError(null);
    setPhase("starting");
    setHint("Menyiapkan kamera...");
    setAttempt((current) => current + 1);
  };

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-black text-white" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
        <p className="text-base font-semibold">{title}</p>
        <button type="button" onClick={onClose} className="grid size-10 place-items-center rounded-full bg-white/10" aria-label="Tutup kamera">
          <X className="size-5" />
        </button>
      </div>

      <div className="relative mx-auto flex w-full max-w-md flex-1 items-center justify-center overflow-hidden">
        {captured ? (
          <img src={captured.previewUrl} alt="Foto absen" className="max-h-full w-full object-contain" />
        ) : (
          <>
            <video ref={videoRef} playsInline muted className="h-full w-full scale-x-[-1] object-cover" />
            {phase !== "error" ? (
              <div
                aria-hidden="true"
                className={cn(
                  "pointer-events-none absolute left-1/2 top-1/2 h-[58%] w-[62%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] border-4 shadow-[0_0_0_9999px_rgb(0_0_0/0.45)] transition-colors",
                  hint === "Kedipkan mata perlahan" ? "border-green-400" : "border-white/70",
                )}
              />
            ) : null}
          </>
        )}
        {phase === "starting" || phase === "loading-model" ? (
          <div className="absolute inset-x-0 bottom-6 flex justify-center">
            <Spinner className="border-white/30 border-t-white" />
          </div>
        ) : null}
      </div>

      <div className="space-y-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4">
        <p role="status" className="min-h-10 text-center text-sm font-medium text-white/90">
          {phase === "error" ? error : phase === "captured" ? "Periksa foto. Wajah harus terlihat jelas." : hint}
        </p>

        {phase === "captured" && captured ? (
          <div className="mx-auto flex max-w-md gap-2">
            <button type="button" onClick={retake} className={cn(buttonStyles.secondary, "h-12 flex-1")}>
              <RefreshCw />
              Ulangi
            </button>
            <button type="button" onClick={() => onCapture(captured)} className={cn(buttonStyles.primary, "h-12 flex-1")}>
              Gunakan foto
            </button>
          </div>
        ) : phase === "error" ? (
          <div className="mx-auto flex max-w-md gap-2">
            <button type="button" onClick={retake} className={cn(buttonStyles.secondary, "h-12 flex-1")}>
              Coba lagi
            </button>
          </div>
        ) : (phase === "manual" || showManual) && !allowUnverified ? (
          <div className="mx-auto max-w-md space-y-2">
            {phase !== "manual" ? (
              <p className="text-center text-xs text-white/70">Kedipan belum terdeteksi. Cari tempat lebih terang dan hadapkan wajah ke kamera.</p>
            ) : null}
            <button type="button" onClick={retake} className={cn(buttonStyles.secondary, "h-12 w-full")}>
              <RefreshCw />
              Coba lagi
            </button>
          </div>
        ) : phase === "manual" || showManual ? (
          <div className="mx-auto max-w-md">
            <button
              type="button"
              onClick={() => void takePhoto({ passed: false, failureReason: phase === "manual" ? "model-unavailable" : "blink-timeout" })}
              className={cn(phase === "manual" ? buttonStyles.primary : buttonStyles.secondary, "h-12 w-full")}
            >
              <Camera />
              {phase === "manual" ? "Ambil foto" : fallback === "plain" ? "Ambil foto tanpa deteksi kedip" : "Ambil foto tanpa verifikasi (perlu persetujuan Admin)"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
