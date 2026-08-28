import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export function createCallActivity(data: Prisma.CallActivityCreateInput) {
  return prisma.callActivity.create({
    data,
    include: { user: { select: { id: true, name: true } } },
  });
}

export function listCallActivity(leadId: string) {
  return prisma.callActivity.findMany({
    where: { leadId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

/** Call-outcome counts for one user within a date range — feeds the daily calling dashboard. */
export async function getCallStatusCountsForUser(userId: string, from: Date, to: Date) {
  const rows = await prisma.callActivity.groupBy({
    by: ["callStatus"],
    where: { userId, createdAt: { gte: from, lt: to } },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.callStatus, r._count._all])) as Record<string, number>;
}
