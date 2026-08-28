import { z } from "zod";

export const createProductSchema = z.object({
  name: z.string().trim().min(1).max(150),
  model: z.string().trim().max(100).optional(),
  category: z.string().trim().max(100).optional(),
  battery: z.string().trim().max(100).optional(),
  motor: z.string().trim().max(100).optional(),
  controller: z.string().trim().max(100).optional(),
  range: z.string().trim().max(100).optional(),
  payload: z.string().trim().max(100).optional(),
  price: z.coerce.number().nonnegative(),
  gstPercent: z.coerce.number().min(0).max(100).default(0),
  warranty: z.string().trim().max(200).optional(),
});

export const updateProductSchema = z.object({
  name: z.string().trim().min(1).max(150).optional(),
  model: z.string().trim().max(100).nullable().optional(),
  category: z.string().trim().max(100).nullable().optional(),
  battery: z.string().trim().max(100).nullable().optional(),
  motor: z.string().trim().max(100).nullable().optional(),
  controller: z.string().trim().max(100).nullable().optional(),
  range: z.string().trim().max(100).nullable().optional(),
  payload: z.string().trim().max(100).nullable().optional(),
  price: z.coerce.number().nonnegative().optional(),
  gstPercent: z.coerce.number().min(0).max(100).optional(),
  warranty: z.string().trim().max(200).nullable().optional(),
  active: z.boolean().optional(),
});

export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
