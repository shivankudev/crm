import clsx from "clsx";
import { DEALER_TERMINAL_STATUSES } from "@/lib/dealers/constants";

const STYLES: Record<string, string> = {
  ACTIVE_DEALER: "chip-pos",
  REJECTED: "chip-neg",
  SUSPENDED: "chip-neg",
  INACTIVE: "chip-mute",
};

/** Same scorecard chip language as leads' StatusBadge — see globals.css `.chip`. */
export function DealerStatusBadge({ name }: { name: string }) {
  const style = STYLES[name] ?? (DEALER_TERMINAL_STATUSES.includes(name) ? "chip-mute" : "chip-live");
  return <span className={clsx("chip", style)}>{name.replaceAll("_", " ")}</span>;
}
