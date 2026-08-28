import { prisma } from "@/lib/prisma";
import type { CreateUserInput, UpdateUserInput } from "@/lib/validation/user";

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    include: { role: true },
  });
}

export function findUserById(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: { role: true, team: true },
  });
}

export function listUsers() {
  return prisma.user.findMany({
    include: { role: true, team: true },
    orderBy: { createdAt: "asc" },
  });
}

export function createUser(data: Omit<CreateUserInput, "password"> & { passwordHash: string }) {
  return prisma.user.create({
    data: {
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash: data.passwordHash,
      roleId: data.roleId,
      teamId: data.teamId,
    },
    include: { role: true, team: true },
  });
}

export function updateUser(id: string, data: UpdateUserInput) {
  return prisma.user.update({
    where: { id },
    data,
    include: { role: true, team: true },
  });
}

export function updateUserPassword(id: string, passwordHash: string) {
  return prisma.user.update({
    where: { id },
    data: { passwordHash },
    select: { id: true },
  });
}

export function countUsersByRole(roleId: string) {
  return prisma.user.count({ where: { roleId, active: true } });
}

export function deleteUser(id: string) {
  return prisma.user.delete({ where: { id } });
}

/**
 * Whether this user has left any trace in the business data — assigned
 * or created leads, logged calls, follow-ups, notes, tasks, dealer
 * activity, audit history, or a team they manage. A hard delete only
 * makes sense at zero on every count (an unused/mistaken account);
 * anyone with real history should be deactivated instead, since deleting
 * them would either violate a foreign key or silently erase records the
 * business still needs.
 */
export async function getUserActivityCounts(id: string) {
  const [
    leadsAssigned,
    leadsCreated,
    callActivities,
    followUps,
    notes,
    tasks,
    dealerActivities,
    managedTeams,
    auditLogs,
    whatsappMessages,
  ] = await Promise.all([
    prisma.lead.count({ where: { assignedUserId: id } }),
    prisma.lead.count({ where: { createdById: id } }),
    prisma.callActivity.count({ where: { userId: id } }),
    prisma.followUp.count({ where: { assignedUserId: id } }),
    prisma.note.count({ where: { userId: id } }),
    prisma.task.count({ where: { assignedUserId: id } }),
    prisma.dealerActivity.count({ where: { userId: id } }),
    prisma.team.count({ where: { managerId: id } }),
    prisma.auditLog.count({ where: { userId: id } }),
    // Sent-message history is real business record (what a lead was told,
    // and when), so it blocks deletion the same way calls do.
    prisma.whatsAppMessageLog.count({ where: { userId: id } }),
  ]);
  return {
    total:
      leadsAssigned +
      leadsCreated +
      callActivities +
      followUps +
      notes +
      tasks +
      dealerActivities +
      managedTeams +
      auditLogs +
      whatsappMessages,
  };
}

/**
 * Active telecalling staff — the roster for the team calling-activity
 * report. Scoped to TELECALLER by role name rather than a permission
 * check, since the report is about who's on the phones, not about who
 * merely *could* log a call (every role can, per §3).
 */
export function listCallers(teamIds?: string[]) {
  return prisma.user.findMany({
    where: {
      active: true,
      role: { name: "TELECALLER" },
      ...(teamIds ? { teamId: { in: teamIds } } : {}),
    },
    select: { id: true, name: true, teamId: true },
    orderBy: { name: "asc" },
  });
}
