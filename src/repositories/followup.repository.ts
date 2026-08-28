import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const FOLLOWUP_INCLUDE = {
  lead: {
    select: { id: true, leadCode: true, name: true, phone: true, assignedUserId: true },
  },
  dealer: { select: { id: true, dealerCode: true, dealerName: true, phone: true } },
  assignedUser: { select: { id: true, name: true } },
  result: true,
} satisfies Prisma.FollowUpInclude;

const ACTIVE_STATUSES = ["PENDING", "OVERDUE"] as const;

export function createFollowUp(data: Prisma.FollowUpCreateInput) {
  return prisma.followUp.create({ data, include: FOLLOWUP_INCLUDE });
}

export function findFollowUpById(id: string) {
  return prisma.followUp.findUnique({ where: { id }, include: FOLLOWUP_INCLUDE });
}

/** Most recent active (pending/overdue) follow-up for a lead, if any. */
export function findActiveFollowUpForLead(leadId: string) {
  return prisma.followUp.findFirst({
    where: { leadId, status: { in: [...ACTIVE_STATUSES] } },
    orderBy: { scheduledDate: "desc" },
  });
}

/**
 * Reassigning a lead's owner doesn't automatically move their pending
 * work — FollowUp.assignedUserId is set once at creation from whoever
 * owned the lead then, not kept in sync with Lead.assignedUserId. Call
 * this alongside any lead reassignment so the new owner's Telecalling
 * dashboard actually shows the task instead of it staying on the old
 * owner's list.
 */
export function reassignActiveFollowUpsForLead(leadId: string, assignedUserId: string) {
  return prisma.followUp.updateMany({
    where: { leadId, status: { in: [...ACTIVE_STATUSES] } },
    data: { assignedUserId },
  });
}

/** Most recently created follow-up for a lead, active or not — used to read the next sequence number. */
export function findLatestFollowUpForLead(leadId: string) {
  return prisma.followUp.findFirst({
    where: { leadId },
    orderBy: { createdAt: "desc" },
  });
}

export function findLatestFollowUpForDealer(dealerId: string) {
  return prisma.followUp.findFirst({
    where: { dealerId },
    orderBy: { createdAt: "desc" },
  });
}

export function listFollowUpsForLead(leadId: string) {
  return prisma.followUp.findMany({
    where: { leadId },
    include: FOLLOWUP_INCLUDE,
    orderBy: { scheduledDate: "desc" },
  });
}

export function updateFollowUp(id: string, data: Prisma.FollowUpUpdateInput) {
  return prisma.followUp.update({ where: { id }, data, include: FOLLOWUP_INCLUDE });
}

export async function cancelActiveFollowUpsForLead(leadId: string) {
  return prisma.followUp.updateMany({
    where: { leadId, status: { in: [...ACTIVE_STATUSES] } },
    data: { status: "CANCELLED" },
  });
}

export async function cancelActiveFollowUpsForDealer(dealerId: string) {
  return prisma.followUp.updateMany({
    where: { dealerId, status: { in: [...ACTIVE_STATUSES] } },
    data: { status: "CANCELLED" },
  });
}

/**
 * Every still-active (PENDING/OVERDUE) follow-up currently sitting on a
 * given cadence step — the set a Settings edit to that step's rule needs
 * to reshift when Admin opts to apply the change retroactively, not just
 * to leads that haven't reached this step yet.
 */
export function listActiveFollowUpsBySequence(sequenceNumber: number, appliesTo: "LEAD" | "DEALER" | "BOTH") {
  const entityFilter: Prisma.FollowUpWhereInput =
    appliesTo === "LEAD" ? { leadId: { not: null } } : appliesTo === "DEALER" ? { dealerId: { not: null } } : {};
  return prisma.followUp.findMany({
    where: { sequenceNumber, status: { in: [...ACTIVE_STATUSES] }, ...entityFilter },
  });
}

export function listFollowUpsForDealer(dealerId: string) {
  return prisma.followUp.findMany({
    where: { dealerId },
    include: FOLLOWUP_INCLUDE,
    orderBy: { scheduledDate: "desc" },
  });
}

export type FollowUpListFilters = {
  where: Prisma.FollowUpWhereInput;
  page: number;
  pageSize: number;
};

async function listPaginated({ where, page, pageSize }: FollowUpListFilters) {
  const [total, followUps] = await Promise.all([
    prisma.followUp.count({ where }),
    prisma.followUp.findMany({
      where,
      include: FOLLOWUP_INCLUDE,
      orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { followUps, total };
}

export function listTodayFollowUps(
  scopeWhere: Prisma.FollowUpWhereInput,
  today: Date,
  pagination: { page: number; pageSize: number }
) {
  return listPaginated({
    where: {
      ...scopeWhere,
      scheduledDate: today,
      status: { in: [...ACTIVE_STATUSES] },
    },
    ...pagination,
  });
}

export function listOverdueFollowUps(
  scopeWhere: Prisma.FollowUpWhereInput,
  today: Date,
  pagination: { page: number; pageSize: number }
) {
  // AND, not spread: scopeWhere is frequently itself `{ OR: [...] }` (a
  // Sales Manager's combined lead-team + dealer visibility, see
  // getFollowUpVisibilityWhere) — a second top-level `OR` key here would
  // silently replace it rather than narrow it, leaking every overdue
  // follow-up instead of just the ones in scope.
  return listPaginated({
    where: {
      AND: [scopeWhere, { OR: [{ status: "OVERDUE" }, { status: "PENDING", scheduledDate: { lt: today } }] }],
    },
    ...pagination,
  });
}

/** Flips PENDING follow-ups whose date has passed to OVERDUE. Used by the daily worker job. */
export function flagOverdueFollowUps(today: Date) {
  return prisma.followUp.updateMany({
    where: { status: "PENDING", scheduledDate: { lt: today } },
    data: { status: "OVERDUE" },
  });
}
