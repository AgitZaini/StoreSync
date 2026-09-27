import { UserRole } from "@prisma/client";
import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validateBody } from "../../middleware/validate-request";
import { createProductSchema, updateProductSchema } from "./product.schemas";
import * as productsController from "./products.controller";

export const productsRouter = Router();

productsRouter.use(authenticate);

productsRouter.get("/", productsController.listProducts);
productsRouter.post("/", authorize(UserRole.SUPER_ADMIN), validateBody(createProductSchema), productsController.createProduct);
productsRouter.patch("/:id", authorize(UserRole.SUPER_ADMIN), validateBody(updateProductSchema), productsController.updateProduct);
