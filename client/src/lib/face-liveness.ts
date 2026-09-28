import type { FaceLandmarker, FaceLandmarkerResult } from "@mediapipe/tasks-vision";
import simdLoaderUrl from "@mediapipe/tasks-vision/vision_wasm_internal.js?url";
import simdBinaryUrl from "@mediapipe/tasks-vision/vision_wasm_internal.wasm?url";
import noSimdLoaderUrl from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.js?url";
import noSimdBinaryUrl from "@mediapipe/tasks-vision/vision_wasm_nosimd_internal.wasm?url";
import modelUrl from "../assets/models/face_landmarker.task?url";

export const LIVENESS_METHOD = "mediapipe-blink-v1";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

/**
 * Memuat MediaPipe FaceLandmarker sekali per sesi. WASM dan model di-host sendiri (bukan CDN),
 * dan baru diunduh saat fungsi ini dipanggil pertama kali.
 */
export function loadFaceLandmarker() {
  landmarkerPromise ??= (async () => {
    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const simd = await FilesetResolver.isSimdSupported();
    const fileset = simd
      ? { wasmLoaderPath: simdLoaderUrl, wasmBinaryPath: simdBinaryUrl }
      : { wasmLoaderPath: noSimdLoaderUrl, wasmBinaryPath: noSimdBinaryUrl };
    const options = (delegate: "GPU" | "CPU") => ({
      baseOptions: { modelAssetPath: modelUrl, delegate },
      runningMode: "VIDEO" as const,
      numFaces: 2,
      outputFaceBlendshapes: true,
    });

    try {
      return await FaceLandmarker.createFromOptions(fileset, options("GPU"));
    } catch {
      // Sebagian HP kelas bawah tidak mendukung WebGL untuk MediaPipe.
      return FaceLandmarker.createFromOptions(fileset, options("CPU"));
    }
  })().catch((error: unknown) => {
    landmarkerPromise = null;
    throw error;
  });

  return landmarkerPromise;
}

export type FaceFrame = {
  faces: number;
  /** Lebar wajah relatif terhadap lebar gambar (0–1). */
  faceWidth: number;
  centered: boolean;
  eyesClosed: boolean;
  eyesOpen: boolean;
};

const EYES_CLOSED_SCORE = 0.5;
const EYES_OPEN_SCORE = 0.25;

export function readFaceFrame(result: FaceLandmarkerResult): FaceFrame {
  const faces = result.faceLandmarks.length;

  if (faces !== 1) {
    return { faces, faceWidth: 0, centered: false, eyesClosed: false, eyesOpen: false };
  }

  const landmarks = result.faceLandmarks[0];
  const xs = landmarks.map((point) => point.x);
  const nose = landmarks[1];
  const scores = new Map(result.faceBlendshapes[0]?.categories.map((category) => [category.categoryName, category.score]));
  const left = scores.get("eyeBlinkLeft") ?? 0;
  const right = scores.get("eyeBlinkRight") ?? 0;

  return {
    faces,
    faceWidth: Math.max(...xs) - Math.min(...xs),
    centered: nose.x > 0.25 && nose.x < 0.75 && nose.y > 0.2 && nose.y < 0.8,
    eyesClosed: left > EYES_CLOSED_SCORE && right > EYES_CLOSED_SCORE,
    eyesOpen: left < EYES_OPEN_SCORE && right < EYES_OPEN_SCORE,
  };
}

/**
 * Kedip = mata terlihat tertutup lalu terbuka lagi pada satu wajah yang sama.
 * Foto dari foto tidak bisa berkedip, jadi ini menyaring absen memakai foto cetak/layar diam.
 */
export class BlinkTracker {
  private sawClosed = false;
  blinked = false;

  update(frame: FaceFrame) {
    if (frame.faces !== 1) {
      this.sawClosed = false;
      return;
    }

    if (frame.eyesClosed) {
      this.sawClosed = true;
    } else if (this.sawClosed && frame.eyesOpen) {
      this.blinked = true;
    }
  }
}
