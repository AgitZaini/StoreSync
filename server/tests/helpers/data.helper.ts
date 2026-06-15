import request from "supertest";
import { app } from "../../src/app";
import { authHeader } from "./auth.helper";

export const createCategory = async (token: string, name = `Category ${Date.now()}`) => {
  const response = await request(app)
    .post("/api/products/categories")
    .set(authHeader(token))
    .send({ name })
    .expect(201);

  return response.body.category as { id: string; name: string };
};

export const createProduct = async (
  token: string,
  overrides: Partial<{
    name: string;
    sku: string;
    unit: string;
    purchasePrice: number;
    sellingPrice: number;
    stockQuantity: number;
    minimumStock: number;
    categoryId: string;
  }> = {},
) => {
  const categoryId = overrides.categoryId ?? (await createCategory(token)).id;

  const response = await request(app)
    .post("/api/products")
    .set(authHeader(token))
    .send({
      name: overrides.name ?? `Product ${Date.now()}`,
      sku: overrides.sku ?? `SKU-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      unit: overrides.unit ?? "pcs",
      purchasePrice: overrides.purchasePrice ?? 1000,
      sellingPrice: overrides.sellingPrice ?? 1500,
      stockQuantity: overrides.stockQuantity ?? 10,
      minimumStock: overrides.minimumStock ?? 3,
      categoryId,
    })
    .expect(201);

  return response.body.product as {
    id: string;
    name: string;
    sku: string;
    stockQuantity: number;
    minimumStock: number;
    unit: string;
  };
};
