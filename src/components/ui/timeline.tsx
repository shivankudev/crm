import { ArrowRight, Sparkles, type LucideIcon } from "lucide-react";
import { formatDateTime } from "@/lib/format";

export type TimelineEntry = {
  id: string;
  type: string;
  fromValue: string | null;
  toValue: string | null;
  createdAt: string;
};

/**
 * Shared vertical activity timeline — used by both the Lead and Dealer
 * detail pages' Timeline tab (previously two near-identical flat lists;
 * now one connected-rail component driven by each domain's own
 * label/icon map).
 */
export function Timeline({
  entries,
  labels,
  icons,
}: {
  entries: TimelineEntry[];
  labels: Record<string, string>;
  icons: Record<string, LucideIcon>;
}) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-400">No activity yet.</p>;
  }

  return (
    <ol className="relative">
      {entries.map((entry, i) => {
        const Icon = icons[entry.type] ?? Sparkles;
        const isLast = i === entries.length - 1;
        return (
          <li key={entry.id} className="relative flex gap-3 pb-5 last:pb-0">
            {!isLast && (
              <span className="absolute top-8 left-[15px] h-[calc(100%-1.75rem)] w-px bg-slate-200" aria-hidden />
            )}
            <span className="bg-brand-50 text-brand-600 z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full">
              <Icon size={14} strokeWidth={2.25} />
            </span>
            <div className="flex-1 pt-1">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-900">{labels[entry.type] ?? entry.type}</span>
                <span className="shrink-0 text-xs text-slate-400">{formatDateTime(entry.createdAt)}</span>
              </div>
              {entry.fromValue && entry.toValue && (
                <p className="mt-0.5 text-sm text-slate-500">
                  {entry.fromValue.replaceAll("_", " ")} <ArrowRight size={11} className="inline text-slate-300" />{" "}
                  {entry.toValue.replaceAll("_", " ")}
                </p>
              )}
              {!entry.fromValue && entry.toValue && <p className="mt-0.5 text-sm text-slate-500">{entry.toValue}</p>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
