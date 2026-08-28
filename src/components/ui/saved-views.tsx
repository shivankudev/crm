"use client";

import { useEffect, useState } from "react";
import { Bookmark, Plus, X } from "lucide-react";

type SavedView = { id: string; name: string; query: string };

/**
 * Named filter presets, persisted to localStorage (per browser, not
 * synced across devices — there's no backend model for this yet, and a
 * client-only version is enough to make repeat filter combos one click
 * instead of re-picking four dropdowns every time).
 */
export function SavedViews({
  storageKey,
  currentQuery,
  hasActiveFilters,
  onApply,
}: {
  /** Distinguishes Leads' saved views from Dealers', etc. */
  storageKey: string;
  /** The current filter querystring (without leading "?") to save if the user clicks Save. */
  currentQuery: string;
  hasActiveFilters: boolean;
  onApply: (query: string) => void;
}) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  const key = `gatti-crm:saved-views:${storageKey}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(key);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setViews(JSON.parse(raw));
    } catch {
      // corrupted/absent — just start empty
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function persist(next: SavedView[]) {
    setViews(next);
    localStorage.setItem(key, JSON.stringify(next));
  }

  function save() {
    if (!name.trim()) return;
    const view: SavedView = { id: `${Date.now()}`, name: name.trim(), query: currentQuery };
    persist([...views, view]);
    setName("");
    setNaming(false);
  }

  function remove(id: string) {
    persist(views.filter((v) => v.id !== id));
  }

  if (views.length === 0 && !hasActiveFilters) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-1.5">
      {views.map((v) => (
        <span
          key={v.id}
          className="group flex items-center gap-1 rounded-full border border-slate-200 bg-white py-1 pr-1 pl-2.5 text-xs font-medium text-slate-600 transition hover:border-slate-300"
        >
          <button onClick={() => onApply(v.query)} className="hover:text-brand-600 flex items-center gap-1">
            <Bookmark size={11} />
            {v.name}
          </button>
          <button
            onClick={() => remove(v.id)}
            className="rounded-full p-0.5 text-slate-300 opacity-0 transition group-hover:opacity-100 hover:bg-slate-100 hover:text-slate-500"
            title="Remove saved view"
          >
            <X size={11} />
          </button>
        </span>
      ))}

      {naming ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="flex items-center gap-1"
        >
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => !name && setNaming(false)}
            placeholder="View name…"
            className="focus:border-brand-400 focus:ring-brand-100 w-28 rounded-full border border-slate-200 px-2.5 py-1 text-xs outline-none focus:ring-2"
          />
        </form>
      ) : (
        hasActiveFilters && (
          <button
            onClick={() => setNaming(true)}
            className="flex items-center gap-1 rounded-full border border-dashed border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-400 transition hover:border-slate-400 hover:text-slate-600"
          >
            <Plus size={11} />
            Save view
          </button>
        )
      )}
    </div>
  );
}
