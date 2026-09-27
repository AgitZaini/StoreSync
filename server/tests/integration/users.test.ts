import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/utils/prisma";
import { authHeader, login } from "../helpers/auth.helper";
import { createPharmacy, createTeam, place } from "../helpers/data.helper";
import { closeDatabase, resetDatabase, seedUsers, TEST_PASSWORD } from "../helpers/db.helper";
import type { SeededUsers } from "../helpers/db.helper";

let users: SeededUsers;

beforeEach(async () => {
  await resetDatabase();
  users = await seedUsers();
});

afterAll(async () => {
  await closeDatabase();
});

const newUser = { name: "SPG Baru", phone: "0812 3456 7890", password: "Sementara123", role: "SPG" };

describe("Users API", () => {
  it("lets the Super Admin create accounts that must change password on first login", async () => {
    const superAdmin = await login("081100000001");

    const list = await request(app).get("/api/users").set(authHeader(superAdmin.accessToken)).expect(200);
    expect(list.body.users).toHaveLength(6);
    expect(list.body.users[0]).not.toHaveProperty("passwordHash");

    const created = await request(app).post("/api/users").set(authHeader(superAdmin.accessToken)).send(newUser).expect(201);
    expect(created.body.user).toMatchObject({ phone: "6281234567890", role: "SPG", mustChangePassword: true });

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "user.create" } });
    expect(audit).toMatchObject({ actorId: users.superAdmin.id, entityId: created.body.user.id });
    expect(audit.after).not.toHaveProperty("passwordHash");

    const session = await login("081234567890", newUser.password);
    expect(session.user.mustChangePassword).toBe(true);
  });

  it("rejects duplicate and invalid phone numbers", async () => {
    const superAdmin = await login("081100000001");
    const create = (body: object) => request(app).post("/api/users").set(authHeader(superAdmin.accessToken)).send(body);

    await create({ ...newUser, phone: "+62 811 0000 0004" }).expect(409);
    await create({ ...newUser, phone: "12345" }).expect(400);
    await create({ ...newUser, role: "OWNER" }).expect(400);
  });

  it("lets Admin read users but not change them", async () => {
    const admin = await login("081100000002");

    const list = await request(app).get("/api/users?role=SPG").set(authHeader(admin.accessToken)).expect(200);
    expect(list.body.users.map((user: { name: string }) => user.name).sort()).toEqual(["Test SPG", "Test SPG Baru"]);
    await request(app).get(`/api/users/${users.spg.id}`).set(authHeader(admin.accessToken)).expect(200);

    await request(app).post("/api/users").set(authHeader(admin.accessToken)).send(newUser).expect(403);
    await request(app).patch(`/api/users/${users.spg.id}`).set(authHeader(admin.accessToken)).send({ name: "X" }).expect(403);
  });

  it("blocks every other role from managing accounts (BR-01)", async () => {
    for (const phone of ["081100000002", "081100000003", "081100000004", "081100000005"]) {
      const session = await login(phone);

      // Admin boleh membaca (lihat test sebelumnya), tapi tidak mengubah.
      await request(app)
        .get("/api/users")
        .set(authHeader(session.accessToken))
        .expect(phone === "081100000002" ? 200 : 403);
      await request(app).post("/api/users").set(authHeader(session.accessToken)).send(newUser).expect(403);
      await request(app)
        .patch(`/api/users/${users.spg.id}/status`)
        .set(authHeader(session.accessToken))
        .send({ status: "INACTIVE" })
        .expect(403);
    }
  });

  it("deactivates accounts without deleting them and ends their sessions", async () => {
    const superAdmin = await login("081100000001");
    const spg = await login("081100000004");

    const updated = await request(app)
      .patch(`/api/users/${users.spg.id}/status`)
      .set(authHeader(superAdmin.accessToken))
      .send({ status: "INACTIVE" })
      .expect(200);
    expect(updated.body.user.status).toBe("INACTIVE");

    await request(app).post("/api/auth/refresh").send({ refreshToken: spg.refreshToken }).expect(401);
    await request(app).post("/api/auth/login").send({ phone: "081100000004", password: TEST_PASSWORD }).expect(403);
    expect(await prisma.user.findUnique({ where: { id: users.spg.id } })).not.toBeNull();

    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "user.update_status" } });
    expect(audit).toMatchObject({ before: { status: "ACTIVE" }, after: { status: "INACTIVE" } });

    await request(app)
      .patch(`/api/users/${users.superAdmin.id}/status`)
      .set(authHeader(superAdmin.accessToken))
      .send({ status: "INACTIVE" })
      .expect(400);
  });

  it("updates name, phone, and role with safeguards", async () => {
    const superAdmin = await login("081100000001");
    const update = (userId: string, body: object) =>
      request(app).patch(`/api/users/${userId}`).set(authHeader(superAdmin.accessToken)).send(body);

    const updated = await update(users.admin.id, { name: "Admin Gudang", phone: "081299990000" }).expect(200);
    expect(updated.body.user).toMatchObject({ name: "Admin Gudang", phone: "6281299990000" });
    await update(users.admin.id, { phone: "081100000004" }).expect(409);
    await update(users.superAdmin.id, { role: "ADMIN" }).expect(400);
    await update(users.kasir.id, { name: "Kasir" }).expect(400);
    await request(app).post("/api/users").set(authHeader(superAdmin.accessToken)).send({ ...newUser, role: "KASIR" }).expect(400);

    // Ganti peran mengakhiri sesi karena peran tersimpan di access token.
    const spgSession = await login("081100000004");
    await update(users.spg.id, { role: "TEAM_LEADER" }).expect(200);
    await request(app).post("/api/auth/refresh").send({ refreshToken: spgSession.refreshToken }).expect(401);
  });

  it("protects active SPG placements and team leadership", async () => {
    const superAdmin = await login("081100000001");
    const pharmacy = await createPharmacy(superAdmin.accessToken);
    await place(superAdmin.accessToken, users.spg.id, pharmacy.id).expect(201);
    await createTeam(superAdmin.accessToken, users.teamLeader.id, "Tim Barat");

    const setStatus = (userId: string) =>
      request(app).patch(`/api/users/${userId}/status`).set(authHeader(superAdmin.accessToken)).send({ status: "INACTIVE" });

    expect((await setStatus(users.spg.id)).body.message).toMatch(/penempatan aktif/);
    expect((await setStatus(users.teamLeader.id)).body.message).toMatch(/Tim Barat/);
    await request(app)
      .patch(`/api/users/${users.spg.id}`)
      .set(authHeader(superAdmin.accessToken))
      .send({ role: "ADMIN" })
      .expect(409);
    expect((await setStatus(pharmacy.kasir.id)).status).toBe(400);
  });

  it("resets a password to a temporary one that must be changed", async () => {
    const superAdmin = await login("081100000001");
    const spgSession = await login("081100000004");

    await request(app)
      .post(`/api/users/${users.spg.id}/reset-password`)
      .set(authHeader(superAdmin.accessToken))
      .send({ password: "Sementara999" })
      .expect(204);

    await request(app).post("/api/auth/refresh").send({ refreshToken: spgSession.refreshToken }).expect(401);
    const session = await login("081100000004", "Sementara999");
    expect(session.user.mustChangePassword).toBe(true);
    expect(await prisma.auditLog.count({ where: { action: "user.reset_password", entityId: users.spg.id } })).toBe(1);
  });
});
