import { prisma } from "@/lib/prisma";
import { can, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import type { CurrentUser } from "@/lib/auth/current-user";
import type { Prisma } from "@prisma/client";

export function writeAuditLog(entry: {
  userId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  previousValue?: Prisma.InputJsonValue | null;
  newValue?: Prisma.InputJsonValue | null;
}) {
  return prisma.auditLog.create({
    data: {
      userId: entry.userId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      previousValue: entry.previousValue ?? undefined,
      newValue: entry.newValue ?? undefined,
    },
  });
}

export async function listAuditLogsForUser(
  actor: CurrentUser,
  filters: { entityType?: string; page?: number; pageSize?: number }
) {
  if (!can(actor, PERMISSIONS.AUDIT_LOGS_VIEW_ALL) && !can(actor, PERMISSIONS.AUDIT_LOGS_VIEW_READONLY)) {
    throw new ForbiddenError();
  }

  const page = filters.page ?? 1;
  const pageSize = Math.min(filters.pageSize ?? 50, 200);
  const where: Prisma.AuditLogWhereInput = filters.entityType ? { entityType: filters.entityType } : {};

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { logs, total };
}
