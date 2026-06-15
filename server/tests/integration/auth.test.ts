import request from "supertest";
import { app } from "../../src/app";
import { closeDatabase, resetDatabase, seedUsers } from "../helpers/db.helper";
import { authHeader, login } from "../helpers/auth.helper";

beforeEach(async () => {
  await resetDatabase();
  await seedUsers();
});

afterAll(async () => {
  await closeDatabase();
});

describe("Auth API", () => {
  it("logs in, returns current user, refreshes token, and logs out", async () => {
    const session = await login("owner@test.local");

    expect(session.user.email).toBe("owner@test.local");
    expect(session.user.role).toBe("OWNER");
    expect(session.accessToken).toBeTruthy();
    expect(session.refreshToken).toBeTruthy();

    const me = await request(app).get("/api/auth/me").set(authHeader(session.accessToken)).expect(200);
    expect(me.body.user.email).toBe("owner@test.local");

    const refreshed = await request(app)
      .post("/api/auth/refresh")
      .send({ refreshToken: session.refreshToken })
      .expect(200);
    expect(refreshed.body.accessToken).toBeTruthy();
    expect(refreshed.body.refreshToken).toBeTruthy();

    await request(app).post("/api/auth/logout").send({ refreshToken: refreshed.body.refreshToken }).expect(204);
  });

  it("rejects invalid login and missing bearer token", async () => {
    await request(app).post("/api/auth/login").send({ email: "owner@test.local", password: "wrong-password" }).expect(401);
    await request(app).get("/api/auth/me").expect(401);
  });
});
