import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/utils/prisma";
import { addBusinessDays, businessDate, mondayOf, wibDateTime } from "../../src/utils/time";
import { authHeader, login } from "../helpers/auth.helper";
import {
  createAttendancePhoto,
  createPharmacy,
  createUserDirect,
  offsetNorth,
  PASSED_FACE_CHECK,
} from "../helpers/data.helper";
import { closeDatabase, resetDatabase, seedUsers } from "../helpers/db.helper";
import type { SeededUsers } from "../helpers/db.helper";

const POINT_A = { latitude: -6.2251, longitude: 106.9004 };
const POINT_B = { latitude: -6.1942, longitude: 106.8906 };

let users: SeededUsers;
let superAdminToken: string;
let leaderToken: string;
let pharmacyA: { id: string; name: string };
let pharmacyB: { id: string; name: string };

beforeEach(async () => {
  await resetDatabase();
  users = await seedUsers();
  superAdminToken = (await login("081100000001")).accessToken;
  leaderToken = (await login("081100000003")).accessToken;
  pharmacyA = await createPharmacy(superAdminToken, { name: "Apotek Kunjungan A", ...POINT_A });
  pharmacyB = await createPharmacy(superAdminToken, { name: "Apotek Kunjungan B", ...POINT_B });
  // Batas jam kerja bawaan 21:00 membuat sesi kerja "selesai" bila test dijalankan malam hari.
  await prisma.setting.create({ data: { key: "leader.workEndTime", value: "23:59" } });
});

afterAll(async () => {
  await closeDatabase();
});

const visit = async (
  pharmacy: { id: string },
  point: { latitude: number; longitude: number },
  overrides: Record<string, unknown> = {},
  { token = leaderToken, userId = users.teamLeader.id } = {},
) => {
  const photo = await createAttendancePhoto(userId);
  return request(app)
    .post("/api/visits/attendance")
    .set(authHeader(token))
    .send({
      pharmacyId: pharmacy.id,
      kind: "CHECK_IN",
      photoFileId: photo.id,
      ...offsetNorth(point, 5),
      accuracyM: 10,
      faceCheck: PASSED_FACE_CHECK,
      ...overrides,
    });
};

const expectStatus = async (pending: Promise<request.Response> | request.Test, status: number) => {
  const response = await pending;
  expect({ status: response.status, body: response.body }).toMatchObject({ status });
  return response;
};

const ping = (body: Record<string, unknown> = { ...POINT_A, accuracyM: 15 }, token = leaderToken) =>
  request(app).post("/api/locations/ping").set(authHeader(token)).send(body);

describe("Team Leader visit attendance (ABS-02)", () => {
  it("checks in and out at any active pharmacy, computing the visit duration", async () => {
    // TL tidak ditempatkan di apotek mana pun, tetapi boleh absen di semua apotek aktif.
    const checkIn = await expectStatus(visit(pharmacyA, POINT_A), 201);
    expect(checkIn.body.visit).toMatchObject({ pharmacy: { id: pharmacyA.id }, checkOutAt: null, durationMin: null });
    expect(checkIn.body.visit.checkIn.distanceM).toBeCloseTo(5, 0);

    // Mundurkan jam masuk supaya durasi terukur.
    const visitId = checkIn.body.visit.id;
    await prisma.leaderVisit.update({ where: { id: visitId }, data: { checkInAt: new Date(Date.now() - 47 * 60_000) } });

    const checkOut = await expectStatus(visit(pharmacyA, POINT_A, { kind: "CHECK_OUT" }), 201);
    expect(checkOut.body.visit).toMatchObject({ id: visitId, durationMin: 47 });
    expect(checkOut.body.visit.checkOut.photoFileId).toBeTruthy();

    const records = await prisma.attendance.findMany({ where: { userId: users.teamLeader.id } });
    expect(records.map((record) => record.kind).sort()).toEqual(["CHECK_IN", "CHECK_OUT"]);
    expect(await prisma.auditLog.count({ where: { action: { in: ["leader_visit.check_in", "leader_visit.check_out"] } } })).toBe(2);

    const today = await request(app).get("/api/visits/today").set(authHeader(leaderToken)).expect(200);
    expect(today.body).toMatchObject({ date: businessDate(), openVisit: null, totalMinutes: 47, workDay: { status: "ACTIVE" } });
    expect(today.body.visits).toHaveLength(1);
  });

  it("applies the same photo and location checks as SPG attendance", async () => {
    const far = await expectStatus(visit(pharmacyA, offsetNorth(POINT_A, 150)), 422);
    expect(far.body.code).toBe("OUTSIDE_RADIUS");
    expect(far.body.details.distanceM).toBeGreaterThan(140);

    const blurry = await expectStatus(visit(pharmacyA, POINT_A, { accuracyM: 300 }), 422);
    expect(blurry.body.code).toBe("LOW_ACCURACY");

    const noFace = await expectStatus(visit(pharmacyA, POINT_A, { faceCheck: { passed: false, method: "mediapipe-blink-v1" } }), 400);
    expect(noFace.body.code).toBe("FACE_CHECK_FAILED");

    const othersPhoto = await createAttendancePhoto(users.spg.id);
    await expectStatus(visit(pharmacyA, POINT_A, { photoFileId: othersPhoto.id }), 400);

    await prisma.pharmacy.update({ where: { id: pharmacyB.id }, data: { status: "INACTIVE" } });
    const inactive = await expectStatus(visit(pharmacyB, POINT_B), 400);
    expect(inactive.body.message).toMatch(/tidak aktif/);

    expect(await prisma.leaderVisit.count()).toBe(0);
    expect(await prisma.leaderWorkDay.count()).toBe(0);
  });

  it("requires checking out before checking in at another pharmacy", async () => {
    const early = await expectStatus(visit(pharmacyA, POINT_A, { kind: "CHECK_OUT" }), 409);
    expect(early.body.message).toMatch(/Absen masuk dulu/);

    await expectStatus(visit(pharmacyA, POINT_A), 201);
    const blocked = await expectStatus(visit(pharmacyB, POINT_B), 409);
    expect(blocked.body.message).toBe("Absen keluar dulu dari Apotek Kunjungan A");

    const wrongPlace = await expectStatus(visit(pharmacyB, POINT_B, { kind: "CHECK_OUT" }), 409);
    expect(wrongPlace.body.message).toMatch(/masih terbuka ada di Apotek Kunjungan A/);

    await expectStatus(visit(pharmacyA, POINT_A, { kind: "CHECK_OUT" }), 201);
    await expectStatus(visit(pharmacyB, POINT_B), 201);
    await expectStatus(visit(pharmacyB, POINT_B, { kind: "CHECK_OUT" }), 201);
    // Kembali ke apotek yang sama di hari yang sama tetap boleh.
    await expectStatus(visit(pharmacyA, POINT_A), 201);

    expect(await prisma.leaderVisit.count({ where: { leaderId: users.teamLeader.id } })).toBe(3);
  });

  it("keeps a double tap from opening two visits", async () => {
    // Kunjungan pertama dulu, supaya sesi kerja sudah ada dan hanya kunci pengguna yang menahan.
    await expectStatus(visit(pharmacyA, POINT_A), 201);
    await expectStatus(visit(pharmacyA, POINT_A, { kind: "CHECK_OUT" }), 201);

    const photos = await Promise.all([1, 2, 3, 4, 5].map(() => createAttendancePhoto(users.teamLeader.id)));
    const results = await Promise.all(
      photos.map((photo) =>
        request(app)
          .post("/api/visits/attendance")
          .set(authHeader(leaderToken))
          .send({ pharmacyId: pharmacyB.id, kind: "CHECK_IN", photoFileId: photo.id, ...POINT_B, accuracyM: 8, faceCheck: PASSED_FACE_CHECK }),
      ),
    );
    expect(results.map((result) => result.status).sort()).toEqual([201, 409, 409, 409, 409]);
    expect(await prisma.leaderVisit.count({ where: { pharmacyId: pharmacyB.id } })).toBe(1);
    expect(await prisma.leaderWorkDay.count()).toBe(1);
  });

  it("is only for Team Leader accounts", async () => {
    const spg = await login("081100000004");
    await expectStatus(visit(pharmacyA, POINT_A, {}, { token: spg.accessToken, userId: users.spg.id }), 403);
    await request(app).get("/api/visits/today").set(authHeader(superAdminToken)).expect(403);
  });
});

describe("Live location (ABS-03)", () => {
  it("accepts pings only during the work session", async () => {
    const before = await expectStatus(ping(), 409);
    expect(before.body).toMatchObject({ code: "OUTSIDE_WORK_SESSION", details: { status: "NOT_STARTED" } });

    await expectStatus(visit(pharmacyA, POINT_A), 201);
    const first = await expectStatus(ping(), 200);
    expect(first.body).toMatchObject({ stored: true, workDay: { status: "ACTIVE" } });

    // Ping rapat (mis. dua tab) diabaikan.
    const again = await expectStatus(ping(), 200);
    expect(again.body.stored).toBe(false);
    expect(await prisma.locationPing.count()).toBe(1);

    const spg = await login("081100000004");
    await ping(undefined, spg.accessToken).expect(403);
  });

  it("stops the session with 'Selesai hari ini' and reopens it on the next check-in", async () => {
    await request(app).post("/api/visits/end-day").set(authHeader(leaderToken)).expect(409);

    await expectStatus(visit(pharmacyA, POINT_A), 201);
    const blocked = await request(app).post("/api/visits/end-day").set(authHeader(leaderToken)).expect(409);
    expect(blocked.body.message).toMatch(/Absen keluar dulu/);

    await expectStatus(visit(pharmacyA, POINT_A, { kind: "CHECK_OUT" }), 201);
    const ended = await request(app).post("/api/visits/end-day").set(authHeader(leaderToken)).expect(200);
    expect(ended.body.workDay.status).toBe("ENDED");
    expect(await prisma.auditLog.count({ where: { action: "leader_workday.end" } })).toBe(1);

    const afterHours = await expectStatus(ping(), 409);
    expect(afterHours.body.details.status).toBe("ENDED");
    await request(app).post("/api/visits/end-day").set(authHeader(leaderToken)).expect(409);

    await expectStatus(visit(pharmacyB, POINT_B), 201);
    const today = await request(app).get("/api/visits/today").set(authHeader(leaderToken)).expect(200);
    expect(today.body.workDay).toMatchObject({ status: "ACTIVE", endedAt: null });
    await expectStatus(ping(), 200);
  });

  it("shows Super Admin and Admin the last position and daily trail", async () => {
    const otherLeader = await createUserDirect("TEAM_LEADER", "Leader Diam");
    await expectStatus(visit(pharmacyA, POINT_A), 201);
    await expectStatus(ping({ ...POINT_A, accuracyM: 12 }), 200);
    // Titik lebih lama (dimundurkan) supaya urutan jejak teruji.
    const date = businessDate();
    await prisma.locationPing.create({
      data: { userId: users.teamLeader.id, businessDate: date, recordedAt: new Date(Date.now() - 10 * 60_000), ...POINT_B, accuracyM: 20 },
    });

    const admin = await login("081100000002");
    const positions = await request(app).get("/api/locations/leaders").set(authHeader(admin.accessToken)).expect(200);
    expect(positions.body.summary).toMatchObject({ leaders: 2, active: 1, started: 1, visits: 1, openVisits: 1 });
    const row = positions.body.leaders.find((item: { leader: { id: string } }) => item.leader.id === users.teamLeader.id);
    expect(row).toMatchObject({ pingCount: 2, visitCount: 1, lastPing: { latitude: POINT_A.latitude }, openVisit: { pharmacy: { name: "Apotek Kunjungan A" } } });
    const idle = positions.body.leaders.find((item: { leader: { id: string } }) => item.leader.id === otherLeader.id);
    expect(idle).toMatchObject({ lastPing: null, workDay: { status: "NOT_STARTED" } });

    const trail = await request(app)
      .get(`/api/locations/leaders/${users.teamLeader.id}/trail?date=${date}`)
      .set(authHeader(superAdminToken))
      .expect(200);
    expect(trail.body.pings.map((point: { latitude: number }) => point.latitude)).toEqual([POINT_B.latitude, POINT_A.latitude]);
    expect(trail.body.visits).toHaveLength(1);

    await request(app).get(`/api/locations/leaders/${users.spg.id}/trail`).set(authHeader(superAdminToken)).expect(404);
    await request(app).get("/api/locations/leaders").set(authHeader(leaderToken)).expect(403);

    const overview = await request(app).get("/api/dashboard/overview").set(authHeader(superAdminToken)).expect(200);
    expect(overview.body.overview.leadersToday).toMatchObject({ active: 1, visits: 1 });
  });

  it("validates the work end time setting", async () => {
    const save = (leaderWorkEndTime: string) =>
      request(app)
        .put("/api/settings/attendance")
        .set(authHeader(superAdminToken))
        .send({ maxAccuracyM: 100, lateToleranceMinutes: 0, leaderWorkEndTime });

    await save("08:00").expect(400);
    await save("20:30").expect(200);
    const settings = await request(app).get("/api/settings").set(authHeader(superAdminToken)).expect(200);
    expect(settings.body.settings.attendance.leaderWorkEndTime).toBe("20:30");
  });
});

describe("Visit plans (KNJ-01)", () => {
  const thisWeek = mondayOf(businessDate());
  const nextWeek = addBusinessDays(thisWeek, 7);
  const savePlan = (weekStart: string, days: Array<{ date: string; pharmacyIds: string[] }>, token = leaderToken) =>
    request(app).put(`/api/visit-plans/week/${weekStart}`).set(authHeader(token)).send({ days });
  const getPlan = (weekStart: string, token = leaderToken, leaderId?: string) =>
    request(app)
      .get("/api/visit-plans")
      .query(leaderId ? { weekStart, leaderId } : { weekStart })
      .set(authHeader(token));

  it("lets a Team Leader edit next week freely before it locks", async () => {
    const monday = nextWeek;
    const tuesday = addBusinessDays(nextWeek, 1);
    const saved = await savePlan(nextWeek, [
      { date: monday, pharmacyIds: [pharmacyA.id, pharmacyB.id] },
      { date: tuesday, pharmacyIds: [pharmacyB.id] },
    ]).expect(200);
    expect(saved.body).toMatchObject({ isLocked: false, hasPlan: true, summary: { planned: 3 } });
    expect(saved.body.days[0].items.map((item: { status: string }) => item.status)).toEqual(["PENDING", "PENDING"]);

    await savePlan(nextWeek, [{ date: monday, pharmacyIds: [pharmacyB.id] }]).expect(200);
    // Sebelum terkunci, apotek yang dihapus benar-benar hilang dan tidak ada notifikasi.
    expect(await prisma.visitPlanItem.count()).toBe(2);
    expect(await prisma.notification.count({ where: { title: "Rencana kunjungan diubah" } })).toBe(0);
    expect(await prisma.auditLog.count({ where: { action: "visit_plan.update" } })).toBe(3);
  });

  it("flags changes after the week locks and tells Super Admin", async () => {
    const today = businessDate();
    const futureDay = addBusinessDays(today, 1) < nextWeek ? addBusinessDays(today, 1) : today;
    const planId = (
      await prisma.visitPlan.create({ data: { leaderId: users.teamLeader.id, weekStart: thisWeek, lockedAt: wibDateTime(thisWeek, "00:00") } })
    ).id;
    await prisma.visitPlanItem.create({ data: { planId, date: futureDay, pharmacyId: pharmacyA.id } });

    const changed = await savePlan(thisWeek, [{ date: futureDay, pharmacyIds: [pharmacyB.id] }]).expect(200);
    expect(changed.body.isLocked).toBe(true);
    const day = changed.body.days.find((item: { date: string }) => item.date === futureDay);
    expect(day.items).toEqual([
      expect.objectContaining({ pharmacy: expect.objectContaining({ id: pharmacyA.id }), status: "REMOVED" }),
      expect.objectContaining({ pharmacy: expect.objectContaining({ id: pharmacyB.id }), addedAfterLock: true, status: "PENDING" }),
    ]);
    expect(await prisma.auditLog.count({ where: { action: "visit_plan.update_after_lock" } })).toBe(1);
    expect(await prisma.notification.count({ where: { userId: users.superAdmin.id, title: "Rencana kunjungan diubah" } })).toBe(1);

    // Mengembalikan apotek yang dihapus memulihkan barisnya, bukan membuat baris baru.
    await savePlan(thisWeek, [{ date: futureDay, pharmacyIds: [pharmacyB.id, pharmacyA.id] }]).expect(200);
    const restored = await prisma.visitPlanItem.findMany({ where: { planId, pharmacyId: pharmacyA.id } });
    expect(restored).toHaveLength(1);
    expect(restored[0]).toMatchObject({ removedAt: null, addedAfterLock: false });
  });

  it("rejects past weeks, far-future weeks, inactive pharmacies, and duplicates", async () => {
    const lastWeek = addBusinessDays(thisWeek, -7);
    const past = await savePlan(lastWeek, [{ date: lastWeek, pharmacyIds: [pharmacyA.id] }]).expect(400);
    expect(past.body.message).toMatch(/sudah lewat/);

    const farWeek = addBusinessDays(thisWeek, 7 * 5);
    await savePlan(farWeek, [{ date: farWeek, pharmacyIds: [pharmacyA.id] }]).expect(400);

    await savePlan(nextWeek, [{ date: addBusinessDays(nextWeek, 7), pharmacyIds: [pharmacyA.id] }]).expect(400);
    await savePlan(nextWeek, [{ date: nextWeek, pharmacyIds: [pharmacyA.id, pharmacyA.id] }]).expect(400);
    await request(app).put(`/api/visit-plans/week/${addBusinessDays(nextWeek, 1)}`).set(authHeader(leaderToken)).send({ days: [] }).expect(400);

    await prisma.pharmacy.update({ where: { id: pharmacyB.id }, data: { status: "INACTIVE" } });
    const inactive = await savePlan(nextWeek, [{ date: nextWeek, pharmacyIds: [pharmacyA.id, pharmacyB.id] }]).expect(400);
    expect(inactive.body.message).toMatch(/tidak aktif/);
    expect(await prisma.visitPlanItem.count()).toBe(0);
  });

  it("keeps each Team Leader to their own plan", async () => {
    await savePlan(nextWeek, [{ date: nextWeek, pharmacyIds: [pharmacyA.id] }]).expect(200);
    const otherLeader = await createUserDirect("TEAM_LEADER", "Leader Lain");
    const other = await login(otherLeader.loginPhone);

    const own = await getPlan(nextWeek, other.accessToken).expect(200);
    expect(own.body).toMatchObject({ leader: { id: otherLeader.id }, hasPlan: false });
    await getPlan(nextWeek, other.accessToken, users.teamLeader.id).expect(403);

    await getPlan(nextWeek, superAdminToken).expect(400);
    const admin = await login("081100000002");
    const viewed = await getPlan(nextWeek, admin.accessToken, users.teamLeader.id).expect(200);
    expect(viewed.body.summary.planned).toBe(1);

    await savePlan(nextWeek, [{ date: nextWeek, pharmacyIds: [pharmacyA.id] }], superAdminToken).expect(403);
    const spg = await login("081100000004");
    await getPlan(nextWeek, spg.accessToken).expect(403);
  });
});

describe("Visit evaluation (KNJ-02)", () => {
  const lastWeek = addBusinessDays(mondayOf(businessDate()), -7);
  const monday = lastWeek;
  const tuesday = addBusinessDays(lastWeek, 1);

  /** Rencana minggu lalu: Senin A + B, Selasa A. Kunjungan nyata: Senin A (40 menit) dan Selasa B (di luar rencana). */
  const seedLastWeek = async () => {
    const plan = await prisma.visitPlan.create({
      data: { leaderId: users.teamLeader.id, weekStart: lastWeek, lockedAt: wibDateTime(lastWeek, "00:00") },
    });
    const [visitedItem, missedItem, tuesdayItem] = await Promise.all([
      prisma.visitPlanItem.create({ data: { planId: plan.id, date: monday, pharmacyId: pharmacyA.id } }),
      prisma.visitPlanItem.create({ data: { planId: plan.id, date: monday, pharmacyId: pharmacyB.id } }),
      prisma.visitPlanItem.create({ data: { planId: plan.id, date: tuesday, pharmacyId: pharmacyA.id } }),
    ]);

    for (const [date, pharmacy, point, start, end] of [
      [monday, pharmacyA, POINT_A, "09:00", "09:40"],
      [tuesday, pharmacyB, POINT_B, "10:00", "10:25"],
    ] as const) {
      const attendances = [];
      for (const [kind, time] of [["CHECK_IN", start], ["CHECK_OUT", end]] as const) {
        const photo = await createAttendancePhoto(users.teamLeader.id);
        attendances.push(
          await prisma.attendance.create({
            data: {
              userId: users.teamLeader.id,
              pharmacyId: pharmacy.id,
              kind,
              businessDate: date,
              serverAt: wibDateTime(date, time),
              photoFileId: photo.id,
              ...point,
              accuracyM: 9,
              distanceM: 3,
            },
          }),
        );
      }
      await prisma.leaderVisit.create({
        data: {
          leaderId: users.teamLeader.id,
          pharmacyId: pharmacy.id,
          businessDate: date,
          checkInId: attendances[0].id,
          checkOutId: attendances[1].id,
          checkInAt: attendances[0].serverAt,
          checkOutAt: attendances[1].serverAt,
          durationMin: date === monday ? 40 : 25,
        },
      });
    }

    return { visitedItem, missedItem, tuesdayItem };
  };

  const saveReason = (itemId: string, body: Record<string, unknown>, token = leaderToken) =>
    request(app).put(`/api/visit-plans/items/${itemId}/reason`).set(authHeader(token)).send(body);

  it("compares planned and actual visits per day", async () => {
    await seedLastWeek();
    const evaluation = await request(app)
      .get("/api/visit-plans")
      .query({ weekStart: lastWeek, leaderId: users.teamLeader.id })
      .set(authHeader(superAdminToken))
      .expect(200);

    const [mon, tue] = evaluation.body.days;
    // Item dibuat bersamaan di test ini, jadi urutkan per nama sebelum dibandingkan.
    const monRows = mon.items
      .map((item: { pharmacy: { name: string }; status: string; totalMinutes: number }) => [item.pharmacy.name, item.status, item.totalMinutes])
      .sort((a: string[], b: string[]) => a[0].localeCompare(b[0]));
    expect(monRows).toEqual([
      ["Apotek Kunjungan A", "VISITED", 40],
      ["Apotek Kunjungan B", "MISSED", 0],
    ]);
    expect(tue.items[0].status).toBe("MISSED");
    expect(tue.unplannedVisits).toEqual([expect.objectContaining({ pharmacy: expect.objectContaining({ name: "Apotek Kunjungan B" }), durationMin: 25 })]);
    expect(evaluation.body.summary).toMatchObject({ planned: 3, visited: 1, missed: 2, missingReason: 2, unplanned: 1, totalMinutes: 65 });

    const summary = await request(app).get(`/api/visit-plans/summary?weekStart=${lastWeek}`).set(authHeader(superAdminToken)).expect(200);
    expect(summary.body.leaders[0]).toMatchObject({ hasPlan: true, summary: { missed: 2 } });
    await request(app).get(`/api/visit-plans/summary?weekStart=${lastWeek}`).set(authHeader(leaderToken)).expect(403);

    const today = await request(app).get("/api/visits/today").set(authHeader(leaderToken)).expect(200);
    expect(today.body.missingReasons).toEqual({ count: 2, weekStart: lastWeek });
  });

  it("requires a reason for missed pharmacies, with optional evidence", async () => {
    const { visitedItem, missedItem } = await seedLastWeek();
    const evidence = await prisma.fileObject.create({
      data: {
        key: "visit_evidence/test/surat-dokter.pdf",
        purpose: "VISIT_EVIDENCE",
        mimeType: "application/pdf",
        size: 90_000,
        status: "UPLOADED",
        uploadedAt: new Date(),
        uploadedById: users.teamLeader.id,
      },
    });

    await saveReason(missedItem.id, { reason: "x" }).expect(400);
    const saved = await saveReason(missedItem.id, { reason: "Sakit, ada surat dokter", evidenceFileId: evidence.id }).expect(200);
    const item = saved.body.days[0].items.find((candidate: { id: string }) => candidate.id === missedItem.id);
    expect(item).toMatchObject({ status: "MISSED", missReason: "Sakit, ada surat dokter", evidence: { id: evidence.id, mimeType: "application/pdf" } });
    expect(saved.body.days[0].summary.missingReason).toBe(0);

    // Mengubah alasan tanpa mengirim bukti mempertahankan bukti lama.
    await saveReason(missedItem.id, { reason: "Sakit demam, ada surat dokter" }).expect(200);
    expect((await prisma.visitPlanItem.findUniqueOrThrow({ where: { id: missedItem.id } })).evidenceFileId).toBe(evidence.id);
    expect(await prisma.auditLog.count({ where: { action: "visit_plan.miss_reason" } })).toBe(2);

    const visited = await saveReason(visitedItem.id, { reason: "Tidak perlu alasan" }).expect(409);
    expect(visited.body.message).toMatch(/sudah dikunjungi/);

    const attendancePhoto = await createAttendancePhoto(users.teamLeader.id);
    await saveReason(missedItem.id, { reason: "Bukti salah jenis", evidenceFileId: attendancePhoto.id }).expect(400);

    const otherLeader = await createUserDirect("TEAM_LEADER", "Leader Lain");
    const other = await login(otherLeader.loginPhone);
    await saveReason(missedItem.id, { reason: "Bukan rencana saya" }, other.accessToken).expect(404);
    await saveReason(missedItem.id, { reason: "Super Admin tidak mengisi" }, superAdminToken).expect(403);
  });

  it("only takes reasons from the visit day onward", async () => {
    const nextWeek = addBusinessDays(mondayOf(businessDate()), 7);
    await request(app)
      .put(`/api/visit-plans/week/${nextWeek}`)
      .set(authHeader(leaderToken))
      .send({ days: [{ date: nextWeek, pharmacyIds: [pharmacyA.id] }] })
      .expect(200);
    const item = await prisma.visitPlanItem.findFirstOrThrow();
    const early = await saveReason(item.id, { reason: "Belum waktunya diisi" }).expect(409);
    expect(early.body.message).toMatch(/mulai hari kunjungan/);
  });
});
