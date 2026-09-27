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

  it("blocks every other role from managing accounts (BR-01)", async () => {
    for (const phone of ["081100000002", "081100000003", "081100000004", "081100000005"]) {
      const session = await login(phone);

      await request(app).get("/api/users").set(authHeader(session.accessToken)).expect(403);
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
});
