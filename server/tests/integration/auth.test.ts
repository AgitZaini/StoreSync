import request from "supertest";
import { app } from "../../src/app";
import { prisma } from "../../src/utils/prisma";
import { authHeader, login } from "../helpers/auth.helper";
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

describe("Auth API", () => {
  it("logs in with a phone number in any common format", async () => {
    for (const phone of ["081100000001", "+62 811-0000-0001", "6281100000001", "81100000001"]) {
      const session = await login(phone);
      expect(session.user.id).toBe(users.superAdmin.id);
    }

    const session = await login("081100000001");
    expect(session.user).toMatchObject({ phone: "6281100000001", role: "SUPER_ADMIN", mustChangePassword: false });
    expect(session.user).not.toHaveProperty("passwordHash");

    const me = await request(app).get("/api/auth/me").set(authHeader(session.accessToken)).expect(200);
    expect(me.body.user.phone).toBe("6281100000001");
  });

  it("rotates refresh tokens and revokes them on logout", async () => {
    const session = await login("081100000004");

    const refreshed = await request(app).post("/api/auth/refresh").send({ refreshToken: session.refreshToken }).expect(200);
    expect(refreshed.body.accessToken).toBeTruthy();

    const reused = await request(app).post("/api/auth/refresh").send({ refreshToken: session.refreshToken }).expect(401);
    expect(reused.body.code).toBe("SESSION_INVALID");

    await request(app).post("/api/auth/logout").send({ refreshToken: refreshed.body.refreshToken }).expect(204);
    await request(app).post("/api/auth/refresh").send({ refreshToken: refreshed.body.refreshToken }).expect(401);
  });

  it("rejects wrong credentials, inactive accounts, and missing tokens", async () => {
    await request(app).post("/api/auth/login").send({ phone: "081100000001", password: "wrong-password1" }).expect(401);
    await request(app).post("/api/auth/login").send({ phone: "089999999999", password: TEST_PASSWORD }).expect(401);
    await request(app).post("/api/auth/login").send({ phone: "bukan-nomor", password: TEST_PASSWORD }).expect(401);
    const malformed = await request(app).post("/api/auth/login").set("Content-Type", "application/json").send('{"phone":"0811').expect(400);
    expect(malformed.body.message).toBe("Format data tidak valid");

    await prisma.user.update({ where: { id: users.spg.id }, data: { status: "INACTIVE" } });
    await request(app).post("/api/auth/login").send({ phone: "081100000004", password: TEST_PASSWORD }).expect(403);

    await request(app).get("/api/auth/me").expect(401);
  });

  it("records successful logins in the audit log", async () => {
    await login("081100000002");

    const entries = await prisma.auditLog.findMany({ where: { action: "auth.login", entityId: users.admin.id } });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ actorId: users.admin.id, actorRole: "ADMIN", entity: "User" });
    expect(entries[0].ip).toBeTruthy();
  });

  it("ends a session whose refresh token has been idle too long", async () => {
    const session = await login("081100000003");

    await prisma.refreshToken.updateMany({
      where: { userId: users.teamLeader.id },
      data: { lastUsedAt: new Date(Date.now() - 46 * 60 * 1000) },
    });

    const response = await request(app).post("/api/auth/refresh").send({ refreshToken: session.refreshToken }).expect(401);
    expect(response.body.code).toBe("SESSION_IDLE");
  });
});

describe("First-login password change", () => {
  it("blocks other endpoints until the password is changed", async () => {
    const session = await login("081100000006");
    expect(session.user.mustChangePassword).toBe(true);

    const blocked = await request(app).get("/api/notifications").set(authHeader(session.accessToken)).expect(403);
    expect(blocked.body.code).toBe("PASSWORD_CHANGE_REQUIRED");

    await request(app).get("/api/auth/me").set(authHeader(session.accessToken)).expect(200);
  });

  it("validates and applies the new password", async () => {
    const session = await login("081100000006");
    const changePassword = (body: object) =>
      request(app).post("/api/auth/change-password").set(authHeader(session.accessToken)).send(body);

    await changePassword({ currentPassword: "wrong-password1", newPassword: "NewPassword1" }).expect(400);
    await changePassword({ currentPassword: TEST_PASSWORD, newPassword: "short1" }).expect(400);
    await changePassword({ currentPassword: TEST_PASSWORD, newPassword: "onlyletters" }).expect(400);
    await changePassword({ currentPassword: TEST_PASSWORD, newPassword: TEST_PASSWORD }).expect(400);

    const changed = await changePassword({ currentPassword: TEST_PASSWORD, newPassword: "NewPassword1" }).expect(200);
    expect(changed.body.user.mustChangePassword).toBe(false);

    await request(app).get("/api/notifications").set(authHeader(changed.body.accessToken)).expect(200);

    // Sesi lama berakhir; sandi lama tidak berlaku lagi.
    await request(app).post("/api/auth/refresh").send({ refreshToken: session.refreshToken }).expect(401);
    await request(app).post("/api/auth/login").send({ phone: "081100000006", password: TEST_PASSWORD }).expect(401);
    await login("081100000006", "NewPassword1");

    const entries = await prisma.auditLog.findMany({ where: { action: "auth.change_password" } });
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      actorId: users.newcomer.id,
      before: { mustChangePassword: true },
      after: { mustChangePassword: false },
    });
  });
});
