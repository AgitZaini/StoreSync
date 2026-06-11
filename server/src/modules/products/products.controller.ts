import { asyncHandler } from "../../utils/async-handler";
import { productQuerySchema } from "./product.schemas";
import * as productsService from "./products.service";

const getParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export const listCategories = asyncHandler(async (_req, res) => {
  const categories = await productsService.listCategories();
  res.json({ categories });
});

export const createCategory = asyncHandler(async (req, res) => {
  const category = await productsService.createCategory(req.body);
  res.status(201).json({ category });
});

export const listProducts = asyncHandler(async (req, res) => {
  const products = await productsService.listProducts(productQuerySchema.parse(req.query));
  res.json({ products });
});

export const getProduct = asyncHandler(async (req, res) => {
  const product = await productsService.getProduct(getParam(req.params.id)!);
  res.json({ product });
});

export const createProduct = asyncHandler(async (req, res) => {
  const product = await productsService.createProduct(req.body, req.user!.id);
  res.status(201).json({ product });
});

export const updateProduct = asyncHandler(async (req, res) => {
  const product = await productsService.updateProduct(getParam(req.params.id)!, req.body);
  res.json({ product });
});
