import { Children, cloneElement, isValidElement } from "react";
import Link from "next/link";
import clsx from "clsx";

const ACCENTS = {
  brand: "text-brand-600",
  pos: "text-chip-pos",
  neg: "text-chip-neg",
  mute: "text-slate-400",
} as const;

export type StatCardAccent = keyof typeof ACCENTS;

/**
 * "sm" is for screens where the rail is a reference figure rather than the
 * headline — the calling screen, where the lead in front of the caller is
 * the subject and the day's tallies sit above it as context.
 */
const SIZES = {
  md: { value: "text-[1.75rem]", label: "text-[11px]", cell: "min-h-[5.5rem] min-w-[6.5rem] px-4 py-3.5 sm:px-5", gap: "mt-2" },
  sm: { value: "text-xl", label: "text-[10px]", cell: "min-h-[3.75rem] min-w-[5rem] px-3 py-2.5 sm:px-4", gap: "mt-1" },
} as const;

export type StatCardSize = keyof typeof SIZES;

type StatCardProps = {
  label: string;
  value: number | string;
  accent?: StatCardAccent;
  href?: string;
  hint?: string;
  size?: StatCardSize;
  /**
   * Set by `<StatRail>`, not by callers. Reserves the bottom hint row on a
   * card that has no hint of its own — see the rail for why.
   */
  reserveHintRow?: boolean;
};

/**
 * One segment of a scoreboard rail — a tabular number over a small-caps
 * label, no icon square, no bordered card. Compose several inside
 * `<StatRail>` for a single divided strip (the direction's "persistent
 * stat-rail"), the way a broadcast scorecard reads several figures across
 * one row rather than a grid of separate tiles.
 */
export function StatCard({ label, value, accent = "mute", href, hint, size = "md", reserveHintRow }: StatCardProps) {
  const showHintRow = Boolean(hint) || Boolean(reserveHintRow);
  const scale = SIZES[size];

  const content = (
    <>
      <span className="flex flex-col items-center justify-center">
        <span className={clsx("tnum block leading-none font-semibold", scale.value, ACCENTS[accent])}>
          {value}
        </span>
        <span
          className={clsx("block font-semibold tracking-wide text-slate-500 uppercase", scale.gap, scale.label)}
        >
          {label}
        </span>
      </span>
      {/* Rendered even when this card has no hint (as a non-breaking space),
          whenever a sibling does — the rail stretches every segment to the
          tallest, so a card without the row would centre its number higher
          than its hinted neighbour's. */}
      {showHintRow && <span className="mt-1 block text-xs text-slate-400">{hint ?? " "}</span>}
    </>
  );

  // flex-1 (equal basis) so every segment claims the same width regardless of
  // label length — otherwise "NOT CONNECTED" stretches its own cell wider than
  // "DUE TODAY" and the numbers land at uneven x-positions instead of one
  // evenly-divided rail.
  //
  // grid-rows-[1fr_auto] pairs with the content above: the number sits centred
  // in the flexible row, the hint (when present) occupies the fixed row
  // beneath — so figures are centred on both axes and share one baseline.
  const className = clsx(
    "grid flex-1 grid-rows-[1fr_auto] place-items-center text-center first:pl-0 last:pr-0",
    scale.cell
  );

  if (href) {
    return (
      <Link
        href={href}
        className={clsx(
          className,
          "rounded-md transition-colors duration-150 hover:bg-slate-50 focus-visible:bg-slate-50"
        )}
      >
        {content}
      </Link>
    );
  }
  return <div className={className}>{content}</div>;
}

/**
 * The bordered, hairline-divided strip StatCard segments live inside.
 *
 * Also keeps the rail's numbers on one baseline: if ANY card in it carries a
 * hint, every card reserves that bottom row. Doing it here rather than at
 * each call site means a rail can't silently fall out of alignment later
 * just because someone added a hint to a single card — which is exactly how
 * the dashboard's overdue figure ended up sitting higher than its
 * neighbours. A rail with no hints at all reserves nothing and stays compact.
 */
export function StatRail({ children, className }: { children: React.ReactNode; className?: string }) {
  const items = Children.toArray(children);
  const anyHint = items.some((child) => isValidElement<StatCardProps>(child) && Boolean(child.props.hint));

  const aligned = anyHint
    ? items.map((child) =>
        isValidElement<StatCardProps>(child) ? cloneElement(child, { reserveHintRow: true }) : child
      )
    : items;

  return (
    <div
      className={clsx(
        "flex flex-wrap divide-x divide-slate-200 rounded-lg border border-slate-200 bg-white px-1",
        className
      )}
    >
      {aligned}
    </div>
  );
}
