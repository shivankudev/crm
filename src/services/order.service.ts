import {
  createOrder as createOrderRow,
  findOrderById,
  generateOrderCode,
  listOrders as listOrdersRows,
  listOrdersForDealer,
  updateOrder as updateOrderRow,
} from "@/repositories/order.repository";
import { findProductById } from "@/repositories/product.repository";
import { writeDealerActivity } from "@/repositories/dealer-activity.repository";
import { getDealerForUser } from "@/services/dealer.service";
import { getDealerVisibilityWhere } from "@/lib/rbac/scope";
import { can, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import type { CurrentUser } from "@/lib/auth/current-user";
import type { CreateOrderInput, UpdateOrderInput } from "@/lib/validation/order";

export class OrderServiceError extends Error {}

export class OrderNotFoundError extends Error {
  constructor() {
    super("Order not found");
    this.name = "OrderNotFoundError";
  }
}

async function getOrderForUser(id: string, actor: CurrentUser) {
  const order = await findOrderById(id);
  if (!order) throw new OrderNotFoundError();
  await getDealerForUser(order.dealerId, actor); // enforces dealer visibility + existence
  return order;
}

export async function createOrderForDealer(dealerId: string, input: CreateOrderInput, actor: CurrentUser) {
  if (!can(actor, PERMISSIONS.DEALERS_MANAGE)) throw new ForbiddenError();
  await getDealerForUser(dealerId, actor); // enforces visibility + existence

  const lineItems = await Promise.all(
    input.items.map(async (item) => {
      const product = await findProductById(item.productId);
      if (!product || !product.active) {
        throw new OrderServiceError(`Product ${item.productId} is not available`);
      }
      const unitPrice = Number(product.price);
      const gstPercent = Number(product.gstPercent);
      const subtotal = unitPrice * item.quantity - item.discount;
      if (subtotal < 0) throw new OrderServiceError("Discount cannot exceed the item subtotal");
      const gstAmount = Math.round(subtotal * (gstPercent / 100) * 100) / 100;
      const lineTotal = Math.round((subtotal + gstAmount) * 100) / 100;

      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        discount: item.discount,
        gstAmount,
        lineTotal,
      };
    })
  );

  const totalAmount = Math.round(lineItems.reduce((sum, i) => sum + i.lineTotal, 0) * 100) / 100;
  const orderCode = await generateOrderCode();

  const order = await createOrderRow({
    orderCode,
    dealer: { connect: { id: dealerId } },
    totalAmount,
    createdById: actor.id,
    items: { create: lineItems },
  });

  await writeDealerActivity({
    dealerId,
    type: "ORDER_CREATED",
    toValue: orderCode,
    meta: { totalAmount },
    userId: actor.id,
  });

  return order;
}

export async function updateOrderForUser(id: string, input: UpdateOrderInput, actor: CurrentUser) {
  if (!can(actor, PERMISSIONS.DEALERS_MANAGE)) throw new ForbiddenError();
  const order = await getOrderForUser(id, actor);

  const updated = await updateOrderRow(id, {
    paymentStatus: input.paymentStatus,
    deliveryStatus: input.deliveryStatus,
  });

  await writeDealerActivity({
    dealerId: order.dealerId,
    type: "ORDER_STATUS_CHANGED",
    toValue: order.orderCode,
    meta: { paymentStatus: input.paymentStatus, deliveryStatus: input.deliveryStatus },
    userId: actor.id,
  });

  return updated;
}

export async function listOrdersForDealerForUser(dealerId: string, actor: CurrentUser) {
  await getDealerForUser(dealerId, actor);
  return listOrdersForDealer(dealerId);
}

export async function listOrdersForUser(actor: CurrentUser, pagination: { page: number; pageSize: number }) {
  if (!can(actor, PERMISSIONS.DEALERS_MANAGE) && !can(actor, PERMISSIONS.DEALERS_VIEW_FOLLOWUP)) {
    throw new ForbiddenError();
  }
  const dealerVisibilityWhere = getDealerVisibilityWhere(actor);
  return listOrdersRows({ dealerVisibilityWhere, ...pagination });
}
