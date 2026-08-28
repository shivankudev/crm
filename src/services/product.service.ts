import {
  createProduct as createProductRow,
  findProductById,
  listProducts as listProductsRows,
  updateProduct as updateProductRow,
} from "@/repositories/product.repository";
import { can, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import type { CurrentUser } from "@/lib/auth/current-user";
import type { CreateProductInput, UpdateProductInput } from "@/lib/validation/product";

export class ProductNotFoundError extends Error {
  constructor() {
    super("Product not found");
    this.name = "ProductNotFoundError";
  }
}

function canManageCatalog(actor: CurrentUser) {
  return can(actor, PERMISSIONS.SETTINGS_MANAGE) || can(actor, PERMISSIONS.SETTINGS_MANAGE_PARTIAL);
}

function canViewCatalog(actor: CurrentUser) {
  return (
    canManageCatalog(actor) ||
    can(actor, PERMISSIONS.DEALERS_MANAGE) ||
    can(actor, PERMISSIONS.DEALERS_VIEW_FOLLOWUP)
  );
}

export function listProductsForUser(actor: CurrentUser, includeInactive = false) {
  if (!canViewCatalog(actor)) throw new ForbiddenError();
  // Only catalog managers get to see discontinued products.
  return listProductsRows(includeInactive && canManageCatalog(actor));
}

export async function getProductForUser(id: string, actor: CurrentUser) {
  if (!canViewCatalog(actor)) throw new ForbiddenError();
  const product = await findProductById(id);
  if (!product) throw new ProductNotFoundError();
  return product;
}

export function createProduct(input: CreateProductInput, actor: CurrentUser) {
  if (!canManageCatalog(actor)) throw new ForbiddenError();
  return createProductRow({
    name: input.name,
    model: input.model,
    category: input.category,
    battery: input.battery,
    motor: input.motor,
    controller: input.controller,
    range: input.range,
    payload: input.payload,
    price: input.price,
    gstPercent: input.gstPercent,
    warranty: input.warranty,
  });
}

export async function updateProduct(id: string, input: UpdateProductInput, actor: CurrentUser) {
  if (!canManageCatalog(actor)) throw new ForbiddenError();
  const existing = await findProductById(id);
  if (!existing) throw new ProductNotFoundError();
  return updateProductRow(id, input);
}
