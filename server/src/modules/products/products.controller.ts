import { auditContext } from "../../utils/audit";
import { asyncHandler } from "../../utils/async-handler";
import { routeParam } from "../../utils/params";
import { listProductsQuerySchema } from "./product.schemas";
import * as productsService from "./products.service";

export const listProducts = asyncHandler(async (req, res) => {
  const products = await productsService.listProducts(listProductsQuerySchema.parse(req.query), req.user!);
  res.json({ products });
});

export const createProduct = asyncHandler(async (req, res) => {
  const product = await productsService.createProduct(req.body, req.user!, auditContext(req));
  res.status(201).json({ product });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await productsService.updateProduct(routeParam(req, "id"), req.body, req.user!, auditContext(req));
  res.json({ product });
});
