import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/utils/prisma";
import { addBusinessDays, businessDate, mondayOf, startOfBusinessDay, weekDates } from "../../src/utils/time";
import { authHeader, login } from "../helpers/auth.helper";
import { backdatePlacements, createPharmacy, createTeam, createUserDirect, place, setTeam } from "../helpers/data.helper";
import { closeDatabase, resetDatabase, seedUsers } from "../helpers/db.helper";
import type { SeededUsers } from "../helpers/db.helper";

let users: SeededUsers;
let superAdminToken: string;
let adminToken: string;
let pharmacyId: string;
const weekStart = mondayOf(businessDate());
const dates = weekDates(weekStart);
const shift = { isOff: false, startTime: "08:00", endTime: "16:00" };

beforeEach(async () => {
  await resetDatabase();
  users = await seedUsers();
  superAdminToken = (await login("081100000001")).accessToken;
  adminToken = (await login("081100000002")).accessToken;
  pharmacyId = (await createPharmacy(superAdminToken, { name: "Apotek Jadwal" })).id;
  await place(superAdminToken, users.spg.id, pharmacyId).expect(201);
  await backdatePlacements(startOfBusinessDay(addBusinessDays(weekStart, -7)));
});

afterAll(async () => {
  await closeDatabase();
});

const saveWeek = (token: string, entries: object[], week = weekStart) =>
  request(app).put(`/api/schedules/week/${week}`).set(authHeader(token)).send({ entries });

describe("Weekly schedules (JDW-01, JDW-02)", () => {
  it("lets Admin fill a week, mark days off, and clear days, with history", async () => {
    const entries = dates.map((date, index) => ({
      spgId: users.spg.id,
      pharmacyId,
      date,
      value: index === 6 ? { isOff: true, startTime: null, endTime: null } : shift,
    }));
    const saved = await saveWeek(adminToken, entries).expect(200);

    const row = saved.body.rows.find((item: { spg: { id: string } }) => item.spg.id === users.spg.id);
    expect(row.pharmacy.name).toBe("Apotek Jadwal");
    expect(row.entries[dates[0]]).toMatchObject(shift);
    expect(row.entries[dates[6]]).toMatchObject({ isOff: true });
    expect(await prisma.auditLog.count({ where: { action: "schedule.set" } })).toBe(7);

    // Menyimpan ulang nilai yang sama tidak dicatat; null menghapus jadwal.
    await saveWeek(adminToken, [
      { spgId: users.spg.id, pharmacyId, date: dates[0], value: shift },
      { spgId: users.spg.id, pharmacyId, date: dates[1], value: null },
    ]).expect(200);
    expect(await prisma.auditLog.count({ where: { action: "schedule.set" } })).toBe(7);
    expect(await prisma.auditLog.count({ where: { action: "schedule.delete" } })).toBe(1);

    const notes = await prisma.notification.findMany({ where: { userId: users.spg.id, title: "Jadwal diperbarui" } });
    expect(notes).toHaveLength(2);
  });

  it("validates week, dates, times, and placement", async () => {
    const entry = { spgId: users.spg.id, pharmacyId, date: dates[0], value: shift };

    await saveWeek(adminToken, [entry], dates[1]).expect(400);
    await saveWeek(adminToken, [{ ...entry, date: "2020-01-06" }]).expect(400);
    await saveWeek(adminToken, [{ ...entry, value: { isOff: false, startTime: "08:00", endTime: "08:00" } }]).expect(400);
    await saveWeek(adminToken, [{ ...entry, value: { isOff: false, startTime: "25:00", endTime: "08:00" } }]).expect(400);
    await saveWeek(adminToken, [entry, entry]).expect(400);

    const unplaced = await saveWeek(adminToken, [{ ...entry, spgId: users.newcomer.id }]).expect(400);
    expect(unplaced.body.message).toMatch(/tidak ditempatkan/);
  });

  it("allows only Admin to change schedules", async () => {
    const entry = { spgId: users.spg.id, pharmacyId, date: dates[0], value: shift };
    await saveWeek(superAdminToken, [entry]).expect(403);
    await saveWeek((await login("081100000004")).accessToken, [entry]).expect(403);
  });

  it("shows each role only the schedules in its scope", async () => {
    const outsider = await createUserDirect("SPG", "SPG Tim Lain");
    const team = await createTeam(superAdminToken, users.teamLeader.id);
    await setTeam(superAdminToken, users.spg.id, team.id).expect(200);
    await place(superAdminToken, outsider.id, pharmacyId).expect(201);
    await backdatePlacements(startOfBusinessDay(addBusinessDays(weekStart, -7)));
    await saveWeek(adminToken, [
      { spgId: users.spg.id, pharmacyId, date: dates[0], value: shift },
      { spgId: outsider.id, pharmacyId, date: dates[0], value: shift },
    ]).expect(200);

    const names = async (phone: string) =>
      (await request(app).get(`/api/schedules?weekStart=${weekStart}`).set(authHeader((await login(phone)).accessToken)).expect(200))
        .body.rows.map((row: { spg: { name: string } }) => row.spg.name)
        .sort();

    expect(await names("081100000002")).toEqual(["SPG Tim Lain", "Test SPG"]);
    expect(await names("081100000003")).toEqual(["Test SPG"]);
    expect(await names("081100000004")).toEqual(["Test SPG"]);
    expect(await names(outsider.loginPhone)).toEqual(["SPG Tim Lain"]);

    const kasir = await login("081100000005");
    await request(app).get(`/api/schedules?weekStart=${weekStart}`).set(authHeader(kasir.accessToken)).expect(403);
  });
});
