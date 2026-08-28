import { z } from "zod";
import { requiredPhone } from "@/lib/validation/phone";

/**
 * The Telecalling workspace's single combined write: log a call, then let
 * the server decide what happens to the follow-up chain (see
 * OUTCOME_RULES in telecalling.service.ts) — `followUpId` is null for a
 * brand-new, never-called lead (the "NEW_LEAD" queue kind), which has no
 * follow-up due yet to complete or leave pending.
 */
export const logTelecallingOutcomeSchema = z.object({
  leadId: z.string().min(1),
  // Optional entirely: a call logged from the lead's own page (an inbound
  // callback, say) has no queue context, and the server finds the open
  // follow-up itself.
  followUpId: z.string().min(1).nullable().optional(),
  direction: z.enum(["OUTBOUND", "INBOUND"]).default("OUTBOUND"),
  resultId: z.string().min(1),
  phoneUsed: requiredPhone(),
  notes: z.string().trim().max(2000).optional(),
  continueFollowUp: z.boolean().default(true),
});

export type LogTelecallingOutcomeInput = z.infer<typeof logTelecallingOutcomeSchema>;
