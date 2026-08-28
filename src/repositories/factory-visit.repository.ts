import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const VISIT_INCLUDE = {
  lead: { select: { id: true, leadCode: true, name: true, phone: true, assignedUserId: true } },
} satisfies Prisma.FactoryVisitInclude;

export function createFactoryVisit(data: Prisma.FactoryVisitCreateInput) {
  return prisma.factoryVisit.create({ data, include: VISIT_INCLUDE });
}

export function findFactoryVisitById(id: string) {
  return prisma.factoryVisit.findUnique({ where: { id }, include: VISIT_INCLUDE });
}

export function updateFactoryVisit(id: string, data: Prisma.FactoryVisitUpdateInput) {
  return prisma.factoryVisit.update({ where: { id }, data, include: VISIT_INCLUDE });
}

export function listFactoryVisitsForLead(leadId: string) {
  return prisma.factoryVisit.findMany({
    where: { leadId },
    include: VISIT_INCLUDE,
    orderBy: { visitDate: "desc" },
  });
}

export type FactoryVisitListFilters = {
  leadVisibilityWhere: Prisma.LeadWhereInput;
  status?: string;
  page: number;
  pageSize: number;
};

export async function listFactoryVisits({ leadVisibilityWhere, status, page, pageSize }: FactoryVisitListFilters) {
  const where: Prisma.FactoryVisitWhereInput = {
    lead: { is: { AND: [leadVisibilityWhere, { deletedAt: null }] } },
    ...(status ? { status } : {}),
  };

  const [total, visits] = await Promise.all([
    prisma.factoryVisit.count({ where }),
    prisma.factoryVisit.findMany({
      where,
      include: VISIT_INCLUDE,
      orderBy: { visitDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { visits, total };
}
