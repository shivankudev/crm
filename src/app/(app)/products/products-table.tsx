"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Package } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

type Product = {
  id: string;
  name: string;
  model: string | null;
  category: string | null;
  battery: string | null;
  range: string | null;
  price: number;
  gstPercent: number;
  warranty: string | null;
  active: boolean;
};

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });
const inputClass =
  "focus:border-brand-400 focus:ring-brand-100 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2";

export function ProductsTable({ initialProducts, canManage }: { initialProducts: Product[]; canManage: boolean }) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  async function toggleActive(product: Product) {
    const res = await fetch(`/api/v1/products/${product.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !product.active }),
    });
    if (res.ok) router.refresh();
  }

  return (
    <div>
      {canManage && (
        <div className="mb-4 flex justify-end">
          <Button variant="primary" icon={Plus} onClick={() => setShowCreate(true)}>
            New product
          </Button>
        </div>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-slate-100 text-xs font-medium tracking-wide whitespace-nowrap text-slate-400 uppercase">
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Battery / Range</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">GST</th>
              <th className="px-4 py-3">Status</th>
              {canManage && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {initialProducts.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <EmptyState
                    icon={Package}
                    title="No products yet"
                    description={canManage ? "Add your first product to start attaching them to orders." : undefined}
                    actionLabel={canManage ? "New product" : undefined}
                    onAction={canManage ? () => setShowCreate(true) : undefined}
                  />
                </td>
              </tr>
            )}
            {initialProducts.map((p) => (
              <tr key={p.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <p className="font-medium text-slate-900">{p.name}</p>
                  {p.model && <p className="text-xs text-slate-400">{p.model}</p>}
                </td>
                <td className="px-4 py-3 text-slate-600">{p.category ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">
                  {[p.battery, p.range].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-4 py-3 text-slate-600">{currency.format(p.price)}</td>
                <td className="px-4 py-3 text-slate-600">{p.gstPercent}%</td>
                <td className="px-4 py-3">
                  <span className={`chip ${p.active ? "chip-pos" : "chip-mute"}`}>
                    {p.active ? "Active" : "Discontinued"}
                  </span>
                </td>
                {canManage && (
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => setEditing(p)}
                      className="hover:text-brand-600 mr-3 text-xs font-medium text-slate-500"
                    >
                      Edit
                    </button>
                    <button onClick={() => toggleActive(p)} className="text-xs font-medium text-slate-400 hover:text-slate-700">
                      {p.active ? "Discontinue" : "Reactivate"}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showCreate && (
        <ProductFormModal
          onClose={() => setShowCreate(false)}
          onSaved={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      )}
      {editing && (
        <ProductFormModal
          product={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ProductFormModal({
  product,
  onClose,
  onSaved,
}: {
  product?: Product;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    name: product?.name ?? "",
    model: product?.model ?? "",
    category: product?.category ?? "",
    battery: product?.battery ?? "",
    range: product?.range ?? "",
    price: product?.price?.toString() ?? "",
    gstPercent: product?.gstPercent?.toString() ?? "0",
    warranty: product?.warranty ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const body = {
      name: form.name,
      model: form.model || undefined,
      category: form.category || undefined,
      battery: form.battery || undefined,
      range: form.range || undefined,
      price: Number(form.price),
      gstPercent: Number(form.gstPercent),
      warranty: form.warranty || undefined,
    };

    const res = await fetch(product ? `/api/v1/products/${product.id}` : "/api/v1/products", {
      method: product ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold text-slate-900">{product ? "Edit product" : "New product"}</h2>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <input
            required
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className={inputClass}
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Model"
              value={form.model}
              onChange={(e) => setForm({ ...form, model: e.target.value })}
              className={inputClass}
            />
            <input
              placeholder="Category"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              placeholder="Battery"
              value={form.battery}
              onChange={(e) => setForm({ ...form, battery: e.target.value })}
              className={inputClass}
            />
            <input
              placeholder="Range"
              value={form.range}
              onChange={(e) => setForm({ ...form, range: e.target.value })}
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input
              required
              type="number"
              min={0}
              step="0.01"
              placeholder="Price (₹)"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              className={inputClass}
            />
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              placeholder="GST %"
              value={form.gstPercent}
              onChange={(e) => setForm({ ...form, gstPercent: e.target.value })}
              className={inputClass}
            />
          </div>
          <input
            placeholder="Warranty"
            value={form.warranty}
            onChange={(e) => setForm({ ...form, warranty: e.target.value })}
            className={inputClass}
          />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
