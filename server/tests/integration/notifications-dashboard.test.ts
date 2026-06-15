import request from "supertest";
import { app } from "../../src/app";
import { authHeader, login } from "../helpers/auth.helper";
import { createProduct } from "../helpers/data.helper";
import { closeDatabase, resetDatabase, seedUsers } from "../helpers/db.helper";

beforeEach(async () => {
  await resetDatabase();
  await seedUsers();
});

afterAll(async () => {
  await closeDatabase();
});

describe("Notifications and dashboard", () => {
  it("creates SPP notification for owner and marks notifications as read", async () => {
    const owner = await login("owner@test.local");
    const supervisor = await login("supervisor@test.local");
    const product = await createProduct(owner.accessToken);

    await request(app)
      .post("/api/purchase-requests")
      .set(authHeader(supervisor.accessToken))
      .send({ items: [{ productId: product.id, quantity: 1, estimatedPrice: 1000 }] })
      .expect(201);

    const notifications = await request(app).get("/api/notifications").set(authHeader(owner.accessToken)).expect(200);
    expect(notifications.body.notifications[0].title).toBe("SPP menunggu approval");

    const dashboardBefore = await request(app).get("/api/dashboard/summary").set(authHeader(owner.accessToken)).expect(200);
    expect(dashboardBefore.body.summary.unreadNotifications).toBeGreaterThanOrEqual(1);

    await request(app).post("/api/notifications/read-all").set(authHeader(owner.accessToken)).expect(204);

    const dashboardAfter = await request(app).get("/api/dashboard/summary").set(authHeader(owner.accessToken)).expect(200);
    expect(dashboardAfter.body.summary.unreadNotifications).toBe(0);
  });

  it("creates low stock notifications and returns role dashboard data", async () => {
    const owner = await login("owner@test.local");
    const product = await createProduct(owner.accessToken, { stockQuantity: 10, minimumStock: 5 });

    await request(app)
      .post(`/api/inventory/products/${product.id}/adjust`)
      .set(authHeader(owner.accessToken))
      .send({ quantity: 0 })
      .expect(200);

    const notifications = await request(app).get("/api/notifications").set(authHeader(owner.accessToken)).expect(200);
    expect(notifications.body.notifications.some((item: { title: string }) => item.title === "Stok rendah")).toBe(true);

    const dashboard = await request(app).get("/api/dashboard/summary").set(authHeader(owner.accessToken)).expect(200);
    expect(dashboard.body.summary.role).toBe("OWNER");
    expect(dashboard.body.summary.outStockCount).toBeGreaterThanOrEqual(1);
  });
});
