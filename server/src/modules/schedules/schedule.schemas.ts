import { z } from "zod";
import { dateSchema, idSchema, timeSchema } from "../../utils/schemas";
import { businessWeekday } from "../../utils/time";

export const weekStartSchema = dateSchema.refine((date) => businessWeekday(date) === 1, "Minggu jadwal dimulai hari Senin");

export const scheduleWeekQuerySchema = z.object({
  weekStart: weekStartSchema,
  teamId: idSchema.optional(),
  pharmacyId: idSchema.optional(),
});

export const scheduleValueSchema = z
  .object({
    isOff: z.boolean(),
    startTime: timeSchema.nullable(),
    endTime: timeSchema.nullable(),
  })
  .refine(
    (value) =>
      value.isOff
        ? value.startTime === null && value.endTime === null
        : value.startTime !== null && value.endTime !== null && value.startTime !== value.endTime,
    "Isi jam masuk dan pulang yang berbeda, atau tandai libur",
  );

export const saveScheduleWeekSchema = z.object({
  entries: z
    .array(
      z.object({
        spgId: idSchema,
        pharmacyId: idSchema,
        date: dateSchema,
        /** null menghapus jadwal hari itu. */
        value: scheduleValueSchema.nullable(),
      }),
    )
    .min(1)
    .max(2000),
});

export type ScheduleWeekQuery = z.infer<typeof scheduleWeekQuerySchema>;
export type ScheduleValue = z.infer<typeof scheduleValueSchema>;
export type SaveScheduleWeekInput = z.infer<typeof saveScheduleWeekSchema>;
