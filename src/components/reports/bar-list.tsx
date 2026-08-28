/** Lightweight CSS bar chart — avoids pulling in a charting dependency for a handful of horizontal bars. */
export function BarList({
  rows,
  labelWidth = "w-40",
}: {
  rows: { label: string; value: number; sublabel?: string }[];
  labelWidth?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));

  if (rows.length === 0) {
    return <p className="text-sm text-slate-400">No data yet.</p>;
  }

  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-3 text-sm">
          <span className={`shrink-0 truncate text-slate-600 ${labelWidth}`}>{r.label}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-slate-700"
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
            />
          </div>
          <span className="w-16 shrink-0 text-right font-medium text-slate-900">
            {r.value}
            {r.sublabel && <span className="ml-1 font-normal text-slate-400">{r.sublabel}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
