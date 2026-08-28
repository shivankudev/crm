import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { listOrdersForUser } from "@/services/order.service";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

const DELIVERY_STYLES: Record<string, string> = {
  DRAFT: "chip-mute",
  CONFIRMED: "chip-live",
  PROCESSING: "chip-live",
  DISPATCHED: "chip-live",
  DELIVERED: "chip-pos",
  CANCELLED: "chip-neg",
};

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const page = sp.page ? Number(sp.page) : 1;

  const { orders, total } = await listOrdersForUser(user, { page, pageSize: 25 });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Orders</h1>
      <p className="mt-1 text-sm text-slate-500">{total} order(s) in your view</p>

      <div className="mt-6 space-y-2">
        {orders.length === 0 ? (
          <div className="rounded-lg border border-slate-200/80 bg-white">
            <EmptyState icon={ShoppingCart} title="No orders yet" description="Orders placed against dealers will show up here." />
          </div>
        ) : (
          orders.map((o) => (
            <Link
              key={o.id}
              href={`/dealers/${o.dealerId}`}
              className="block rounded-lg border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(10,11,16,0.04)] transition hover:border-slate-300 hover:shadow-[0_4px_12px_rgba(10,11,16,0.06)]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{o.orderCode}</p>
                  <p className="text-xs text-slate-400">
                    {o.dealer.dealerName} · {formatDate(o.orderDate.toISOString())}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-slate-900">{currency.format(Number(o.totalAmount))}</p>
                  <span className={`chip ${DELIVERY_STYLES[o.deliveryStatus] ?? "chip-mute"}`}>
                    {o.deliveryStatus}
                  </span>
                </div>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
