"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";

type Row = { id: string; name: string; active: boolean };

/** Editor for the plain name+active lookup tables: LeadSource, ResultOption, LostReason. */
export function SimpleLookupEditor({ apiBase, rows }: { apiBase: string; rows: Row[] }) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch(apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    setNewName("");
    router.refresh();
  }

  async function toggleActive(row: Row) {
    await fetch(`${apiBase}/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !row.active }),
    });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <Card className="divide-y divide-slate-100 overflow-hidden">
        {rows.length === 0 && <p className="px-4 py-3 text-sm text-slate-400">Nothing yet.</p>}
        {rows.map((row) => (
          <div key={row.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
            <span className={row.active ? "text-slate-900" : "text-slate-400 line-through"}>{row.name}</span>
            <button
              onClick={() => toggleActive(row)}
              className="hover:text-brand-600 text-xs font-medium text-slate-500"
            >
              {row.active ? "Deactivate" : "Reactivate"}
            </button>
          </div>
        ))}
      </Card>

      <form onSubmit={create} className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add new…"
          className="focus:border-brand-400 focus:ring-brand-100 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:ring-2"
        />
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-1.5 rounded bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          <Plus size={14} strokeWidth={2.5} />
          Add
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
