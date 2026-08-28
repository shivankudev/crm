import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export function writeDealerActivity(entry: {
  dealerId: string;
  type: string;
  fromValue?: string | null;
  toValue?: string | null;
  meta?: Prisma.InputJsonValue | null;
  userId?: string | null;
}) {
  return prisma.dealerActivity.create({
    data: {
      dealerId: entry.dealerId,
      type: entry.type,
      fromValue: entry.fromValue,
      toValue: entry.toValue,
      meta: entry.meta ?? undefined,
      userId: entry.userId,
    },
  });
}

export function listDealerActivity(dealerId: string) {
  return prisma.dealerActivity.findMany({
    where: { dealerId },
    orderBy: { createdAt: "desc" },
  });
}
