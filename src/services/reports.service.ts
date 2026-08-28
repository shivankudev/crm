import {
  getCallCountsByUserAndStatus,
  getClosedStatusBreakdown,
  getGeographyBreakdown,
  getLeadFunnel,
  getLeadSourceBreakdown,
  getTelecallerPerformance,
  getTemperatureBreakdown,
} from "@/repositories/reports.repository";
import { listCallers, findUserById } from "@/repositories/user.repository";
import { getLeadVisibilityWhere, resolveTeamIds } from "@/lib/rbac/scope";
import { can, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { addDaysUTC, todayUTC } from "@/lib/date";
import { NOT_CONNECTED_CALL_STATUSES } from "@/lib/leads/constants";
import type { CurrentUser } from "@/lib/auth/current-user";
import type { Prisma } from "@prisma/client";

function requireReportsAccess(actor: CurrentUser) {
  if (
    !can(actor, PERMISSIONS.REPORTS_VIEW_ALL) &&
    !can(actor, PERMISSIONS.REPORTS_VIEW_TEAM) &&
    !can(actor, PERMISSIONS.REPORTS_VIEW_OWN)
  ) {
    throw new ForbiddenError();
  }
}

/**
 * §3: the report permission tiers (ALL/TEAM/OWN) mirror the lead
 * visibility tiers exactly (Super Admin+Admin have both *_ALL, Sales
 * Manager has *_TEAM, Telecaller has *_OWN/ASSIGNED) — a report is just
 * an aggregate view of what the viewer can already see, so it reuses the
 * same scoping instead of a second RBAC surface.
 */
export async function getOverviewReport(actor: CurrentUser) {
  requireReportsAccess(actor);
  const where = await getLeadVisibilityWhere(actor);

  const [funnel, temperature, closedStatus] = await Promise.all([
    getLeadFunnel(where),
    getTemperatureBreakdown(where),
    getClosedStatusBreakdown(where),
  ]);

  return { funnel, temperature, closedStatus };
}

export async function getLeadSourceReport(actor: CurrentUser) {
  requireReportsAccess(actor);
  const where = await getLeadVisibilityWhere(actor);
  return getLeadSourceBreakdown(where);
}

export async function getGeographyReport(actor: CurrentUser) {
  requireReportsAccess(actor);
  const where = await getLeadVisibilityWhere(actor);
  return getGeographyBreakdown(where);
}

export async function getTelecallerPerformanceReport(
  actor: CurrentUser,
  range: { from?: Date; to?: Date }
) {
  requireReportsAccess(actor);
  const leadVisibility = await getLeadVisibilityWhere(actor);

  const dateFilter = range.from || range.to ? { gte: range.from, lte: range.to } : undefined;

  const leadWhere: Prisma.LeadWhereInput = {
    ...leadVisibility,
    ...(dateFilter ? { createdAt: dateFilter } : {}),
  };
  const callWhere: Prisma.CallActivityWhereInput = {
    lead: { is: { AND: [leadVisibility, { deletedAt: null }] } },
    ...(dateFilter ? { createdAt: dateFilter } : {}),
  };
  const followUpWhere: Prisma.FollowUpWhereInput = {
    lead: { is: { AND: [leadVisibility, { deletedAt: null }] } },
    ...(dateFilter ? { completedAt: dateFilter } : {}),
  };

  const rows = await getTelecallerPerformance({ leadWhere, callWhere, followUpWhere });

  // REPORTS_VIEW_OWN (no *_ALL/*_TEAM): only the caller's own row, even
  // though the underlying lead-visibility scope already limited the data
  // to their own leads — this also strips out other users who happen to
  // share zero-count rows.
  if (!can(actor, PERMISSIONS.REPORTS_VIEW_ALL) && !can(actor, PERMISSIONS.REPORTS_VIEW_TEAM)) {
    return rows.filter((r) => r.userId === actor.id);
  }
  return rows;
}

export type CallBucket = { connected: number; notConnected: number; callBack: number; total: number };
export type TeamCallingRow = {
  userId: string;
  userName: string;
  today: CallBucket;
  yesterday: CallBucket;
  dayBeforeYesterday: CallBucket;
  last30Days: CallBucket;
};

/**
 * Per-employee calling activity for Today / Yesterday / the day before /
 * the last 30 days — the admin-facing "who's actually working the
 * phones" view. Rostered from active TELECALLER-role users (so someone
 * who made zero calls today still shows a 0 row, which is the point),
 * scoped the same ALL/TEAM/OWN way as every other report.
 */
export async function getTeamCallingActivityReport(actor: CurrentUser): Promise<TeamCallingRow[]> {
  requireReportsAccess(actor);

  let callers: { id: string; name: string }[];
  if (can(actor, PERMISSIONS.REPORTS_VIEW_ALL)) {
    callers = await listCallers();
  } else if (can(actor, PERMISSIONS.REPORTS_VIEW_TEAM)) {
    const teamIds = await resolveTeamIds(actor);
    callers = teamIds.length > 0 ? await listCallers(teamIds) : [];
  } else {
    callers = [{ id: actor.id, name: actor.name }];
  }
  if (callers.length === 0) return [];

  const userIds = callers.map((c) => c.id);
  const today = todayUTC();
  const tomorrow = addDaysUTC(today, 1);
  const yesterday = addDaysUTC(today, -1);
  const dayBeforeYesterday = addDaysUTC(today, -2);
  const last30Start = addDaysUTC(today, -29); // today + the 29 days before it = a 30-day window

  const [todayCounts, yesterdayCounts, dayBeforeCounts, last30Counts] = await Promise.all([
    getCallCountsByUserAndStatus(userIds, today, tomorrow),
    getCallCountsByUserAndStatus(userIds, yesterday, today),
    getCallCountsByUserAndStatus(userIds, dayBeforeYesterday, yesterday),
    getCallCountsByUserAndStatus(userIds, last30Start, tomorrow),
  ]);

  function bucketFor(userId: string, rows: typeof todayCounts): CallBucket {
    const forUser = rows.filter((r) => r.userId === userId);
    const connected = forUser
      .filter((r) => r.callStatus === "CONNECTED")
      .reduce((sum, r) => sum + r._count._all, 0);
    const callBack = forUser
      .filter((r) => r.callStatus === "CALL_BACK")
      .reduce((sum, r) => sum + r._count._all, 0);
    const notConnected = forUser
      .filter((r) => NOT_CONNECTED_CALL_STATUSES.includes(r.callStatus))
      .reduce((sum, r) => sum + r._count._all, 0);
    return { connected, notConnected, callBack, total: connected + notConnected + callBack };
  }

  return callers.map((c) => ({
    userId: c.id,
    userName: c.name,
    today: bucketFor(c.id, todayCounts),
    yesterday: bucketFor(c.id, yesterdayCounts),
    dayBeforeYesterday: bucketFor(c.id, dayBeforeCounts),
    last30Days: bucketFor(c.id, last30Counts),
  }));
}

export class TelecallerNotFoundError extends Error {
  constructor() {
    super("Telecaller not found");
    this.name = "TelecallerNotFoundError";
  }
}

export type TelecallerPerformanceDetail = {
  userId: string;
  userName: string;
  from: string;
  to: string;
  leadsAssigned: number;
  leadsWon: number;
  callsLogged: number;
  followUpsCompleted: number;
  calls: CallBucket;
};

/**
 * The drill-down behind clicking a name on Team Calling Activity /
 * Telecaller Performance: one telecaller's numbers over an admin-chosen
 * date range instead of the fixed today/yesterday/30-day buckets. Access
 * is scoped the same ALL/TEAM/OWN way as the list reports, but checked
 * explicitly here since there's no lead-visibility `where` clause to
 * piggyback on — we're filtering straight by assignedUserId/userId.
 */
export async function getTelecallerPerformanceDetail(
  actor: CurrentUser,
  targetUserId: string,
  range: { from: Date; to: Date }
): Promise<TelecallerPerformanceDetail> {
  requireReportsAccess(actor);

  const target = await findUserById(targetUserId);
  if (!target) throw new TelecallerNotFoundError();

  if (!can(actor, PERMISSIONS.REPORTS_VIEW_ALL)) {
    if (can(actor, PERMISSIONS.REPORTS_VIEW_TEAM)) {
      const teamIds = await resolveTeamIds(actor);
      const inTeam = target.teamId != null && teamIds.includes(target.teamId);
      if (targetUserId !== actor.id && !inTeam) throw new ForbiddenError();
    } else if (targetUserId !== actor.id) {
      throw new ForbiddenError();
    }
  }

  // `to` is inclusive on the UI (a calendar day picker), so widen it to the
  // start of the following day for the half-open [from, to) range queries.
  const toExclusive = addDaysUTC(range.to, 1);

  const [performance, callCounts] = await Promise.all([
    getTelecallerPerformance({
      leadWhere: { assignedUserId: targetUserId, createdAt: { gte: range.from, lt: toExclusive } },
      callWhere: { userId: targetUserId, createdAt: { gte: range.from, lt: toExclusive } },
      followUpWhere: { assignedUserId: targetUserId, completedAt: { gte: range.from, lt: toExclusive } },
    }),
    getCallCountsByUserAndStatus([targetUserId], range.from, toExclusive),
  ]);

  const row = performance.find((r) => r.userId === targetUserId);
  const connected = callCounts
    .filter((r) => r.callStatus === "CONNECTED")
    .reduce((sum, r) => sum + r._count._all, 0);
  const callBack = callCounts
    .filter((r) => r.callStatus === "CALL_BACK")
    .reduce((sum, r) => sum + r._count._all, 0);
  const notConnected = callCounts
    .filter((r) => NOT_CONNECTED_CALL_STATUSES.includes(r.callStatus))
    .reduce((sum, r) => sum + r._count._all, 0);

  return {
    userId: targetUserId,
    userName: target.name,
    from: range.from.toISOString(),
    to: range.to.toISOString(),
    leadsAssigned: row?.leadsAssigned ?? 0,
    leadsWon: row?.leadsWon ?? 0,
    callsLogged: row?.callsLogged ?? 0,
    followUpsCompleted: row?.followUpsCompleted ?? 0,
    calls: { connected, notConnected, callBack, total: connected + notConnected + callBack },
  };
}
