import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/utils/prisma";
import { authHeader, login } from "../helpers/auth.helper";
import { createPharmacy, pharmacyInput, place } from "../helpers/data.helper";
import { closeDatabase, resetDatabase, seedUsers } from "../helpers/db.helper";
import type { SeededUsers } from "../helpers/db.helper";

let users: SeededUsers;
let superAdminToken: string;

beforeEach(async () => {
  await resetDatabase();
  users = await seedUsers();
  superAdminToken = (await login("081100000001")).accessToken;
});

afterAll(async () => {
  await closeDatabase();
});

describe("Pharmacies API (AKN-03)", () => {
  it("creates an active pharmacy with its own shared Kasir account", async () => {
    const input = pharmacyInput({ name: "Apotek Sehat", kasirPhone: "0813 5555 0001", radiusM: undefined });
    const response = await request(app).post("/api/pharmacies").set(authHeader(superAdminToken)).send(input).expect(201);
    const { pharmacy } = response.body;

    expect(pharmacy).toMatchObject({ name: "Apotek Sehat", status: "ACTIVE", radiusM: 20, openTime: "08:00" });
    expect(pharmacy.kasir).toMatchObject({ name: "Kasir Apotek Sehat", phone: "6281355550001", mustChangePassword: true });

    const kasir = await prisma.user.findUniqueOrThrow({ where: { id: pharmacy.kasir.id } });
    expect(kasir.role).toBe("KASIR");

    const actions = (await prisma.auditLog.findMany({ orderBy: { createdAt: "asc" } })).map((entry) => entry.action);
    expect(actions).toEqual(expect.arrayContaining(["pharmacy.create", "user.create"]));

    const session = await login("081355550001", "KasirSementara1");
    expect(session.user).toMatchObject({ role: "KASIR", mustChangePassword: true });
  });

  it("validates location, radius, opening hours, and kasir phone", async () => {
    const create = (overrides: Record<string, unknown>) =>
      request(app).post("/api/pharmacies").set(authHeader(superAdminToken)).send(pharmacyInput(overrides));

    expect((await create({ latitude: 40.7, longitude: -74 })).status).toBe(400);
    expect((await create({ radiusM: 5 })).status).toBe(400);
    expect((await create({ openTime: null, closeTime: null })).status).toBe(400);
    expect((await create({ kasirPhone: "081100000004" })).status).toBe(409);

    const allDay = await create({ is24h: true, openTime: "08:00", closeTime: "22:00" }).expect(201);
    expect(allDay.body.pharmacy).toMatchObject({ is24h: true, openTime: null, closeTime: null });
  });

  it("updates the pharmacy and keeps the Kasir account in sync", async () => {
    const pharmacy = await createPharmacy(superAdminToken, { name: "Apotek Lama" });

    const updated = await request(app)
      .patch(`/api/pharmacies/${pharmacy.id}`)
      .set(authHeader(superAdminToken))
      .send({ name: "Apotek Baru", kasirPhone: "081355550002", radiusM: 30 })
      .expect(200);

    expect(updated.body.pharmacy).toMatchObject({ name: "Apotek Baru", radiusM: 30 });
    expect(updated.body.pharmacy.kasir).toMatchObject({ name: "Kasir Apotek Baru", phone: "6281355550002" });

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "pharmacy.update" } });
    expect(audit.before).toMatchObject({ name: "Apotek Lama", radiusM: 20 });
    expect(audit.after).toMatchObject({ name: "Apotek Baru", radiusM: 30, kasirPhone: "6281355550002" });

    await request(app)
      .patch(`/api/pharmacies/${pharmacy.id}`)
      .set(authHeader(superAdminToken))
      .send({ openTime: null })
      .expect(400);
  });

  it("deactivates only pharmacies without SPG and disables the Kasir account with it", async () => {
    const pharmacy = await createPharmacy(superAdminToken, { kasirPhone: "081355550003" });
    const placement = await place(superAdminToken, users.spg.id, pharmacy.id).expect(201);
    const setStatus = (status: string) =>
      request(app).patch(`/api/pharmacies/${pharmacy.id}/status`).set(authHeader(superAdminToken)).send({ status });

    expect((await setStatus("INACTIVE")).status).toBe(409);

    await request(app)
      .post(`/api/placements/${placement.body.placement.id}/end`)
      .set(authHeader(superAdminToken))
      .send({ reason: "Pindah apotek" })
      .expect(200);

    await setStatus("INACTIVE").expect(200);
    await request(app).post("/api/auth/login").send({ phone: "081355550003", password: "KasirSementara1" }).expect(403);

    await setStatus("ACTIVE").expect(200);
    await login("081355550003", "KasirSementara1");
  });

  it("limits what each role can see and change (AKN-06)", async () => {
    const assigned = await createPharmacy(superAdminToken, { name: "Apotek Tugas" });
    const other = await createPharmacy(superAdminToken, { name: "Apotek Lain" });
    const inactive = await createPharmacy(superAdminToken, { name: "Apotek Tutup" });
    await request(app).patch(`/api/pharmacies/${inactive.id}/status`).set(authHeader(superAdminToken)).send({ status: "INACTIVE" });
    await place(superAdminToken, users.spg.id, assigned.id).expect(201);

    const names = async (token: string) =>
      (await request(app).get("/api/pharmacies").set(authHeader(token)).expect(200)).body.pharmacies.map(
        (pharmacy: { name: string }) => pharmacy.name,
      );

    const spg = await login("081100000004");
    expect(await names(spg.accessToken)).toEqual(["Apotek Tugas"]);
    await request(app).get(`/api/pharmacies/${other.id}`).set(authHeader(spg.accessToken)).expect(404);

    const leader = await login("081100000003");
    expect((await names(leader.accessToken)).sort()).toEqual(["Apotek Lain", "Apotek Tugas"]);

    await prisma.user.update({ where: { id: other.kasir.id }, data: { mustChangePassword: false } });
    const kasir = await login(other.kasir.phone, "KasirSementara1");
    expect(await names(kasir.accessToken)).toEqual(["Apotek Lain"]);

    const spgView = await request(app).get(`/api/pharmacies/${assigned.id}`).set(authHeader(spg.accessToken)).expect(200);
    expect(spgView.body.pharmacy).not.toHaveProperty("kasir");
    expect(spgView.body.pharmacy).not.toHaveProperty("placements");

    const admin = await login("081100000002");
    expect(await names(admin.accessToken)).toHaveLength(3);
    for (const token of [admin.accessToken, leader.accessToken, spg.accessToken]) {
      await request(app).post("/api/pharmacies").set(authHeader(token)).send(pharmacyInput()).expect(403);
      await request(app).patch(`/api/pharmacies/${assigned.id}`).set(authHeader(token)).send({ radiusM: 50 }).expect(403);
    }
  });
});
