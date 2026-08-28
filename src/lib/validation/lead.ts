import { z } from "zod";

const optionalId = z.string().min(1).nullable().optional();

export const createLeadSchema = z.object({
  name: z.string().trim().min(1).max(150),
  phone: z.string().trim().min(6).max(20),
  phone2: z.string().trim().max(20).optional(),
  whatsapp: z.string().trim().max(20).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),

  address: z.string().trim().max(500).optional(),
  pincode: z.string().trim().max(10).optional(),
  stateId: optionalId,
  districtId: optionalId,
  cityId: optionalId,

  sourceId: optionalId,
  temperature: z.enum(["HOT", "WARM", "COLD"]).default("WARM"),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),

  existingBusiness: z.string().trim().max(200).optional(),
  existingVehicleBrand: z.string().trim().max(200).optional(),
  interestedProduct: z.string().trim().max(200).optional(),
  expectedQuantity: z.coerce.number().int().positive().optional(),
  investmentCapacity: z.string().trim().max(200).optional(),
  financingRequired: z.boolean().default(false),
  competitor: z.string().trim().max(200).optional(),

  assignedUserId: optionalId,

  /** Bypasses the phoneNormalized duplicate check when the caller confirmed it's intentional. */
  allowDuplicate: z.boolean().default(false),
});

export const updateLeadSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  phone: z.string().trim().min(6).max(20).optional(),
  phone2: z.string().trim().max(20).nullable().optional(),
  whatsapp: z.string().trim().max(20).nullable().optional(),
  email: z.string().trim().email().nullable().optional().or(z.literal("")),

  address: z.string().trim().max(500).nullable().optional(),
  pincode: z.string().trim().max(10).nullable().optional(),
  stateId: optionalId,
  districtId: optionalId,
  cityId: optionalId,

  sourceId: optionalId,
  temperature: z.enum(["HOT", "WARM", "COLD"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),

  existingBusiness: z.string().trim().max(200).nullable().optional(),
  existingVehicleBrand: z.string().trim().max(200).nullable().optional(),
  interestedProduct: z.string().trim().max(200).nullable().optional(),
  expectedQuantity: z.coerce.number().int().positive().nullable().optional(),
  investmentCapacity: z.string().trim().max(200).nullable().optional(),
  financingRequired: z.boolean().optional(),
  competitor: z.string().trim().max(200).nullable().optional(),

  assignedUserId: optionalId,
});

export const changeLeadStatusSchema = z.object({
  statusId: z.string().min(1),
  resultId: z.string().min(1).optional(),
  lostReasonId: z.string().min(1).optional(),
  note: z.string().trim().max(1000).optional(),
});

export const logCallSchema = z.object({
  phoneUsed: z.string().trim().min(6).max(20),
  callStatus: z.enum([
    "CONNECTED",
    "NOT_CONNECTED",
    "BUSY",
    "SWITCHED_OFF",
    "WRONG_NUMBER",
    "CALL_BACK",
  ]),
  durationSecs: z.coerce.number().int().nonnegative().optional(),
  notes: z.string().trim().max(2000).optional(),
  nextFollowupAt: z.coerce.date().optional(),
});

export const createNoteSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type ChangeLeadStatusInput = z.infer<typeof changeLeadStatusSchema>;
export type LogCallInput = z.infer<typeof logCallSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
