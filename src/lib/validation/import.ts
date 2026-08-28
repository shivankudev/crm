import { z } from "zod";

export const commitLeadImportSchema = z.object({
  rows: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        phone: z.string().trim().min(6),
        email: z.string().trim().optional(),
        interestedProduct: z.string().trim().optional(),
        temperature: z.enum(["HOT", "WARM", "COLD"]).optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
        sourceId: z.string().optional(),
        stateId: z.string().optional(),
        statusId: z.string().optional(),
        allowDuplicate: z.boolean().optional(),
      })
    )
    .min(1),
});

export type CommitLeadImportInput = z.infer<typeof commitLeadImportSchema>;
