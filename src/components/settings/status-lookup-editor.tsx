"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";

type Row = { id: string; name: string; sortOrder: number; active: boolean; isTerminal?: boolean };

const numberInputClass =
  "focus:border-brand-400 focus:ring-brand-100 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:ring-2";

/**
 * Editor for LeadStatus/DealerStatus. Name is deliberately create-only —
 * business logic elsewhere matches specific status names exactly (WON,
 * LOST, AGREEMENT, PROSPECT, …), so renaming one here would silently
 * break whatever lifecycle it drives.
 */
export function StatusLookupEditor({
  apiBase,
  rows,
  showTerminal,
}: {
  apiBase: string;
  rows: Row[];
  showTerminal: boolean;
}) {
  const router = useRouter();
  const [newName, setNewName] = useState("");
  const [newSortOrder, setNewSortOrder] = useState("");
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
      body: JSON.stringify({
        name: newName.trim().toUpperCase().replace(/\s+/g, "_"),
        sortOrder: newSortOrder ? Number(newSortOrder) : rows.length * 10,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    setNewName("");
    setNewSortOrder("");
    router.refresh();
  }

  async function patch(row: Row, body: Record<string, unknown>) {
    await fetch(`${apiBase}/${row.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <Card className="divide-y divide-slate-100 overflow-hidden">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className={`flex-1 font-mono text-xs ${row.active ? "text-slate-900" : "text-slate-400 line-through"}`}>
              {row.name}
            </span>
            <input
              type="number"
              defaultValue={row.sortOrder}
              onBlur={(e) => {
                const value = Number(e.target.value);
                if (value !== row.sortOrder) patch(row, { sortOrder: value });
              }}
              className={`w-16 ${numberInputClass}`}
              title="Sort order"
            />
            {showTerminal && (
              <label className="flex items-center gap-1 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={row.isTerminal ?? false}
                  onChange={(e) => patch(row, { isTerminal: e.target.checked })}
                />
                Terminal
              </label>
            )}
            <button
              onClick={() => patch(row, { active: !row.active })}
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
          placeholder="NEW_STATUS_NAME"
          className="focus:border-brand-400 focus:ring-brand-100 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-mono outline-none focus:ring-2"
        />
        <input
          type="number"
          value={newSortOrder}
          onChange={(e) => setNewSortOrder(e.target.value)}
          placeholder="Order"
          className="focus:border-brand-400 focus:ring-brand-100 w-20 rounded-lg border border-slate-200 px-3 py-1.5 text-sm outline-none focus:ring-2"
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
