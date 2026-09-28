import request from "supertest";
import { app } from "../../src/app";
import { notifyUser, notifyUsersByRole } from "../../src/modules/notifications/notifications.service";
import { authHeader, login } from "../helpers/auth.helper";
import { closeDatabase, resetDatabase, seedUsers } from "../helpers/db.helper";
import type { SeededUsers } from "../helpers/db.helper";

let users: SeededUsers;

beforeEach(async () => {
  await resetDatabase();
  users = await seedUsers();
});

afterAll(async () => {
  await closeDatabase();
});

describe("Notifications API", () => {
  it("lists only the user's own notifications and marks them read", async () => {
    await notifyUser(users.spg.id, "Order dikirim", "Order ORD-001 sedang dikirim.", "/order");
    await notifyUser(users.spg.id, "Jadwal baru", "Jadwal minggu depan sudah tersedia.");
    await notifyUsersByRole(["SUPER_ADMIN"], "Persetujuan menunggu", "Ada order baru.");

    const spg = await login("081100000004");
    const list = await request(app).get("/api/notifications").set(authHeader(spg.accessToken)).expect(200);
    expect(list.body.notifications).toHaveLength(2);
    expect(list.body.notifications.map((item: { title: string }) => item.title)).toContain("Order dikirim");

    const [first] = list.body.notifications;
    await request(app).post(`/api/notifications/${first.id}/read`).set(authHeader(spg.accessToken)).expect(204);
    await request(app).post("/api/notifications/read-all").set(authHeader(spg.accessToken)).expect(204);

    const after = await request(app).get("/api/notifications").set(authHeader(spg.accessToken)).expect(200);
    expect(after.body.notifications.every((item: { readAt: string | null }) => item.readAt)).toBe(true);

    const superAdmin = await login("081100000001");
    const adminList = await request(app).get("/api/notifications").set(authHeader(superAdmin.accessToken)).expect(200);
    expect(adminList.body.notifications).toHaveLength(1);
    expect(adminList.body.notifications[0].readAt).toBeNull();
  });
});
