import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listProductsForUser } from "@/services/product.service";
import { ProductsTable } from "@/app/(app)/products/products-table";

export default async function ProductsPage() {
  const user = await requireUser();
  const canManage = can(user, PERMISSIONS.SETTINGS_MANAGE) || can(user, PERMISSIONS.SETTINGS_MANAGE_PARTIAL);
  const products = await listProductsForUser(user, canManage);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Products</h1>
          <p className="mt-1 text-sm text-slate-500">{products.length} product(s)</p>
        </div>
      </div>

      <ProductsTable
        canManage={canManage}
        initialProducts={products.map((p) => ({
          id: p.id,
          name: p.name,
          model: p.model,
          category: p.category,
          battery: p.battery,
          range: p.range,
          price: Number(p.price),
          gstPercent: Number(p.gstPercent),
          warranty: p.warranty,
          active: p.active,
        }))}
      />
    </div>
  );
}
