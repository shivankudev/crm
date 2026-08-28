import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const WITH_ASSIGNEES = {
  assignees: {
    orderBy: { position: "asc" },
    include: { user: { select: { id: true, name: true, email: true, active: true } } },
  },
  source: { select: { id: true, name: true } },
} as const;

export function listLeadSheets() {
  return prisma.leadSheetSource.findMany({ orderBy: { createdAt: "asc" }, include: WITH_ASSIGNEES });
}

/** Only sheets the poller should actually visit. */
export function listPollableLeadSheets() {
  return prisma.leadSheetSource.findMany({ where: { enabled: true }, include: WITH_ASSIGNEES });
}

export function findLeadSheet(id: string) {
  return prisma.leadSheetSource.findUnique({ where: { id }, include: WITH_ASSIGNEES });
}

export function createLeadSheet(data: Prisma.LeadSheetSourceCreateInput) {
  return prisma.leadSheetSource.create({ data, include: WITH_ASSIGNEES });
}

export function updateLeadSheet(id: string, data: Prisma.LeadSheetSourceUpdateInput) {
  return prisma.leadSheetSource.update({ where: { id }, data, include: WITH_ASSIGNEES });
}

export function deleteLeadSheet(id: string) {
  return prisma.leadSheetSource.delete({ where: { id } });
}

/** Replaces the assignee list wholesale, keeping the given order as round-robin order. */
export async function setLeadSheetAssignees(sheetId: string, userIds: string[]) {
  await prisma.$transaction([
    prisma.leadSheetAssignee.deleteMany({ where: { sheetId } }),
    ...userIds.map((userId, position) =>
      prisma.leadSheetAssignee.create({ data: { sheetId, userId, position } })
    ),
    // The old rotation position may point past the end of a shortened list.
    prisma.leadSheetSource.update({ where: { id: sheetId }, data: { nextAssigneeIndex: 0 } }),
  ]);
}
