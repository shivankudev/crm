import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function getLeadFunnel(where: Prisma.LeadWhereInput) {
  const statuses = await prisma.leadStatus.findMany({
    where: { active: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  const counts = await prisma.lead.groupBy({
    by: ["statusId"],
    where: { ...where, deletedAt: null },
    _count: { _all: true },
  });
  const countByStatusId = new Map(counts.map((c) => [c.statusId, c._count._all]));

  return statuses.map((s) => ({ statusName: s.name, count: countByStatusId.get(s.id) ?? 0 }));
}

export async function getTemperatureBreakdown(where: Prisma.LeadWhereInput) {
  const counts = await prisma.lead.groupBy({
    by: ["temperature"],
    where: { ...where, deletedAt: null },
    _count: { _all: true },
  });
  return counts.map((c) => ({ temperature: c.temperature, count: c._count._all }));
}

export async function getClosedStatusBreakdown(where: Prisma.LeadWhereInput) {
  const counts = await prisma.lead.groupBy({
    by: ["closedStatus"],
    where: { ...where, deletedAt: null },
    _count: { _all: true },
  });
  return counts.map((c) => ({ closedStatus: c.closedStatus, count: c._count._all }));
}

export async function getLeadSourceBreakdown(where: Prisma.LeadWhereInput) {
  const sources = await prisma.leadSource.findMany({ select: { id: true, name: true } });
  const [totalCounts, wonCounts] = await Promise.all([
    prisma.lead.groupBy({
      by: ["sourceId"],
      where: { ...where, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["sourceId"],
      where: { ...where, deletedAt: null, closedStatus: "CLOSED_WON" },
      _count: { _all: true },
    }),
  ]);
  const totalBySource = new Map(totalCounts.map((c) => [c.sourceId, c._count._all]));
  const wonBySource = new Map(wonCounts.map((c) => [c.sourceId, c._count._all]));

  const rows = sources.map((s) => ({
    sourceName: s.name,
    count: totalBySource.get(s.id) ?? 0,
    won: wonBySource.get(s.id) ?? 0,
  }));
  const noSourceCount = totalBySource.get(null) ?? 0;
  if (noSourceCount > 0) {
    rows.push({ sourceName: "(No source)", count: noSourceCount, won: wonBySource.get(null) ?? 0 });
  }
  return rows.filter((r) => r.count > 0).sort((a, b) => b.count - a.count);
}

export async function getGeographyBreakdown(where: Prisma.LeadWhereInput) {
  const states = await prisma.state.findMany({ select: { id: true, name: true } });
  const counts = await prisma.lead.groupBy({
    by: ["stateId"],
    where: { ...where, deletedAt: null },
    _count: { _all: true },
  });
  const countByState = new Map(counts.map((c) => [c.stateId, c._count._all]));

  const rows = states
    .map((s) => ({ stateName: s.name, count: countByState.get(s.id) ?? 0 }))
    .filter((r) => r.count > 0);
  const noStateCount = countByState.get(null) ?? 0;
  if (noStateCount > 0) rows.push({ stateName: "(No state)", count: noStateCount });
  return rows.sort((a, b) => b.count - a.count);
}

export type TelecallerPerformanceFilters = {
  leadWhere: Prisma.LeadWhereInput;
  callWhere: Prisma.CallActivityWhereInput;
  followUpWhere: Prisma.FollowUpWhereInput;
};

export async function getTelecallerPerformance({
  leadWhere,
  callWhere,
  followUpWhere,
}: TelecallerPerformanceFilters) {
  const [assignedCounts, wonCounts, callCounts, completedFollowUps] = await Promise.all([
    prisma.lead.groupBy({
      by: ["assignedUserId"],
      where: { ...leadWhere, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.lead.groupBy({
      by: ["assignedUserId"],
      where: { ...leadWhere, deletedAt: null, closedStatus: "CLOSED_WON" },
      _count: { _all: true },
    }),
    prisma.callActivity.groupBy({
      by: ["userId"],
      where: callWhere,
      _count: { _all: true },
    }),
    prisma.followUp.groupBy({
      by: ["assignedUserId"],
      where: { ...followUpWhere, status: "COMPLETED" },
      _count: { _all: true },
    }),
  ]);

  const userIds = new Set<string>();
  for (const row of assignedCounts) if (row.assignedUserId) userIds.add(row.assignedUserId);
  for (const row of callCounts) userIds.add(row.userId);
  for (const row of completedFollowUps) userIds.add(row.assignedUserId);

  const users = await prisma.user.findMany({
    where: { id: { in: [...userIds] } },
    select: { id: true, name: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  const leadsAssignedById = new Map(assignedCounts.map((c) => [c.assignedUserId, c._count._all]));
  const wonById = new Map(wonCounts.map((c) => [c.assignedUserId, c._count._all]));
  const callsById = new Map(callCounts.map((c) => [c.userId, c._count._all]));
  const followUpsCompletedById = new Map(completedFollowUps.map((c) => [c.assignedUserId, c._count._all]));

  return [...userIds]
    .map((userId) => ({
      userId,
      userName: nameById.get(userId) ?? "Unknown",
      leadsAssigned: leadsAssignedById.get(userId) ?? 0,
      leadsWon: wonById.get(userId) ?? 0,
      callsLogged: callsById.get(userId) ?? 0,
      followUpsCompleted: followUpsCompletedById.get(userId) ?? 0,
    }))
    .sort((a, b) => b.leadsAssigned - a.leadsAssigned);
}

/** Call counts per (user, outcome) within one date range — one query per bucket the caller asks for. */
export async function getCallCountsByUserAndStatus(userIds: string[], from: Date, to: Date) {
  if (userIds.length === 0) return [];
  return prisma.callActivity.groupBy({
    by: ["userId", "callStatus"],
    where: { userId: { in: userIds }, createdAt: { gte: from, lt: to } },
    _count: { _all: true },
  });
}
