import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const LEAD_QUEUE_SELECT = {
  id: true,
  leadCode: true,
  name: true,
  phone: true,
  phone2: true,
  whatsapp: true,
  temperature: true,
  priority: true,
  interestedProduct: true,
  lastContactAt: true,
  status: { select: { id: true, name: true, isTerminal: true } },
  source: { select: { name: true } },
  state: { select: { name: true } },
} satisfies Prisma.LeadSelect;

const FOLLOWUP_QUEUE_INCLUDE = {
  lead: { select: LEAD_QUEUE_SELECT },
} satisfies Prisma.FollowUpInclude;

export function listOverdueFollowUpsForUser(userId: string, today: Date) {
  return prisma.followUp.findMany({
    where: {
      assignedUserId: userId,
      leadId: { not: null },
      OR: [{ status: "OVERDUE" }, { status: "PENDING", scheduledDate: { lt: today } }],
    },
    include: FOLLOWUP_QUEUE_INCLUDE,
    orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
  });
}

export function listTodayFollowUpsForUser(userId: string, today: Date) {
  return prisma.followUp.findMany({
    where: {
      assignedUserId: userId,
      leadId: { not: null },
      scheduledDate: today,
      status: { in: ["PENDING", "OVERDUE"] },
    },
    include: FOLLOWUP_QUEUE_INCLUDE,
    orderBy: [{ scheduledTime: "asc" }],
  });
}

/**
 * True count of follow-ups that were due today for this user, regardless
 * of what's since happened to them (still pending, completed, rescheduled,
 * cancelled) — the fixed size of "today's queue", not a live remainder.
 * Used for the dashboard/telecalling "Due today" stat, which must NOT
 * move just because the user calls something outside today's queue (an
 * overdue follow-up, a fresh new lead) — see getTelecallerDailyStats.
 */
export function countTodayFollowUpsForUser(userId: string, today: Date) {
  return prisma.followUp.count({
    where: { assignedUserId: userId, leadId: { not: null }, scheduledDate: today },
  });
}

/** NEW leads assigned to this user with no call logged yet — first-contact queue. */
export function listUnworkedNewLeadsForUser(userId: string, limit = 25) {
  return prisma.lead.findMany({
    where: {
      assignedUserId: userId,
      deletedAt: null,
      status: { name: "NEW" },
      callActivities: { none: {} },
    },
    select: LEAD_QUEUE_SELECT,
    orderBy: { createdAt: "asc" },
    take: limit,
  });
}
