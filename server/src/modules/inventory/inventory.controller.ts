import { asyncHandler } from "../../utils/async-handler";
import * as inventoryService from "./inventory.service";

const getParam = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export const listMutations = asyncHandler(async (req, res) => {
  const productId = typeof req.query.productId === "string" ? req.query.productId : undefined;
  const mutations = await inventoryService.listMutations(productId);
  res.json({ mutations });
});

export const adjustStock = asyncHandler(async (req, res) => {
  const product = await inventoryService.adjustStock(getParam(req.params.productId)!, req.body);
  res.json({ product });
});
