import clsx from "clsx";

/**
 * A curated set of tasteful tinted pairs — deliberately not the full
 * Tailwind color wheel (no yellow/lime/orange, too loud) — cycled by a
 * deterministic hash of the name/id so the same person always gets the
 * same color, the way Slack/Linear/Notion color-code people without
 * touching the app's actual status/semantic color meanings.
 */
const PALETTE = [
  "bg-brand-50 text-brand-600",
  "bg-violet-50 text-violet-600",
  "bg-sky-50 text-sky-600",
  "bg-teal-50 text-teal-600",
  "bg-rose-50 text-rose-600",
  "bg-amber-50 text-amber-600",
  "bg-emerald-50 text-emerald-600",
  "bg-fuchsia-50 text-fuchsia-600",
] as const;

function colorFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

const SIZES = {
  xs: "h-5 w-5 text-[10px]",
  sm: "h-7 w-7 text-xs",
  md: "h-8 w-8 text-xs",
  lg: "h-9 w-9 text-sm",
} as const;

export function Avatar({
  name,
  size = "md",
  className,
}: {
  /** Used both as the displayed initial(s) and the color seed — same name always gets the same color. */
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  // Array.from iterates by code point, not UTF-16 code unit. `.slice(0, 1)`
  // cut an emoji in half and emitted a lone surrogate, which the server and
  // the browser serialise differently — that mismatch failed hydration and
  // forced React to throw away and re-render the whole leads table.
  const initial = (Array.from(name.trim())[0] ?? "").toUpperCase() || "?";
  return (
    <span
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full font-semibold",
        SIZES[size],
        colorFor(name || "?"),
        className
      )}
    >
      {initial}
    </span>
  );
}
