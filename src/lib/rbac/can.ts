import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { PermissionKey } from "@/lib/rbac/permissions";
import type { CurrentUser } from "@/lib/auth/current-user";

/**
 * Role -> allowed permission keys, read fresh from `RolePermission` rows
 * (`allowed = true`). Cached per-request only — role/permission edits in
 * Settings should take effect on the next request, not require a restart.
 */
export const getPermissionsForRole = cache(async (roleId: string): Promise<Set<string>> => {
  const rows = await prisma.rolePermission.findMany({
    where: { roleId, allowed: true },
    include: { permission: true },
  });
  return new Set(rows.map((r) => r.permission.key));
});

export function can(user: Pick<CurrentUser, "permissions">, key: PermissionKey): boolean {
  return user.permissions.has(key);
}

export function canAny(user: Pick<CurrentUser, "permissions">, keys: PermissionKey[]): boolean {
  return keys.some((key) => user.permissions.has(key));
}

export class ForbiddenError extends Error {
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** For route handlers / server actions: throws instead of redirecting. */
export function requirePermission(
  user: Pick<CurrentUser, "permissions">,
  key: PermissionKey
): void {
  if (!can(user, key)) {
    throw new ForbiddenError(`Missing permission: ${key}`);
  }
}
