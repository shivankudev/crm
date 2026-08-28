import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export function listProducts(includeInactive = false) {
  return prisma.product.findMany({
    where: includeInactive ? {} : { active: true },
    orderBy: { name: "asc" },
  });
}

export function findProductById(id: string) {
  return prisma.product.findUnique({ where: { id } });
}

export function createProduct(data: Prisma.ProductCreateInput) {
  return prisma.product.create({ data });
}

export function updateProduct(id: string, data: Prisma.ProductUpdateInput) {
  return prisma.product.update({ where: { id }, data });
}
