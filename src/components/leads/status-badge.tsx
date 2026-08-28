import clsx from "clsx";

const TERMINAL_STYLES: Record<string, string> = {
  WON: "chip-pos",
  LOST: "chip-neg",
  NOT_INTERESTED: "chip-mute",
  INVALID: "chip-mute",
  DUPLICATE: "chip-mute",
};

/** Solid scorecard-style status tag — see globals.css `.chip`. A lead's
 *  status reads like a dismissal on a scorecard: WON/LOST get their fixed
 *  color, anything still in the pipeline reads "live" gold. */
export function StatusBadge({ name, isTerminal }: { name: string; isTerminal?: boolean }) {
  const style = TERMINAL_STYLES[name] ?? (isTerminal ? "chip-mute" : "chip-live");
  return <span className={clsx("chip", style)}>{name.replaceAll("_", " ")}</span>;
}
