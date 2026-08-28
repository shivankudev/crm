import { prisma } from "@/lib/prisma";
import { getPermissionsForRole } from "@/lib/rbac/can";
import { ROLE_NAMES } from "@/lib/rbac/permissions";
import type { CurrentUser } from "@/lib/auth/current-user";

/**
 * An actor for work that no human triggered — currently the Google Sheet
 * poller running in the worker process.
 *
 * Services below the route layer are all written to take a real signed-in
 * user: they stamp createdBy, and they scope reads by that user's
 * visibility. Rather than thread a nullable "system" case through all of
 * them, background work borrows the identity of the earliest active Super
 * Admin, so imported rows are attributed to a real, auditable account.
 */
export async function getSystemActor(): Promise<CurrentUser | null> {
  const user = await prisma.user.findFirst({
    where: { active: true, role: { name: ROLE_NAMES.SUPER_ADMIN } },
    include: { role: true },
    orderBy: { createdAt: "asc" },
  });
  if (!user) return null;

  const permissions = await getPermissionsForRole(user.roleId);
  return { ...user, permissions };
}
