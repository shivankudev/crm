import { z } from "zod";

/**
 * The Telecalling workspace's single combined write: log a call, then let
 * the server decide what happens to the follow-up chain (see
 * OUTCOME_RULES in telecalling.service.ts) — `followUpId` is null for a
 * brand-new, never-called lead (the "NEW_LEAD" queue kind), which has no
 * follow-up due yet to complete or leave pending.
 */
export const logTelecallingOutcomeSchema = z.object({
  leadId: z.string().min(1),
  followUpId: z.string().min(1).nullable(),
  resultId: z.string().min(1),
  phoneUsed: z.string().trim().min(6).max(20),
  notes: z.string().trim().max(2000).optional(),
  continueFollowUp: z.boolean().default(true),
});

export type LogTelecallingOutcomeInput = z.infer<typeof logTelecallingOutcomeSchema>;
