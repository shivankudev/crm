import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export function writeLeadActivity(entry: {
  leadId: string;
  type: string;
  fromValue?: string | null;
  toValue?: string | null;
  meta?: Prisma.InputJsonValue | null;
  createdById?: string | null;
}) {
  return prisma.leadActivity.create({
    data: {
      leadId: entry.leadId,
      type: entry.type,
      fromValue: entry.fromValue,
      toValue: entry.toValue,
      meta: entry.meta ?? undefined,
      createdById: entry.createdById,
    },
  });
}

export function listLeadActivity(leadId: string) {
  return prisma.leadActivity.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
  });
}
