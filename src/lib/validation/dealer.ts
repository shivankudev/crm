import { z } from "zod";
import { DEALER_DOC_TYPES } from "@/lib/dealers/constants";

const optionalId = z.string().min(1).nullable().optional();

export const createDealerSchema = z.object({
  dealerName: z.string().trim().min(1).max(150),
  contactPerson: z.string().trim().max(150).optional(),
  phone: z.string().trim().min(6).max(20),
  altPhone: z.string().trim().max(20).optional(),
  whatsapp: z.string().trim().max(20).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),

  address: z.string().trim().max(500).optional(),
  pincode: z.string().trim().max(10).optional(),
  stateId: optionalId,
  districtId: optionalId,
  cityId: optionalId,

  gstin: z.string().trim().max(20).optional(),
  pan: z.string().trim().max(20).optional(),
  existingBusiness: z.string().trim().max(200).optional(),
  existingEvBrands: z.string().trim().max(200).optional(),
  investmentCapacity: z.string().trim().max(200).optional(),

  /** Bypasses the phoneNormalized duplicate check when the caller confirmed it's intentional. */
  allowDuplicate: z.boolean().default(false),
});

export const updateDealerSchema = z.object({
  dealerName: z.string().trim().min(1).max(150).optional(),
  contactPerson: z.string().trim().max(150).nullable().optional(),
  phone: z.string().trim().min(6).max(20).optional(),
  altPhone: z.string().trim().max(20).nullable().optional(),
  whatsapp: z.string().trim().max(20).nullable().optional(),
  email: z.string().trim().email().nullable().optional().or(z.literal("")),

  address: z.string().trim().max(500).nullable().optional(),
  pincode: z.string().trim().max(10).nullable().optional(),
  stateId: optionalId,
  districtId: optionalId,
  cityId: optionalId,

  gstin: z.string().trim().max(20).nullable().optional(),
  pan: z.string().trim().max(20).nullable().optional(),
  existingBusiness: z.string().trim().max(200).nullable().optional(),
  existingEvBrands: z.string().trim().max(200).nullable().optional(),
  investmentCapacity: z.string().trim().max(200).nullable().optional(),
});

export const changeDealerStatusSchema = z.object({
  statusId: z.string().min(1),
  note: z.string().trim().max(1000).optional(),
});

export const dealerDocTypeSchema = z.enum(DEALER_DOC_TYPES as [string, ...string[]]);

export type CreateDealerInput = z.infer<typeof createDealerSchema>;
export type UpdateDealerInput = z.infer<typeof updateDealerSchema>;
export type ChangeDealerStatusInput = z.infer<typeof changeDealerStatusSchema>;
