import { prisma } from "@/lib/prisma";

export function listRoles() {
  return prisma.role.findMany({ orderBy: { createdAt: "asc" } });
}

export function findRoleById(id: string) {
  return prisma.role.findUnique({ where: { id } });
}

export function findRoleByName(name: string) {
  return prisma.role.findUnique({ where: { name } });
}
