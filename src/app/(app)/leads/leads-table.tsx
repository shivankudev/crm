"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, Plus, ChevronLeft, ChevronRight, X, Users2 } from "lucide-react";
import { StatusBadge } from "@/components/leads/status-badge";
import { TemperatureBadge } from "@/components/leads/temperature-badge";
import { Card } from "@/components/ui/card";
import { PhoneChip } from "@/components/ui/phone-chip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { SavedViews } from "@/components/ui/saved-views";
import { useToast } from "@/components/ui/toast";
import { formatDate } from "@/lib/format";
import { CreateLeadModal } from "@/app/(app)/leads/create-lead-modal";

type LeadRow = {
  id: string;
  leadCode: string;
  name: string;
  phone: string;
  temperature: string;
  priority: string;
  status: { id: string; name: string; isTerminal: boolean };
  source: { name: string } | null;
  state: { name: string } | null;
  assignedUser: { id: string; name: string } | null;
  nextFollowupAt: string | null;
  createdAt: string;
};

type Option = { id: string; name: string };

const selectClass =
  "rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

export function LeadsTable({
  initialLeads,
  total,
  page,
  pageSize,
  statuses,
  sources,
  states,
  assignableUsers,
  canAssign,
  currentFilters,
}: {
  initialLeads: LeadRow[];
  total: number;
  page: number;
  pageSize: number;
  statuses: Option[];
  sources: Option[];
  states: Option[];
  assignableUsers: Option[];
  canAssign: boolean;
  currentFilters: {
    status?: string;
    source?: string;
    state?: string;
    owner?: string;
    temperature?: string;
    q?: string;
  };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const toast = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState(currentFilters.q ?? "");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [reassigning, setReassigning] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // "/" focuses search, "n" opens New lead — both skipped while typing
  // anywhere (an input/textarea/select focused, or a modifier held) so
  // they never hijack normal text entry or a browser shortcut.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isTyping = ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable;
      if (isTyping || e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setShowCreate(true);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function updateParam(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  function goToPage(nextPage: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("page", String(nextPage));
    router.push(`${pathname}?${next.toString()}`);
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const activeChips = useMemo(() => {
    const chips: { key: string; label: string }[] = [];
    if (currentFilters.q) chips.push({ key: "q", label: `"${currentFilters.q}"` });
    if (currentFilters.status) {
      const s = statuses.find((s) => s.id === currentFilters.status);
      if (s) chips.push({ key: "status", label: s.name.replaceAll("_", " ") });
    }
    if (currentFilters.source) {
      const s = sources.find((s) => s.id === currentFilters.source);
      if (s) chips.push({ key: "source", label: s.name });
    }
    if (currentFilters.state) {
      const s = states.find((s) => s.id === currentFilters.state);
      if (s) chips.push({ key: "state", label: s.name });
    }
    if (currentFilters.owner) {
      const u = assignableUsers.find((u) => u.id === currentFilters.owner);
      if (u) chips.push({ key: "owner", label: u.name });
    }
    return chips;
  }, [currentFilters, statuses, sources, states, assignableUsers]);

  function clearChip(key: string) {
    if (key === "q") setSearch("");
    updateParam(key, "");
  }

  function clearAllChips() {
    setSearch("");
    const next = new URLSearchParams(searchParams.toString());
    for (const c of activeChips) next.delete(c.key);
    next.delete("page");
    router.push(`${pathname}?${next.toString()}`);
  }

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === initialLeads.length ? new Set() : new Set(initialLeads.map((l) => l.id))));
  }

  async function bulkReassign(userId: string) {
    setReassigning(true);
    const ids = [...selected];
    const results = await Promise.all(
      ids.map((id) =>
        fetch(`/api/v1/leads/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assignedUserId: userId }),
        })
      )
    );
    setReassigning(false);
    const failed = results.filter((r) => !r.ok).length;
    if (failed > 0) {
      toast.error(`Reassigned ${ids.length - failed} of ${ids.length} — ${failed} failed.`);
    } else {
      toast.success(`Reassigned ${ids.length} lead${ids.length === 1 ? "" : "s"}.`);
    }
    setSelected(new Set());
    router.refresh();
  }

  return (
    <div>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateParam("q", search);
          }}
          className="relative min-w-[220px] flex-1"
        >
          <Search size={15} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
          <input
            ref={searchInputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, or lead code…"
            className="focus:border-brand-400 focus:ring-brand-100 w-full rounded-lg border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:ring-2"
          />
          <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">
            /
          </kbd>
        </form>

        <select
          value={currentFilters.status ?? ""}
          onChange={(e) => updateParam("status", e.target.value)}
          className={selectClass}
        >
          <option value="">All statuses</option>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name.replaceAll("_", " ")}
            </option>
          ))}
        </select>

        <select
          value={currentFilters.source ?? ""}
          onChange={(e) => updateParam("source", e.target.value)}
          className={selectClass}
        >
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        <select
          value={currentFilters.state ?? ""}
          onChange={(e) => updateParam("state", e.target.value)}
          className={selectClass}
        >
          <option value="">All states</option>
          {states.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        {canAssign && (
          <select
            value={currentFilters.owner ?? ""}
            onChange={(e) => updateParam("owner", e.target.value)}
            className={selectClass}
          >
            <option value="">All owners</option>
            {assignableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        )}
        </div>

        <Button variant="primary" icon={Plus} onClick={() => setShowCreate(true)} title="Press n" className="shrink-0">
          New lead
        </Button>
      </div>

      {activeChips.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {activeChips.map((chip) => (
            <button
              key={chip.key}
              onClick={() => clearChip(chip.key)}
              className="bg-brand-50 text-brand-700 hover:bg-brand-100 flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition"
            >
              {chip.label}
              <X size={11} />
            </button>
          ))}
          <button onClick={clearAllChips} className="text-xs font-medium text-slate-400 hover:text-slate-600">
            Clear all
          </button>
        </div>
      )}

      <SavedViews
        storageKey="leads"
        currentQuery={searchParams.toString()}
        hasActiveFilters={activeChips.length > 0}
        onApply={(query) => router.push(`${pathname}?${query}`)}
      />

      {selected.size > 0 && canAssign && (
        <div className="motion-fade bg-brand-600 mb-3 flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm text-white">
          <span className="font-medium">{selected.size} selected</span>
          <select
            disabled={reassigning}
            onChange={(e) => {
              if (e.target.value) bulkReassign(e.target.value);
            }}
            defaultValue=""
            className="rounded-md border border-white/30 bg-white/10 px-2 py-1 text-xs text-white outline-none [&>option]:text-slate-900"
          >
            <option value="" disabled>
              {reassigning ? "Reassigning…" : "Reassign to…"}
            </option>
            {assignableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-white/80 hover:text-white">
            Clear selection
          </button>
        </div>
      )}

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-slate-100 text-xs font-medium tracking-wide whitespace-nowrap text-slate-400 uppercase">
              {canAssign && (
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size > 0 && selected.size === initialLeads.length}
                    onChange={toggleSelectAll}
                    className="accent-brand-600"
                  />
                </th>
              )}
              <th className="px-4 py-3">Lead</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Temp</th>
              <th className="px-4 py-3">Source</th>
              <th className="px-4 py-3">Owner</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="motion-stagger">
            {initialLeads.length === 0 && (
              <tr>
                <td colSpan={canAssign ? 8 : 7}>
                  <EmptyState
                    icon={Users2}
                    title="No leads match these filters"
                    description="Try clearing a filter, or add a new lead to get started."
                  />
                </td>
              </tr>
            )}
            {initialLeads.map((lead, i) => (
              <tr
                key={lead.id}
                style={{ "--i": Math.min(i, 10) } as React.CSSProperties}
                className="border-b border-slate-50 transition-colors last:border-0 hover:bg-slate-50/60"
              >
                {canAssign && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(lead.id)}
                      onChange={() => toggleSelected(lead.id)}
                      className="accent-brand-600"
                    />
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={lead.name} />
                    <div>
                      <Link href={`/leads/${lead.id}`} className="hover:text-brand-600 font-medium text-slate-900">
                        {lead.name}
                      </Link>
                      <p className="font-mono text-xs text-slate-400">{lead.leadCode}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <PhoneChip value={lead.phone} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge name={lead.status.name} isTerminal={lead.status.isTerminal} />
                </td>
                <td className="px-4 py-3">
                  <TemperatureBadge temperature={lead.temperature} />
                </td>
                <td className="px-4 py-3 text-slate-600">{lead.source?.name ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{lead.assignedUser?.name ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400">{formatDate(lead.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-2 text-sm">
          <button
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          >
            <ChevronLeft size={14} /> Prev
          </button>
          <span className="text-slate-500">
            Page {page} of {totalPages}
          </span>
          <button
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-slate-600 transition hover:bg-slate-50 disabled:opacity-40"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}

      {showCreate && (
        <CreateLeadModal
          sources={sources}
          states={states}
          assignableUsers={assignableUsers}
          canAssign={canAssign}
          onClose={() => setShowCreate(false)}
          onCreated={(leadId) => {
            setShowCreate(false);
            router.push(`/leads/${leadId}`);
          }}
        />
      )}
    </div>
  );
}
