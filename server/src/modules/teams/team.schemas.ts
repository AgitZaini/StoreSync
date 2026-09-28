import { z } from "zod";
import { idSchema } from "../../utils/schemas";

export const createTeamSchema = z.object({
  name: z.string().trim().min(2).max(80),
  leaderId: idSchema,
});

export const updateTeamSchema = createTeamSchema
  .partial()
  .refine((input) => Object.keys(input).length > 0, "Tidak ada perubahan");

export type CreateTeamInput = z.infer<typeof createTeamSchema>;
export type UpdateTeamInput = z.infer<typeof updateTeamSchema>;
