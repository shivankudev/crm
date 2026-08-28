import clsx from "clsx";

/** A single shimmering placeholder block — compose these into page-shaped skeletons. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton rounded bg-slate-200/70", className)} />;
}

/** Skeleton matching the StatRail used on Dashboard/Telecalling/Reports headers. */
/** `size` must match the StatCards it stands in for, or the rail jumps height when the data lands. */
export function StatCardSkeleton({ size = "md" }: { size?: "md" | "sm" }) {
  const compact = size === "sm";
  return (
    <div
      className={
        compact
          ? "grid min-h-[3.75rem] min-w-[5rem] flex-1 grid-rows-[1fr_auto] place-items-center px-3 py-2.5 first:pl-0 last:pr-0 sm:px-4"
          : "grid min-h-[5.5rem] min-w-[6.5rem] flex-1 grid-rows-[1fr_auto] place-items-center px-4 py-3.5 first:pl-0 last:pr-0 sm:px-5"
      }
    >
      <span className="flex flex-col items-center justify-center">
        <Skeleton className={compact ? "h-5 w-10" : "h-7 w-14"} />
        <Skeleton className={compact ? "mt-1.5 h-2.5 w-16" : "mt-2.5 h-3 w-20"} />
      </span>
    </div>
  );
}

/** Skeleton matching the Card-wrapped data tables used across Leads/Dealers/Reports. */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200/80 bg-white">
      <div className="flex gap-6 border-b border-slate-100 px-4 py-3">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex items-center gap-6 border-b border-slate-50 px-4 py-3.5 last:border-0">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={clsx("h-3.5", c === 0 ? "w-28" : "w-16")} />
          ))}
        </div>
      ))}
    </div>
  );
}
