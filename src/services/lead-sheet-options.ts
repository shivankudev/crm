import { prisma } from "@/lib/prisma";
import { ROLE_NAMES } from "@/lib/rbac/permissions";

/** Anyone who can be handed leads from a sheet — active telecallers and managers. */
export async function listCallersForSheets() {
  const users = await prisma.user.findMany({
    where: { active: true, role: { name: { in: [ROLE_NAMES.TELECALLER, ROLE_NAMES.SALES_MANAGER] } } },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  return users;
}

export function listSourcesForSheets() {
  return prisma.leadSource.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}
