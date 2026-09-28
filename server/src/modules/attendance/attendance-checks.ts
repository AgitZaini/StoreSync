import { FilePurpose, FileStatus } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import { AppError } from "../../middleware/error-handler";
import { distanceInMeters } from "../../utils/geo";
import { prisma } from "../../utils/prisma";

type Tx = Prisma.TransactionClient;

/** Pemeriksaan bersama absen SPG (ABS-01) dan absen kunjungan Team Leader (ABS-02). */

export const pharmacyForAttendance = {
  id: true,
  name: true,
  address: true,
  latitude: true,
  longitude: true,
  radiusM: true,
  is24h: true,
  openTime: true,
  closeTime: true,
  status: true,
} satisfies Prisma.PharmacySelect;

export const round1 = (value: number) => Math.round(value * 10) / 10;

/** Foto harus hasil unggahan pengguna ini sendiri, untuk absen, dan belum pernah dipakai. */
export const assertPhotoUsable = async (userId: string, photoFileId: string) => {
  const file = await prisma.fileObject.findUnique({
    where: { id: photoFileId },
    select: { uploadedById: true, purpose: true, status: true, attendance: { select: { id: true } }, attendanceException: { select: { id: true } } },
  });

  if (!file || file.uploadedById !== userId || file.purpose !== FilePurpose.ATTENDANCE_PHOTO) {
    throw new AppError(400, "Foto absen tidak valid");
  }

  if (file.status !== FileStatus.UPLOADED) {
    throw new AppError(400, "Foto absen belum selesai diunggah");
  }

  if (file.attendance || file.attendanceException) {
    throw new AppError(409, "Foto ini sudah dipakai. Ambil foto baru.");
  }
};

export const assertFaceCheckPassed = (faceCheck: { passed: boolean }) => {
  if (!faceCheck.passed) {
    throw new AppError(400, "Verifikasi wajah belum berhasil. Ulangi foto.", "FACE_CHECK_FAILED");
  }
};

export const measureLocation = (
  pharmacy: { latitude: number; longitude: number },
  input: { latitude: number; longitude: number },
) => round1(distanceInMeters(input, pharmacy));

/**
 * Jarak dihitung haversine di server dan harus ≤ radius apotek; akurasi GPS harus di bawah ambang.
 * Bila ditolak, jarak dan akurasi dikembalikan di `details` supaya bisa ditampilkan.
 */
export const assertWithinRadius = (
  pharmacy: { name: string; latitude: number; longitude: number; radiusM: number },
  input: { latitude: number; longitude: number; accuracyM: number },
  maxAccuracyM: number,
) => {
  const distanceM = measureLocation(pharmacy, input);
  const location = { distanceM, radiusM: pharmacy.radiusM, accuracyM: round1(input.accuracyM), maxAccuracyM };

  if (input.accuracyM > maxAccuracyM) {
    throw new AppError(
      422,
      `Sinyal GPS belum akurat (±${Math.round(input.accuracyM)} m). Tunggu sebentar di dekat pintu atau jendela, lalu coba lagi.`,
      "LOW_ACCURACY",
      location,
    );
  }

  if (distanceM > pharmacy.radiusM) {
    throw new AppError(
      422,
      `Anda berada ${Math.round(distanceM)} m dari ${pharmacy.name}. Absen hanya bisa dalam radius ${pharmacy.radiusM} m.`,
      "OUTSIDE_RADIUS",
      location,
    );
  }

  return location;
};

/** Kunci per pengguna supaya ketukan ganda tidak menghasilkan dua absen. */
export const lockUser = (tx: Tx, userId: string) => tx.$queryRaw`SELECT id FROM "User" WHERE id = ${userId} FOR UPDATE`;
