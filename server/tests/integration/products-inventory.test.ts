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

describe("Products and inventory", () => {
  it("creates products, lists products for sales, and adjusts stock", async () => {
    const owner = await login("owner@test.local");
    const sales = await login("sales@test.local");
    const product = await createProduct(owner.accessToken, { stockQuantity: 10, minimumStock: 5 });

    const salesList = await request(app).get("/api/products").set(authHeader(sales.accessToken)).expect(200);
    expect(salesList.body.products.some((item: { id: string }) => item.id === product.id)).toBe(true);

    await request(app)
      .post(`/api/inventory/products/${product.id}/adjust`)
      .set(authHeader(owner.accessToken))
      .send({ quantity: 3, note: "Test adjustment" })
      .expect(200)
      .expect((response) => {
        expect(response.body.product.stockStatus).toBe("LOW");
      });

    const mutations = await request(app)
      .get(`/api/inventory/mutations?productId=${product.id}`)
      .set(authHeader(owner.accessToken))
      .expect(200);
    expect(mutations.body.mutations.some((item: { type: string }) => item.type === "ADJUSTMENT")).toBe(true);
  });

  it("blocks sales from product creation and stock adjustment", async () => {
    const owner = await login("owner@test.local");
    const sales = await login("sales@test.local");
    const product = await createProduct(owner.accessToken);

    await request(app)
      .post("/api/products")
      .set(authHeader(sales.accessToken))
      .send({
        name: "Blocked Product",
        sku: "BLOCKED",
        unit: "pcs",
        purchasePrice: 1000,
        sellingPrice: 1500,
      })
      .expect(403);

    await request(app)
      .post(`/api/inventory/products/${product.id}/adjust`)
      .set(authHeader(sales.accessToken))
      .send({ quantity: 1 })
      .expect(403);
  });
});
