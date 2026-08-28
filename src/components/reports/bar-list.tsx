import clsx from "clsx";

export type BarListRow = {
  label: string;
  value: number;
  /** A subset of `value` to call out as a filled-in portion of the bar
   *  (e.g. how many of the source's leads were won). */
  secondaryValue?: number;
  sublabel?: string;
};

/** Lightweight CSS bar chart — avoids pulling in a charting dependency for a
 *  handful of horizontal bars. Magnitude rides the one blue accent rather
 *  than flat gray so the bars read as data, not disabled rows; when a row
 *  carries a `secondaryValue`, the bar splits into a darker "part" segment
 *  and a lighter "rest" segment, with a legend naming both. */
export function BarList({
  rows,
  labelWidth = "w-40",
  secondaryLabel = "Won",
  totalLabel = "Total",
}: {
  rows: BarListRow[];
  labelWidth?: string;
  secondaryLabel?: string;
  totalLabel?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const hasSecondary = rows.some((r) => typeof r.secondaryValue === "number");

  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">No data yet.</p>;
  }

  return (
    <div>
      {hasSecondary && (
        <div className="mb-3 flex items-center gap-4 text-[11px] font-medium text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand-600" />
            {secondaryLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-brand-400" />
            {totalLabel}
          </span>
        </div>
      )}

      <div className="space-y-2.5">
        {rows.map((r) => {
          const pct = Math.max(2, (r.value / max) * 100);
          const secondary = Math.min(r.secondaryValue ?? 0, r.value);
          const secondaryPct = r.value > 0 ? (secondary / r.value) * 100 : 0;

          return (
            <div key={r.label} className="flex items-center gap-3 text-sm">
              <span className={clsx("shrink-0 truncate text-slate-600", labelWidth)}>{r.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-brand-500/10">
                <div className="flex h-full gap-0.5" style={{ width: `${pct}%` }}>
                  {secondary > 0 ? (
                    <>
                      <div
                        className="h-full rounded-full bg-brand-600"
                        style={{ width: `${secondaryPct}%` }}
                      />
                      <div className="h-full flex-1 rounded-full bg-brand-400" />
                    </>
                  ) : (
                    <div
                      className={clsx(
                        "h-full flex-1 rounded-full",
                        // Match the legend: in a chart that has a "part" series,
                        // a row with nothing in that series is still the light
                        // "rest" colour, not a third shade.
                        hasSecondary ? "bg-brand-400" : "bg-brand-500"
                      )}
                    />
                  )}
                </div>
              </div>
              <span className="w-16 shrink-0 text-right font-medium text-slate-900">
                {r.value}
                {r.sublabel && <span className="ml-1 font-normal text-slate-400">{r.sublabel}</span>}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
