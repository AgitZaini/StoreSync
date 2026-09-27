import { z } from "zod";
import { idSchema, queryBooleanSchema } from "../../utils/schemas";

export const MAX_ACTIVE_PLACEMENTS = 3;

export const createPlacementSchema = z.object({
  spgId: idSchema,
  pharmacyId: idSchema,
});

export const endPlacementSchema = z.object({
  reason: z.string().trim().min(3, "Alasan wajib diisi").max(300),
});

export const listPlacementsQuerySchema = z.object({
  spgId: idSchema.optional(),
  pharmacyId: idSchema.optional(),
  active: queryBooleanSchema.optional(),
});

export type CreatePlacementInput = z.infer<typeof createPlacementSchema>;
export type EndPlacementInput = z.infer<typeof endPlacementSchema>;
export type ListPlacementsQuery = z.infer<typeof listPlacementsQuerySchema>;
