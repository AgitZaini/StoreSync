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

describe("Finance and deposits", () => {
  it("creates deposit and expense, then returns finance summary", async () => {
    const owner = await login("owner@test.local");
    const sales = await login("sales@test.local");
    const product = await createProduct(owner.accessToken, {
      purchasePrice: 1000,
      sellingPrice: 1500,
      stockQuantity: 5,
    });

    await request(app)
      .post("/api/sales")
      .set(authHeader(sales.accessToken))
      .send({ items: [{ productId: product.id, quantity: 2 }] })
      .expect(201);

    await request(app)
      .post("/api/deposits")
      .set(authHeader(owner.accessToken))
      .send({ amount: 250000, destination: "Kas toko" })
      .expect(201);

    await request(app)
      .post("/api/finance/expenses")
      .set(authHeader(owner.accessToken))
      .send({ title: "Listrik", amount: 50000, category: "Operasional" })
      .expect(201);

    const summary = await request(app).get("/api/finance/summary").set(authHeader(owner.accessToken)).expect(200);
    expect(summary.body.summary.salesTotal).toBe(3000);
    expect(summary.body.summary.cogsTotal).toBe(2000);
    expect(summary.body.summary.grossProfit).toBe(1000);
    expect(summary.body.summary.depositTotal).toBe(250000);
    expect(summary.body.summary.operationalExpenseTotal).toBe(50000);
  });

  it("blocks sales from finance and deposit APIs", async () => {
    const sales = await login("sales@test.local");

    await request(app).get("/api/finance/summary").set(authHeader(sales.accessToken)).expect(403);
    await request(app).get("/api/deposits").set(authHeader(sales.accessToken)).expect(403);
  });
});
