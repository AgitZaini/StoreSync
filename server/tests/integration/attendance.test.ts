import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/utils/prisma";
import { businessDate, wibDateTime } from "../../src/utils/time";
import { authHeader, login } from "../helpers/auth.helper";
import {
  createAttendancePhoto,
  createPharmacy,
  createTeam,
  createUserDirect,
  offsetNorth,
  PASSED_FACE_CHECK,
  place,
  setTeam,
} from "../helpers/data.helper";
import { closeDatabase, resetDatabase, seedUsers } from "../helpers/db.helper";
import type { SeededUsers } from "../helpers/db.helper";

const PHARMACY_POINT = { latitude: -6.2251, longitude: 106.9004 };

let users: SeededUsers;
let superAdminToken: string;
let spgToken: string;
let pharmacy: { id: string; name: string };

beforeEach(async () => {
  await resetDatabase();
  users = await seedUsers();
  superAdminToken = (await login("081100000001")).accessToken;
  spgToken = (await login("081100000004")).accessToken;
  pharmacy = await createPharmacy(superAdminToken, { name: "Apotek Absen", ...PHARMACY_POINT });
  await place(superAdminToken, users.spg.id, pharmacy.id).expect(201);
});

afterAll(async () => {
  await closeDatabase();
});

const attend = async (
  overrides: Record<string, unknown> = {},
  { token = spgToken, userId = users.spg.id, path = "/api/attendance" } = {},
) => {
  const photo = await createAttendancePhoto(userId);
  return request(app)
    .post(path)
    .set(authHeader(token))
    .send({
      pharmacyId: pharmacy.id,
      kind: "CHECK_IN",
      photoFileId: photo.id,
      ...offsetNorth(PHARMACY_POINT, 5),
      accuracyM: 12,
      faceCheck: PASSED_FACE_CHECK,
      ...overrides,
    });
};

/** Menunggu respons lalu memastikan status HTTP-nya. */
const expectStatus = async (pending: ReturnType<typeof attend>, status: number) => {
  const response = await pending;
  expect({ status: response.status, body: response.body }).toMatchObject({ status });
  return response;
};

describe("SPG attendance (ABS-01)", () => {
  it("records check-in and check-out with server time, photo, and distance", async () => {
    const before = Date.now();
    const checkIn = await expectStatus(attend(), 201);
    expect(checkIn.body.attendance).toMatchObject({ kind: "CHECK_IN", accuracyM: 12 });
    expect(checkIn.body.attendance.distanceM).toBeCloseTo(5, 0);
    expect(new Date(checkIn.body.attendance.serverAt).getTime()).toBeGreaterThanOrEqual(before - 1000);

    const record = await prisma.attendance.findUniqueOrThrow({ where: { id: checkIn.body.attendance.id } });
    expect(record.businessDate).toBe(businessDate());

    await expectStatus(attend({ kind: "CHECK_OUT" }), 201);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "attendance.check_in" } });
    expect(audit.evidenceFileIds).toEqual([record.photoFileId]);

    const today = await request(app).get("/api/attendance/today").set(authHeader(spgToken)).expect(200);
    expect(today.body.pharmacies[0]).toMatchObject({ nextAction: null, checkIn: { kind: "CHECK_IN" }, checkOut: { kind: "CHECK_OUT" } });
  });

  it("rejects locations outside the radius and inaccurate GPS, showing the distance", async () => {
    const far = await expectStatus(attend(offsetNorth(PHARMACY_POINT, 200)), 422);
    expect(far.body.code).toBe("OUTSIDE_RADIUS");
    expect(far.body.details.distanceM).toBeGreaterThan(190);
    expect(far.body.details.radiusM).toBe(20);
    expect(far.body.message).toMatch(/radius 20 m/);

    const blurry = await expectStatus(attend({ accuracyM: 250 }), 422);
    expect(blurry.body.code).toBe("LOW_ACCURACY");

    expect(await prisma.attendance.count()).toBe(0);
  });

  it("requires a passed face check, an unused own photo, and an assigned pharmacy", async () => {
    const failed = await expectStatus(attend({ faceCheck: { passed: false, method: "mediapipe-blink-v1", failureReason: "no blink" } }), 400);
    expect(failed.body.code).toBe("FACE_CHECK_FAILED");

    const othersPhoto = await createAttendancePhoto(users.newcomer.id);
    await expectStatus(attend({ photoFileId: othersPhoto.id }), 400);

    const pendingPhoto = await prisma.fileObject.create({
      data: { key: "attendance_photo/test/pending.jpg", purpose: "ATTENDANCE_PHOTO", mimeType: "image/jpeg", size: 1, uploadedById: users.spg.id },
    });
    await expectStatus(attend({ photoFileId: pendingPhoto.id }), 400);

    const used = await expectStatus(attend(), 201);
    await expectStatus(attend({ kind: "CHECK_OUT", photoFileId: used.body.attendance.photoFileId }), 409);

    const other = await createPharmacy(superAdminToken, { name: "Apotek Bukan Tugas" });
    const notAssigned = await expectStatus(attend({ pharmacyId: other.id }), 403);
    expect(notAssigned.body.message).toMatch(/tidak ditugaskan/);
  });

  it("enforces check-in before check-out and one open pharmacy at a time", async () => {
    const early = await expectStatus(attend({ kind: "CHECK_OUT" }), 409);
    expect(early.body.message).toMatch(/Absen masuk dulu/);

    await expectStatus(attend(), 201);
    await expectStatus(attend(), 409);

    const second = await createPharmacy(superAdminToken, { name: "Apotek Kedua", ...PHARMACY_POINT });
    await place(superAdminToken, users.spg.id, second.id).expect(201);
    const blocked = await expectStatus(attend({ pharmacyId: second.id }), 409);
    expect(blocked.body.message).toMatch(/Absen pulang dulu dari Apotek Absen/);

    await expectStatus(attend({ kind: "CHECK_OUT" }), 201);
    await expectStatus(attend({ pharmacyId: second.id }), 201);
  });

  it("keeps a double tap from creating two check-ins", async () => {
    // Foto disiapkan dulu supaya kelima request benar-benar tiba bersamaan.
    const photos = await Promise.all([1, 2, 3, 4, 5].map(() => createAttendancePhoto(users.spg.id)));
    const results = await Promise.all(
      photos.map((photo) =>
        request(app)
          .post("/api/attendance")
          .set(authHeader(spgToken))
          .send({ pharmacyId: pharmacy.id, kind: "CHECK_IN", photoFileId: photo.id, ...PHARMACY_POINT, accuracyM: 8, faceCheck: PASSED_FACE_CHECK }),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409, 409, 409, 409]);
    expect(await prisma.attendance.count()).toBe(1);
  });

  it("never lets attendance be changed or deleted", async () => {
    const created = await expectStatus(attend(), 201);
    await expect(
      prisma.attendance.update({ where: { id: created.body.attendance.id }, data: { distanceM: 0 } }),
    ).rejects.toThrow(/append-only/);
    await expect(prisma.attendance.delete({ where: { id: created.body.attendance.id } })).rejects.toThrow(/append-only/);
  });

  it("is only for SPG accounts", async () => {
    const leader = await login("081100000003");
    const photo = await createAttendancePhoto(users.teamLeader.id);
    await request(app)
      .post("/api/attendance")
      .set(authHeader(leader.accessToken))
      .send({ pharmacyId: pharmacy.id, kind: "CHECK_IN", photoFileId: photo.id, ...PHARMACY_POINT, accuracyM: 5, faceCheck: PASSED_FACE_CHECK })
      .expect(403);
  });
});

describe("Attendance exceptions", () => {
  const exceptionPath = { path: "/api/attendance/exceptions" };
  const farAway = { ...offsetNorth(PHARMACY_POINT, 60), reason: "GPS di dalam apotek meleset" };

  it("lets Admin approve an exception, recording the time the SPG tried", async () => {
    const created = await expectStatus(attend(farAway, exceptionPath), 201);
    const requestedAt = created.body.exception.requestedAt;
    expect(created.body.exception).toMatchObject({ status: "PENDING", kind: "CHECK_IN" });
    expect(await prisma.notification.count({ where: { userId: users.admin.id, title: "Pengecualian absen" } })).toBe(1);

    // Selama menunggu, SPG tidak bisa mengajukan atau absen masuk lagi di apotek itu.
    await expectStatus(attend(farAway, exceptionPath), 409);
    await expectStatus(attend(), 409);

    const admin = await login("081100000002");
    const approved = await request(app)
      .post(`/api/attendance/exceptions/${created.body.exception.id}/approve`)
      .set(authHeader(admin.accessToken))
      .send({})
      .expect(200);
    expect(approved.body.exception.status).toBe("APPROVED");

    const record = await prisma.attendance.findFirstOrThrow({ where: { exceptionId: created.body.exception.id } });
    expect(record.serverAt.toISOString()).toBe(requestedAt);
    expect(await prisma.notification.count({ where: { userId: users.spg.id, title: "Pengecualian absen disetujui" } })).toBe(1);

    await request(app)
      .post(`/api/attendance/exceptions/${created.body.exception.id}/approve`)
      .set(authHeader(admin.accessToken))
      .expect(409);
  });

  it("requires a reason to reject, after which the SPG can try again", async () => {
    const created = await expectStatus(attend(farAway, exceptionPath), 201);
    const admin = await login("081100000002");
    const reject = (body: object) =>
      request(app).post(`/api/attendance/exceptions/${created.body.exception.id}/reject`).set(authHeader(admin.accessToken)).send(body);

    await reject({}).expect(400);
    await reject({ note: "Foto tidak di apotek" }).expect(200);
    expect(await prisma.notification.count({ where: { userId: users.spg.id, title: "Pengecualian absen ditolak" } })).toBe(1);

    await expectStatus(attend(), 201);
  });

  it("approves a check-out exception only after the check-in exists", async () => {
    const checkIn = await expectStatus(attend(farAway, exceptionPath), 201);
    const checkOut = await expectStatus(attend({ ...farAway, kind: "CHECK_OUT" }, exceptionPath), 201);
    const admin = await login("081100000002");
    const approve = (id: string) =>
      request(app).post(`/api/attendance/exceptions/${id}/approve`).set(authHeader(admin.accessToken)).send({});

    const blocked = await approve(checkOut.body.exception.id).expect(409);
    expect(blocked.body.message).toMatch(/absen masuk SPG ini dulu/);
    await approve(checkIn.body.exception.id).expect(200);
    await approve(checkOut.body.exception.id).expect(200);

    // Super Admin melihat, tetapi persetujuan pengecualian ada di Admin.
    const listed = await request(app).get("/api/attendance/exceptions").set(authHeader(superAdminToken)).expect(200);
    expect(listed.body.exceptions).toHaveLength(2);
    await approve(checkIn.body.exception.id).expect(409);
  });
});

describe("Attendance monitor (ABS-04)", () => {
  const DAY = "2026-09-21";

  const seedDay = async () => {
    const onTime = users.spg;
    const late = await createUserDirect("SPG", "SPG Telat");
    const absent = await createUserDirect("SPG", "SPG Tidak Masuk");
    const off = await createUserDirect("SPG", "SPG Libur");
    const unscheduled = await createUserDirect("SPG", "SPG Tanpa Jadwal");

    const shift = { date: DAY, pharmacyId: pharmacy.id, isOff: false, startTime: "08:00", endTime: "16:00" };
    await prisma.schedule.createMany({
      data: [
        { ...shift, spgId: onTime.id },
        { ...shift, spgId: late.id },
        { ...shift, spgId: absent.id },
        { date: DAY, pharmacyId: pharmacy.id, spgId: off.id, isOff: true },
      ],
    });

    for (const [spg, time] of [
      [onTime, "07:55"],
      [late, "08:20"],
      [unscheduled, "10:00"],
    ] as const) {
      const photo = await createAttendancePhoto(spg.id);
      await prisma.attendance.create({
        data: {
          userId: spg.id,
          pharmacyId: pharmacy.id,
          kind: "CHECK_IN",
          businessDate: DAY,
          serverAt: wibDateTime(DAY, time),
          photoFileId: photo.id,
          ...PHARMACY_POINT,
          accuracyM: 8,
          distanceM: 4,
        },
      });
    }

    return { late, absent };
  };

  it("compares attendance with the schedule for a day", async () => {
    await seedDay();
    const admin = await login("081100000002");

    const monitor = await request(app).get(`/api/attendance/monitor?date=${DAY}`).set(authHeader(admin.accessToken)).expect(200);
    const statusOf = (name: string) =>
      monitor.body.rows.find((row: { spg: { name: string } }) => row.spg.name === name) as { status: string; lateMinutes: number };

    expect(statusOf("Test SPG").status).toBe("ON_TIME");
    expect(statusOf("SPG Telat")).toMatchObject({ status: "LATE", lateMinutes: 20 });
    expect(statusOf("SPG Tidak Masuk").status).toBe("ABSENT");
    expect(statusOf("SPG Libur").status).toBe("OFF");
    expect(statusOf("SPG Tanpa Jadwal").status).toBe("UNSCHEDULED");
    expect(monitor.body.summary).toMatchObject({ scheduled: 3, onTime: 1, late: 1, absent: 1, off: 1, unscheduled: 1 });

    // Toleransi hanya mengubah label; jam absen tetap apa adanya (AB-04).
    await request(app)
      .put("/api/settings/attendance")
      .set(authHeader(superAdminToken))
      .send({ maxAccuracyM: 100, lateToleranceMinutes: 30 })
      .expect(200);
    const tolerant = await request(app).get(`/api/attendance/monitor?date=${DAY}`).set(authHeader(admin.accessToken)).expect(200);
    expect(tolerant.body.rows.find((row: { spg: { name: string } }) => row.spg.name === "SPG Telat")).toMatchObject({
      status: "ON_TIME",
      lateMinutes: 20,
    });
  });

  it("lets Admin note reasons, recorded in history", async () => {
    const { absent } = await seedDay();
    const admin = await login("081100000002");
    const saveNote = (note: string) =>
      request(app)
        .put("/api/attendance/notes")
        .set(authHeader(admin.accessToken))
        .send({ spgId: absent.id, pharmacyId: pharmacy.id, date: DAY, note });

    await saveNote("Sakit, sudah konfirmasi lewat telepon").expect(200);
    const monitor = await request(app).get(`/api/attendance/monitor?date=${DAY}`).set(authHeader(admin.accessToken)).expect(200);
    expect(monitor.body.rows.find((row: { spg: { id: string } }) => row.spg.id === absent.id).note).toMatch(/Sakit/);

    await saveNote("").expect(200);
    expect(await prisma.attendanceNote.count()).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "attendance.note" } })).toBe(2);

    await saveNote("x").set(authHeader(superAdminToken)).expect(403);
  });

  it("shows a Team Leader only the team, including their attendance photos", async () => {
    const { late } = await seedDay();
    const team = await createTeam(superAdminToken, users.teamLeader.id);
    await setTeam(superAdminToken, late.id, team.id).expect(200);

    const leader = await login("081100000003");
    const monitor = await request(app).get(`/api/attendance/monitor?date=${DAY}`).set(authHeader(leader.accessToken)).expect(200);
    expect(monitor.body.rows.map((row: { spg: { name: string } }) => row.spg.name)).toEqual(["SPG Telat"]);

    const photoId = monitor.body.rows[0].checkIn.photoFileId;
    await request(app).get(`/api/files/${photoId}`).set(authHeader(leader.accessToken)).expect(200);
    const otherPhoto = (await prisma.attendance.findFirstOrThrow({ where: { userId: users.spg.id } })).photoFileId;
    await request(app).get(`/api/files/${otherPhoto}`).set(authHeader(leader.accessToken)).expect(404);

    await request(app).get(`/api/attendance/monitor?date=${DAY}`).set(authHeader(spgToken)).expect(403);
  });
});
