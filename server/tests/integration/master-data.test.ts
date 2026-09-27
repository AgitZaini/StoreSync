import request from "supertest";
import { app } from "../../src/app";
import { getDeductionRateAt } from "../../src/modules/settings/settings.service";
import { prisma } from "../../src/utils/prisma";
import { authHeader, login } from "../helpers/auth.helper";
import { createPharmacy, createTeam, createUserDirect, place, setTeam } from "../helpers/data.helper";
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

describe("Products (AKN-04)", () => {
  it("lets the Super Admin manage products while others read active ones", async () => {
    const create = (body: object) => request(app).post("/api/products").set(authHeader(superAdminToken)).send(body);

    const created = await create({ code: "vit-c-500", name: "Vitamin C 500 mg", unit: "strip", price: 25000 }).expect(201);
    expect(created.body.product).toMatchObject({ code: "VIT-C-500", price: "25000" });
    await create({ code: "VIT-C-500", name: "Duplikat", unit: "strip", price: 1 }).expect(409);
    await create({ code: "X", name: "Harga pecahan", unit: "strip", price: 12.5 }).expect(400);

    const hidden = await create({ code: "OLD-01", name: "Produk Lama", unit: "box", price: 10000 }).expect(201);
    await request(app)
      .patch(`/api/products/${hidden.body.product.id}`)
      .set(authHeader(superAdminToken))
      .send({ isActive: false, price: 12000 })
      .expect(200);

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "product.update" } });
    expect(audit).toMatchObject({ before: { price: "10000", isActive: true }, after: { price: "12000", isActive: false } });

    const spg = await login("081100000004");
    const spgList = await request(app).get("/api/products?includeInactive=true").set(authHeader(spg.accessToken)).expect(200);
    expect(spgList.body.products.map((product: { code: string }) => product.code)).toEqual(["VIT-C-500"]);

    const all = await request(app).get("/api/products?includeInactive=true").set(authHeader(superAdminToken)).expect(200);
    expect(all.body.products).toHaveLength(2);

    await request(app).post("/api/products").set(authHeader(spg.accessToken)).send({ code: "A", name: "AA", unit: "x", price: 1 }).expect(403);
  });
});

describe("Sales targets (AKN-04)", () => {
  it("sets monthly targets in bulk and records each change", async () => {
    const put = (month: string, targets: object[]) =>
      request(app).put(`/api/targets/${month}`).set(authHeader(superAdminToken)).send({ targets });

    const saved = await put("2026-10", [
      { spgId: users.spg.id, amount: 15_000_000 },
      { spgId: users.newcomer.id, amount: 10_000_000 },
    ]).expect(200);
    expect(saved.body.totalAmount).toBe("25000000");

    // Nilai sama tidak dicatat ulang; null menghapus target.
    await put("2026-10", [
      { spgId: users.spg.id, amount: 15_000_000 },
      { spgId: users.newcomer.id, amount: null },
    ]).expect(200);
    expect(await prisma.auditLog.count({ where: { action: "target.set" } })).toBe(2);
    expect(await prisma.auditLog.count({ where: { action: "target.delete" } })).toBe(1);

    await put("2026-13", [{ spgId: users.spg.id, amount: 1 }]).expect(400);
    await put("2026-10", [{ spgId: users.teamLeader.id, amount: 1 }]).expect(400);
    await put("2026-10", [
      { spgId: users.spg.id, amount: 1 },
      { spgId: users.spg.id, amount: 2 },
    ]).expect(400);
  });

  it("shows each role only the targets in its scope", async () => {
    const team = await createTeam(superAdminToken, users.teamLeader.id);
    await setTeam(superAdminToken, users.spg.id, team.id).expect(200);
    await request(app)
      .put("/api/targets/2026-10")
      .set(authHeader(superAdminToken))
      .send({ targets: [{ spgId: users.spg.id, amount: 15_000_000 }, { spgId: users.newcomer.id, amount: 9_000_000 }] })
      .expect(200);

    const spgNames = async (phone: string) =>
      (await request(app).get("/api/targets?month=2026-10").set(authHeader((await login(phone)).accessToken)).expect(200)).body.targets
        .map((target: { spg: { name: string } }) => target.spg.name)
        .sort();

    expect(await spgNames("081100000001")).toEqual(["Test SPG", "Test SPG Baru"]);
    expect(await spgNames("081100000002")).toEqual(["Test SPG", "Test SPG Baru"]);
    expect(await spgNames("081100000003")).toEqual(["Test SPG"]);
    expect(await spgNames("081100000004")).toEqual(["Test SPG"]);

    const kasir = await login("081100000005");
    await request(app).get("/api/targets?month=2026-10").set(authHeader(kasir.accessToken)).expect(403);
    const spg = await login("081100000004");
    await request(app).put("/api/targets/2026-10").set(authHeader(spg.accessToken)).send({ targets: [] }).expect(403);
  });
});

describe("Settings (AKN-05)", () => {
  it("keeps the leave quota and a history of deduction rates", async () => {
    const settings = await request(app).get("/api/settings").set(authHeader(superAdminToken)).expect(200);
    expect(settings.body.settings).toMatchObject({ leaveQuotaDays: 15, deductionRate: null });

    await request(app).put("/api/settings/leave-quota").set(authHeader(superAdminToken)).send({ days: 12 }).expect(200);
    await request(app).post("/api/settings/deduction-rates").set(authHeader(superAdminToken)).send({ amountPerDay: 100000 }).expect(201);
    const rateChangedAt = new Date();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const latest = await request(app)
      .post("/api/settings/deduction-rates")
      .set(authHeader(superAdminToken))
      .send({ amountPerDay: 150000 })
      .expect(201);

    expect(latest.body.settings).toMatchObject({ leaveQuotaDays: 12, deductionRate: { amountPerDay: "150000" } });
    expect(latest.body.settings.deductionRates).toHaveLength(2);

    // Cuti yang disetujui sebelum tarif baru tetap memakai tarif lama.
    expect((await getDeductionRateAt(rateChangedAt))?.amountPerDay.toString()).toBe("100000");

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "setting.update_leave_quota" } });
    expect(audit).toMatchObject({ before: { days: 15 }, after: { days: 12 } });

    const admin = await login("081100000002");
    await request(app).get("/api/settings").set(authHeader(admin.accessToken)).expect(403);
  });
});

describe("Audit log API (LOG-01)", () => {
  it("lets only the Super Admin browse history with filters and paging", async () => {
    for (let index = 0; index < 3; index += 1) {
      await createPharmacy(superAdminToken);
    }

    const page = await request(app)
      .get("/api/audit-logs?entity=Pharmacy&limit=2")
      .set(authHeader(superAdminToken))
      .expect(200);
    expect(page.body.entries).toHaveLength(2);
    expect(page.body.entries[0]).toMatchObject({ action: "pharmacy.create", actor: { name: "Test Super Admin" } });
    expect(page.body.nextCursor).toBeTruthy();

    const next = await request(app)
      .get(`/api/audit-logs?entity=Pharmacy&limit=2&cursor=${page.body.nextCursor}`)
      .set(authHeader(superAdminToken))
      .expect(200);
    expect(next.body.entries).toHaveLength(1);
    expect(next.body.nextCursor).toBeNull();

    const logins = await request(app).get("/api/audit-logs?action=auth.").set(authHeader(superAdminToken)).expect(200);
    expect(logins.body.entries.every((entry: { action: string }) => entry.action.startsWith("auth."))).toBe(true);

    const admin = await login("081100000002");
    await request(app).get("/api/audit-logs").set(authHeader(admin.accessToken)).expect(403);
  });
});

describe("Dashboard overview", () => {
  it("summarises master data and flags SPG without placement or team", async () => {
    const pharmacy = await createPharmacy(superAdminToken);
    const team = await createTeam(superAdminToken, users.teamLeader.id);
    const lonely = await createUserDirect("SPG", "SPG Tanpa Apa-apa");
    await place(superAdminToken, users.spg.id, pharmacy.id).expect(201);
    await setTeam(superAdminToken, users.spg.id, team.id).expect(200);

    const response = await request(app).get("/api/dashboard/overview").set(authHeader(superAdminToken)).expect(200);
    const { overview } = response.body;

    expect(overview.activeUsers).toMatchObject({ SUPER_ADMIN: 1, ADMIN: 1, TEAM_LEADER: 1, SPG: 3, KASIR: 2 });
    expect(overview.pharmacies).toMatchObject({ ACTIVE: 1, INACTIVE: 0 });
    expect(overview.spgWithoutPlacement.map((spg: { name: string }) => spg.name)).toEqual(
      expect.arrayContaining([lonely.name, "Test SPG Baru"]),
    );
    expect(overview.spgWithoutTeam.map((spg: { id: string }) => spg.id)).not.toContain(users.spg.id);

    const spg = await login("081100000004");
    await request(app).get("/api/dashboard/overview").set(authHeader(spg.accessToken)).expect(403);
  });
});
