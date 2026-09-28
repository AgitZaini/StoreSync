import { UserRole } from "@prisma/client";
import request from "supertest";
import { app } from "../../src/app";
import { hashPassword } from "../../src/utils/password";
import { prisma } from "../../src/utils/prisma";
import { authHeader } from "./auth.helper";
import { TEST_PASSWORD } from "./db.helper";

let sequence = 0;
const nextSequence = () => ++sequence;

/** Nomor HP unik untuk data test, format lokal 0813xxxxxxxx. */
export const uniquePhone = () => `0813${String(Date.now() % 1_000_000).padStart(6, "0")}${String(nextSequence()).padStart(2, "0")}`;

export const pharmacyInput = (overrides: Record<string, unknown> = {}) => ({
  name: `Apotek Uji ${nextSequence()}`,
  address: "Jl. Melati No. 10, Jakarta Timur",
  latitude: -6.2251,
  longitude: 106.9004,
  kasirPhone: uniquePhone(),
  kasirPassword: "KasirSementara1",
  is24h: false,
  openTime: "08:00",
  closeTime: "22:00",
  ...overrides,
});

export const createPharmacy = async (token: string, overrides: Record<string, unknown> = {}) => {
  const response = await request(app).post("/api/pharmacies").set(authHeader(token)).send(pharmacyInput(overrides)).expect(201);
  return response.body.pharmacy as { id: string; name: string; kasir: { id: string; phone: string } };
};

/** Membuat akun langsung di database (sudah ganti sandi) supaya bisa langsung login di test. */
export const createUserDirect = async (role: UserRole, name = `${role} ${nextSequence()}`) => {
  const phone = `62${uniquePhone().slice(1)}`;
  const user = await prisma.user.create({
    data: { name, phone, role, passwordHash: await hashPassword(TEST_PASSWORD), mustChangePassword: false },
  });
  return { ...user, loginPhone: phone };
};

export const createTeam = async (token: string, leaderId: string, name = `Tim ${nextSequence()}`) => {
  const response = await request(app).post("/api/teams").set(authHeader(token)).send({ name, leaderId }).expect(201);
  return response.body.team as { id: string; name: string };
};

export const setTeam = (token: string, userId: string, teamId: string | null) =>
  request(app).patch(`/api/users/${userId}/team`).set(authHeader(token)).send({ teamId });

export const place = (token: string, spgId: string, pharmacyId: string) =>
  request(app).post("/api/placements").set(authHeader(token)).send({ spgId, pharmacyId });

/** Foto absen yang sudah "terunggah" milik `userId` (tanpa menyentuh penyimpanan). */
export const createAttendancePhoto = async (userId: string) =>
  prisma.fileObject.create({
    data: {
      key: `attendance_photo/test/${Date.now()}-${nextSequence()}.jpg`,
      purpose: "ATTENDANCE_PHOTO",
      mimeType: "image/jpeg",
      size: 150_000,
      status: "UPLOADED",
      uploadedAt: new Date(),
      uploadedById: userId,
    },
  });

/** Titik yang digeser ke utara sejauh kira-kira `meters` dari titik asal. */
export const offsetNorth = (point: { latitude: number; longitude: number }, meters: number) => ({
  latitude: point.latitude + meters / 111_195,
  longitude: point.longitude,
});

export const PASSED_FACE_CHECK = { passed: true, method: "mediapipe-blink-v1", faces: 1, blinkDetected: true, durationMs: 2400 };

/** Memundurkan awal penempatan (test yang memakai tanggal sebelum hari ini). */
export const backdatePlacements = (startedAt: Date) => prisma.placement.updateMany({ data: { startedAt } });
