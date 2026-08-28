"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Search, Plus, ChevronLeft, ChevronRight, Building2, X } from "lucide-react";
import { DealerStatusBadge } from "@/components/dealers/dealer-status-badge";
import { Card } from "@/components/ui/card";
import { PhoneChip } from "@/components/ui/phone-chip";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";
import { CreateDealerModal } from "@/app/(app)/dealers/create-dealer-modal";

type DealerRow = {
  id: string;
  dealerCode: string | null;
  dealerName: string;
  phone: string;
  contactPerson: string | null;
  status: { id: string; name: string };
  state: { name: string } | null;
  createdAt: string;
};

type Option = { id: string; name: string };

const selectClass =
  "rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100";

export function DealersTable({
  initialDealers,
  total,
  page,
  pageSize,
  statuses,
  states,
  canCreate,
  currentFilters,
}: {
  initialDealers: DealerRow[];
  total: number;
  page: number;
  pageSize: number;
  statuses: Option[];
  states: Option[];
  canCreate: boolean;
  currentFilters: { status?: string; state?: string; q?: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState(currentFilters.q ?? "");

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
    if (currentFilters.state) {
      const s = states.find((s) => s.id === currentFilters.state);
      if (s) chips.push({ key: "state", label: s.name });
    }
    return chips;
  }, [currentFilters, statuses, states]);

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
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone, or dealer code…"
            className="focus:border-brand-400 focus:ring-brand-100 w-full rounded-lg border border-slate-200 bg-white py-2 pr-3 pl-9 text-sm outline-none focus:ring-2"
          />
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

        </div>

        {canCreate && (
          <Button variant="primary" icon={Plus} onClick={() => setShowCreate(true)} className="shrink-0">
            New dealer
          </Button>
        )}
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

      <Card className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-slate-100 text-xs font-medium tracking-wide whitespace-nowrap text-slate-400 uppercase">
              <th className="px-4 py-3">Dealer</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Contact</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">State</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody>
            {initialDealers.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState
                    icon={Building2}
                    title="No dealers match these filters"
                    description="Try clearing a filter, or add a new dealer to get started."
                  />
                </td>
              </tr>
            )}
            {initialDealers.map((dealer) => (
              <tr key={dealer.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                      <Building2 size={14} strokeWidth={2.25} />
                    </div>
                    <div>
                      <Link href={`/dealers/${dealer.id}`} className="hover:text-brand-600 font-medium text-slate-900">
                        {dealer.dealerName}
                      </Link>
                      <p className="font-mono text-xs text-slate-400">{dealer.dealerCode ?? "No code yet"}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <PhoneChip value={dealer.phone} />
                </td>
                <td className="px-4 py-3 text-slate-600">{dealer.contactPerson ?? "—"}</td>
                <td className="px-4 py-3">
                  <DealerStatusBadge name={dealer.status.name} />
                </td>
                <td className="px-4 py-3 text-slate-600">{dealer.state?.name ?? "—"}</td>
                <td className="px-4 py-3 text-slate-400">{formatDate(dealer.createdAt)}</td>
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
        <CreateDealerModal
          states={states}
          onClose={() => setShowCreate(false)}
          onCreated={(dealerId) => {
            setShowCreate(false);
            router.push(`/dealers/${dealerId}`);
          }}
        />
      )}
    </div>
  );
}
