"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Users2, Building2, CornerDownLeft, Command } from "lucide-react";

type SearchLead = { id: string; name: string; leadCode: string; phone: string; statusName: string };
type SearchDealer = { id: string; name: string; dealerCode: string | null; phone: string; statusName: string };

/**
 * Global Cmd+K / Ctrl+K search — jumps straight to a lead or dealer by
 * name/phone/code without navigating through the Leads/Dealers list and
 * filters by hand first. Mounted once in AppShell so it works from any
 * page in the app.
 */
export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const setOpen = onOpenChange;
  const [query, setQuery] = useState("");
  const [leads, setLeads] = useState<SearchLead[]>([]);
  const [dealers, setDealers] = useState<SearchDealer[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, setOpen]);

  useEffect(() => {
    if (open) {
      // Clear the previous search's leftovers before the palette is shown
      // again — an intentional reset-on-open, not state synced from props.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery("");
      setLeads([]);
      setDealers([]);
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (query.trim().length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLeads([]);
      setDealers([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/v1/search?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) return;
      const data = await res.json();
      setLeads(data.leads ?? []);
      setDealers(data.dealers ?? []);
      setActiveIndex(0);
    }, 200);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  const results = [
    ...leads.map((l) => ({ kind: "lead" as const, id: l.id, title: l.name, subtitle: `${l.leadCode} · ${l.phone}` })),
    ...dealers.map((d) => ({
      kind: "dealer" as const,
      id: d.id,
      title: d.name,
      subtitle: `${d.dealerCode ?? "No code"} · ${d.phone}`,
    })),
  ];

  function go(item: (typeof results)[number]) {
    setOpen(false);
    router.push(item.kind === "lead" ? `/leads/${item.id}` : `/dealers/${item.id}`);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results[activeIndex]) {
      e.preventDefault();
      go(results[activeIndex]);
    }
  }

  if (!open) return null;

  return (
    <div
      className="motion-fade fixed inset-0 z-[200] flex items-start justify-center bg-slate-900/40 pt-[12vh] backdrop-blur-[1px]"
      onClick={() => setOpen(false)}
    >
      <div
        className="motion-pop w-full max-w-lg overflow-hidden rounded-lg bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3.5">
          <Search size={16} className="shrink-0 text-slate-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search leads or dealers by name, phone, or code…"
            className="flex-1 text-sm text-slate-800 outline-none placeholder:text-slate-400"
          />
          <kbd className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">Esc</kbd>
        </div>

        <div className="max-h-80 overflow-y-auto p-1.5">
          {query.trim().length < 2 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-400">Type at least 2 characters to search.</p>
          ) : results.length === 0 ? (
            <p className="px-3 py-8 text-center text-sm text-slate-400">No matches for &ldquo;{query}&rdquo;.</p>
          ) : (
            results.map((item, i) => (
              <button
                key={`${item.kind}-${item.id}`}
                onClick={() => go(item)}
                onMouseEnter={() => setActiveIndex(i)}
                className={`flex w-full items-center gap-2.5 rounded px-3 py-2.5 text-left text-sm transition-colors ${
                  i === activeIndex ? "bg-brand-50 text-brand-700" : "text-slate-700"
                }`}
              >
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded ${
                    item.kind === "lead" ? "bg-brand-100 text-brand-600" : "bg-amber-100 text-amber-600"
                  }`}
                >
                  {item.kind === "lead" ? <Users2 size={13} /> : <Building2 size={13} />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{item.title}</span>
                  <span className="block truncate text-xs text-slate-400">{item.subtitle}</span>
                </span>
                {i === activeIndex && <CornerDownLeft size={13} className="shrink-0 text-slate-300" />}
              </button>
            ))
          )}
        </div>

        <div className="flex items-center gap-1 border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
          <Command size={11} />K to toggle · ↑↓ to navigate · ↵ to open
        </div>
      </div>
    </div>
  );
}
