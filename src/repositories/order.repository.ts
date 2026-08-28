import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const ORDER_INCLUDE = {
  dealer: { select: { id: true, dealerCode: true, dealerName: true, phone: true } },
  items: { include: { product: { select: { id: true, name: true, model: true } } } },
} satisfies Prisma.OrderInclude;

export async function generateOrderCode(): Promise<string> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`SELECT nextval('order_code_seq') as n`;
  const n = rows[0].n;
  return `GATTI-ORD-${n.toString().padStart(6, "0")}`;
}

export function createOrder(data: Prisma.OrderCreateInput) {
  return prisma.order.create({ data, include: ORDER_INCLUDE });
}

export function findOrderById(id: string) {
  return prisma.order.findUnique({ where: { id }, include: ORDER_INCLUDE });
}

export function updateOrder(id: string, data: Prisma.OrderUpdateInput) {
  return prisma.order.update({ where: { id }, data, include: ORDER_INCLUDE });
}

export function listOrdersForDealer(dealerId: string) {
  return prisma.order.findMany({
    where: { dealerId },
    include: ORDER_INCLUDE,
    orderBy: { orderDate: "desc" },
  });
}

export type OrderListFilters = {
  dealerVisibilityWhere: Prisma.DealerWhereInput;
  page: number;
  pageSize: number;
};

export async function listOrders({ dealerVisibilityWhere, page, pageSize }: OrderListFilters) {
  const where: Prisma.OrderWhereInput = {
    dealer: { is: { AND: [dealerVisibilityWhere, { deletedAt: null }] } },
  };

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: ORDER_INCLUDE,
      orderBy: { orderDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { orders, total };
}
