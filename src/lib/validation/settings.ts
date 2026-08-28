import { z } from "zod";

export const createStatusSchema = z.object({
  name: z.string().trim().min(1).max(50).regex(/^[A-Z][A-Z0-9_]*$/, "Use UPPER_SNAKE_CASE"),
  sortOrder: z.coerce.number().int().default(0),
  isTerminal: z.boolean().default(false),
});

// Name is deliberately not editable here — several statuses are matched
// by exact name in business logic (WON/LOST/AGREEMENT/PROSPECT/etc., see
// lib/leads/constants.ts and lib/dealers/constants.ts); renaming one from
// this UI would silently break the lifecycle it drives.
export const updateStatusSchema = z.object({
  sortOrder: z.coerce.number().int().optional(),
  isTerminal: z.boolean().optional(),
  active: z.boolean().optional(),
});

export const createLookupSchema = z.object({
  name: z.string().trim().min(1).max(100),
});

export const updateLookupSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  active: z.boolean().optional(),
});

export const createFollowUpRuleSchema = z.object({
  sequenceNumber: z.coerce.number().int().positive(),
  daysAfterPrevious: z.coerce.number().int().min(0),
  defaultTime: z.string().regex(/^\d{2}:\d{2}$/, "Use HH:MM"),
  appliesTo: z.enum(["LEAD", "DEALER", "BOTH"]),
});

export const updateFollowUpRuleSchema = z.object({
  daysAfterPrevious: z.coerce.number().int().min(0).optional(),
  defaultTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  enabled: z.boolean().optional(),
  // When true, also reshifts every already-scheduled (PENDING/OVERDUE)
  // follow-up currently sitting on this rule's sequence number — not just
  // leads/dealers that haven't reached this step yet. See
  // reshiftFollowUpsForRuleChange() in followup.service.ts.
  applyToExisting: z.boolean().optional().default(false),
});

export const updateTelecallerStatusesSchema = z.object({
  statusNames: z.array(z.string()),
});
