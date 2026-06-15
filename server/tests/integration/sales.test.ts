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

describe("Sales transactions", () => {
  it("creates a sale, decrements stock, and records OUT mutation", async () => {
    const owner = await login("owner@test.local");
    const sales = await login("sales@test.local");
    const product = await createProduct(owner.accessToken, { stockQuantity: 5, minimumStock: 1 });

    const sale = await request(app)
      .post("/api/sales")
      .set(authHeader(sales.accessToken))
      .send({
        paymentMethod: "CASH",
        items: [{ productId: product.id, quantity: 2 }],
      })
      .expect(201);

    expect(sale.body.transaction.total).toBe("3000");

    const productAfter = await request(app).get(`/api/products/${product.id}`).set(authHeader(sales.accessToken)).expect(200);
    expect(productAfter.body.product.stockQuantity).toBe(3);

    const mutations = await request(app)
      .get(`/api/inventory/mutations?productId=${product.id}`)
      .set(authHeader(owner.accessToken))
      .expect(200);
    expect(mutations.body.mutations.some((item: { type: string }) => item.type === "OUT")).toBe(true);
  });

  it("rejects insufficient stock and scopes sales list for sales role", async () => {
    const owner = await login("owner@test.local");
    const sales = await login("sales@test.local");
    const product = await createProduct(owner.accessToken, { stockQuantity: 1 });

    await request(app)
      .post("/api/sales")
      .set(authHeader(sales.accessToken))
      .send({ items: [{ productId: product.id, quantity: 999 }] })
      .expect(400);

    await request(app)
      .post("/api/sales")
      .set(authHeader(sales.accessToken))
      .send({ items: [{ productId: product.id, quantity: 1 }] })
      .expect(201);

    const salesList = await request(app).get("/api/sales").set(authHeader(sales.accessToken)).expect(200);
    expect(salesList.body.transactions).toHaveLength(1);
    expect(salesList.body.transactions[0].sales.email).toBe("sales@test.local");
  });
});
