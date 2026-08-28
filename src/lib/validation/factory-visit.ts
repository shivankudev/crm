import { z } from "zod";

export const FACTORY_VISIT_STATUSES = [
  "PLANNED",
  "CONFIRMED",
  "COMPLETED",
  "CANCELLED",
  "RESCHEDULED",
  "NO_SHOW",
] as const;

export const createFactoryVisitSchema = z.object({
  visitDate: z.coerce.date(),
  contactPerson: z.string().trim().max(150).optional(),
  numberOfVisitors: z.coerce.number().int().positive().optional(),
  productDiscussed: z.string().trim().max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const updateFactoryVisitSchema = z.object({
  status: z.enum(FACTORY_VISIT_STATUSES).optional(),
  visitDate: z.coerce.date().optional(),
  contactPerson: z.string().trim().max(150).nullable().optional(),
  numberOfVisitors: z.coerce.number().int().positive().nullable().optional(),
  productDiscussed: z.string().trim().max(200).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
  result: z.string().trim().max(500).nullable().optional(),
  nextFollowupAt: z.coerce.date().nullable().optional(),
});

export type CreateFactoryVisitInput = z.infer<typeof createFactoryVisitSchema>;
export type UpdateFactoryVisitInput = z.infer<typeof updateFactoryVisitSchema>;
