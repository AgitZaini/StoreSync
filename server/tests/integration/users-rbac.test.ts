import request from "supertest";
import { app } from "../../src/app";
import { authHeader, login } from "../helpers/auth.helper";
import { closeDatabase, resetDatabase, seedUsers } from "../helpers/db.helper";

beforeEach(async () => {
  await resetDatabase();
  await seedUsers();
});

afterAll(async () => {
  await closeDatabase();
});

describe("Users RBAC", () => {
  it("allows owner to manage users", async () => {
    const owner = await login("owner@test.local");

    const list = await request(app).get("/api/users").set(authHeader(owner.accessToken)).expect(200);
    expect(list.body.users).toHaveLength(3);

    const created = await request(app)
      .post("/api/users")
      .set(authHeader(owner.accessToken))
      .send({
        name: "New Sales",
        email: "new-sales@test.local",
        password: "Password123!",
        role: "SALES",
      })
      .expect(201);

    expect(created.body.user.email).toBe("new-sales@test.local");
  });

  it("blocks supervisor and sales from user management", async () => {
    const supervisor = await login("supervisor@test.local");
    const sales = await login("sales@test.local");

    await request(app).get("/api/users").set(authHeader(supervisor.accessToken)).expect(403);
    await request(app).get("/api/users").set(authHeader(sales.accessToken)).expect(403);
  });
});
