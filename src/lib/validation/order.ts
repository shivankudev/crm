import { z } from "zod";

export const orderItemInputSchema = z.object({
  productId: z.string().min(1),
  quantity: z.coerce.number().int().positive(),
  discount: z.coerce.number().nonnegative().default(0),
});

export const createOrderSchema = z.object({
  items: z.array(orderItemInputSchema).min(1, "At least one item is required"),
});

export const updateOrderSchema = z.object({
  paymentStatus: z.enum(["PENDING", "PARTIAL", "PAID", "REFUNDED"]).optional(),
  deliveryStatus: z
    .enum(["DRAFT", "CONFIRMED", "PROCESSING", "DISPATCHED", "DELIVERED", "CANCELLED"])
    .optional(),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type UpdateOrderInput = z.infer<typeof updateOrderSchema>;
