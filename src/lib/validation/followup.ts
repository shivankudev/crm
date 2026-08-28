import { z } from "zod";

export const createFollowUpSchema = z.object({
  leadId: z.string().min(1).optional(),
  dealerId: z.string().min(1).optional(),
  assignedUserId: z.string().min(1).optional(),
  type: z.enum(["CALL", "MEETING", "FACTORY_VISIT", "DEALER_MEETING", "TASK", "OTHER"]).default("CALL"),
  scheduledDate: z.coerce.date(),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  notes: z.string().trim().max(1000).optional(),
});

export const completeFollowUpSchema = z.object({
  action: z.literal("complete"),
  resultId: z.string().min(1),
  notes: z.string().trim().max(2000).optional(),
  continueFollowUp: z.boolean().default(true),
});

export const rescheduleFollowUpSchema = z.object({
  action: z.literal("reschedule"),
  scheduledDate: z.coerce.date(),
  scheduledTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  notes: z.string().trim().max(1000).optional(),
});

export const cancelFollowUpSchema = z.object({
  action: z.literal("cancel"),
  notes: z.string().trim().max(1000).optional(),
});

export const updateFollowUpSchema = z.discriminatedUnion("action", [
  completeFollowUpSchema,
  rescheduleFollowUpSchema,
  cancelFollowUpSchema,
]);

export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;
export type UpdateFollowUpInput = z.infer<typeof updateFollowUpSchema>;
