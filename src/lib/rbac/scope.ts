import { prisma } from "@/lib/prisma";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import type { CurrentUser } from "@/lib/auth/current-user";
import type { Prisma } from "@prisma/client";

type Actor = Pick<CurrentUser, "id" | "teamId" | "permissions">;

export async function resolveTeamIds(user: Pick<CurrentUser, "id" | "teamId">): Promise<string[]> {
  const managedTeams = await prisma.team.findMany({
    where: { managerId: user.id },
    select: { id: true },
  });
  const teamIds = managedTeams.map((t) => t.id);
  if (user.teamId) teamIds.push(user.teamId);
  return teamIds;
}

/**
 * §3 permission matrix: "View all leads" is All / All / Team only /
 * Assigned only for Super Admin / Admin / Sales Manager / Telecaller.
 * Team scope = leads assigned to a member of a team this user manages,
 * plus the user's own assigned leads. Falls back to "own only" if the
 * user has team-view rights but isn't managing any team yet.
 */
export async function getLeadVisibilityWhere(user: Actor): Promise<Prisma.LeadWhereInput> {
  if (can(user, PERMISSIONS.LEADS_VIEW_ALL)) return {};

  if (can(user, PERMISSIONS.LEADS_VIEW_TEAM)) {
    const teamIds = await resolveTeamIds(user);
    if (teamIds.length === 0) return { assignedUserId: user.id };
    return { OR: [{ assignedUserId: user.id }, { assignedUser: { teamId: { in: teamIds } } }] };
  }

  if (can(user, PERMISSIONS.LEADS_VIEW_ASSIGNED)) {
    return { assignedUserId: user.id };
  }

  // No lead-visibility permission at all — matches nothing.
  return { id: "__no_access__" };
}

/**
 * §3: dealers have no team/assigned split — it's just "Manage dealers"
 * (full) or "View + follow-up" (read + interact) or no access at all.
 */
export function getDealerVisibilityWhere(user: Actor): Prisma.DealerWhereInput {
  if (can(user, PERMISSIONS.DEALERS_MANAGE) || can(user, PERMISSIONS.DEALERS_VIEW_FOLLOWUP)) return {};
  return { id: "__no_access__" };
}

/**
 * FollowUp rows are either lead-linked or dealer-linked (never both — see
 * the DB check constraint), and each parent type has its own visibility
 * rule, so this is an OR of two independently-scoped clauses rather than
 * one tier reused for both. Getting this wrong previously meant a Sales
 * Manager (LEADS_VIEW_TEAM, DEALERS_VIEW_FOLLOWUP) would have had their
 * dealer follow-ups incorrectly narrowed to "assigned to me" — dealers
 * aren't personally assigned, so that clause matched nothing.
 */
export async function getFollowUpVisibilityWhere(user: Actor): Promise<Prisma.FollowUpWhereInput> {
  const leadClause = await getLeadFollowUpClause(user);
  const dealerClause = getDealerFollowUpClause(user);

  const clauses = [leadClause, dealerClause].filter((c): c is Prisma.FollowUpWhereInput => c !== null);
  if (clauses.length === 0) return { id: "__no_access__" };
  if (clauses.length === 1) return clauses[0];
  return { OR: clauses };
}

async function getLeadFollowUpClause(user: Actor): Promise<Prisma.FollowUpWhereInput | null> {
  if (can(user, PERMISSIONS.LEADS_VIEW_ALL)) return { leadId: { not: null } };

  if (can(user, PERMISSIONS.LEADS_VIEW_TEAM)) {
    const teamIds = await resolveTeamIds(user);
    if (teamIds.length === 0) return { leadId: { not: null }, assignedUserId: user.id };
    return {
      leadId: { not: null },
      OR: [{ assignedUserId: user.id }, { assignedUser: { teamId: { in: teamIds } } }],
    };
  }

  if (can(user, PERMISSIONS.LEADS_VIEW_ASSIGNED)) {
    return { leadId: { not: null }, assignedUserId: user.id };
  }

  return null;
}

function getDealerFollowUpClause(user: Actor): Prisma.FollowUpWhereInput | null {
  if (can(user, PERMISSIONS.DEALERS_MANAGE) || can(user, PERMISSIONS.DEALERS_VIEW_FOLLOWUP)) {
    return { dealerId: { not: null } };
  }
  return null;
}
