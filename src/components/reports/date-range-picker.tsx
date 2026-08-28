"use client";

import { useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";
import clsx from "clsx";

export type RangePreset = { label: string; days: number };

const DEFAULT_PRESETS: RangePreset[] = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
  { label: "Last 365 days", days: 365 },
];

/**
 * Preset tabs + a custom from/to date picker, all driving the page's
 * `?from=&to=` search params — the server component re-fetches on
 * navigation, same pattern as the leads/dealers table filters.
 */
export function DateRangePicker({
  from,
  to,
  presets = DEFAULT_PRESETS,
}: {
  /** Current range as YYYY-MM-DD strings. */
  from: string;
  to: string;
  presets?: RangePreset[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  function applyRange(nextFrom: string, nextTo: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("from", nextFrom);
    params.set("to", nextTo);
    router.push(`${pathname}?${params.toString()}`);
  }

  function applyPreset(days: number) {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    setCustomFrom(iso(start));
    setCustomTo(iso(today));
    applyRange(iso(start), iso(today));
  }

  // A preset tab is "active" when the current range matches it exactly.
  function isActivePreset(days: number) {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    const iso = (d: Date) => d.toISOString().slice(0, 10);
    return from === iso(start) && to === iso(today);
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
        {presets.map((p) => (
          <button
            key={p.label}
            onClick={() => applyPreset(p.days)}
            className={clsx(
              "rounded-md px-2.5 py-1.5 text-xs font-medium transition",
              isActivePreset(p.days)
                ? "bg-brand-600 text-white shadow-sm"
                : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          applyRange(customFrom, customTo);
        }}
        className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2 py-1"
      >
        <Calendar size={14} className="text-slate-400" />
        <input
          type="date"
          value={customFrom}
          max={customTo}
          onChange={(e) => setCustomFrom(e.target.value)}
          className="rounded px-1 py-1 text-xs text-slate-700 outline-none"
        />
        <span className="text-xs text-slate-300">–</span>
        <input
          type="date"
          value={customTo}
          min={customFrom}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setCustomTo(e.target.value)}
          className="rounded px-1 py-1 text-xs text-slate-700 outline-none"
        />
        <button
          type="submit"
          className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-200"
        >
          Apply
        </button>
      </form>
    </div>
  );
}
