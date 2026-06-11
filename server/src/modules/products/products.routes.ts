import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import { createCategorySchema, createProductSchema, updateProductSchema } from "./product.schemas";
import * as productsController from "./products.controller";

export const productsRouter = Router();

productsRouter.use(authenticate);

productsRouter.get("/categories", productsController.listCategories);
productsRouter.post(
  "/categories",
  authorize(UserRole.OWNER, UserRole.SUPERVISOR),
  validateBody(createCategorySchema),
  productsController.createCategory,
);

productsRouter.get("/", productsController.listProducts);
productsRouter.post(
  "/",
  authorize(UserRole.OWNER, UserRole.SUPERVISOR),
  validateBody(createProductSchema),
  productsController.createProduct,
);
productsRouter.get("/:id", productsController.getProduct);
productsRouter.patch(
  "/:id",
  authorize(UserRole.OWNER, UserRole.SUPERVISOR),
  validateBody(updateProductSchema),
  productsController.updateProduct,
);
