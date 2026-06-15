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

describe("Purchase requests", () => {
  it("creates, approves, and realizes SPP while increasing stock", async () => {
    const owner = await login("owner@test.local");
    const supervisor = await login("supervisor@test.local");
    const product = await createProduct(owner.accessToken, { stockQuantity: 2 });

    const created = await request(app)
      .post("/api/purchase-requests")
      .set(authHeader(supervisor.accessToken))
      .send({
        supplier: "Supplier Test",
        items: [{ productId: product.id, quantity: 4, estimatedPrice: 1000 }],
      })
      .expect(201);
    expect(created.body.purchaseRequest.status).toBe("WAITING_APPROVAL");

    const approved = await request(app)
      .post(`/api/purchase-requests/${created.body.purchaseRequest.id}/approve`)
      .set(authHeader(owner.accessToken))
      .send({ note: "Approved" })
      .expect(200);
    expect(approved.body.purchaseRequest.status).toBe("APPROVED");

    const item = approved.body.purchaseRequest.items[0];
    const realized = await request(app)
      .post(`/api/purchase-requests/${approved.body.purchaseRequest.id}/realize`)
      .set(authHeader(supervisor.accessToken))
      .send({ items: [{ itemId: item.id, actualPrice: 900 }] })
      .expect(200);
    expect(realized.body.purchaseRequest.status).toBe("COMPLETED");

    const productAfter = await request(app).get(`/api/products/${product.id}`).set(authHeader(owner.accessToken)).expect(200);
    expect(productAfter.body.product.stockQuantity).toBe(6);
  });

  it("supports reject/revision decisions and blocks sales access", async () => {
    const owner = await login("owner@test.local");
    const supervisor = await login("supervisor@test.local");
    const sales = await login("sales@test.local");
    const product = await createProduct(owner.accessToken);

    const created = await request(app)
      .post("/api/purchase-requests")
      .set(authHeader(supervisor.accessToken))
      .send({ items: [{ productId: product.id, quantity: 1, estimatedPrice: 1000 }] })
      .expect(201);

    await request(app)
      .post(`/api/purchase-requests/${created.body.purchaseRequest.id}/request-revision`)
      .set(authHeader(owner.accessToken))
      .send({ note: "Revise quantity" })
      .expect(200)
      .expect((response) => {
        expect(response.body.purchaseRequest.status).toBe("REVISION_REQUESTED");
      });

    await request(app).get("/api/purchase-requests").set(authHeader(sales.accessToken)).expect(403);
  });
});
