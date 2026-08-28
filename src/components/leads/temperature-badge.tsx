import clsx from "clsx";

// Deliberately an outlined tag, not a solid `.chip` fill — temperature is
// a read on the lead, not a lifecycle outcome, so it stays visually
// distinct from StatusBadge's scorecard dismissal tags.
const STYLES: Record<string, string> = {
  HOT: "border-chip-neg/40 text-chip-neg",
  WARM: "border-brand-500/50 text-brand-700",
  COLD: "border-slate-300 text-slate-500",
};

export function TemperatureBadge({ temperature }: { temperature: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-sm border px-1.5 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
        STYLES[temperature] ?? "border-slate-200 text-slate-400"
      )}
    >
      {temperature}
    </span>
  );
}
