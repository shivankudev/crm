"use client";

import { CopyButton } from "@/components/ui/copy-button";
import clsx from "clsx";

/**
 * A phone number rendered as a highlighted, tappable chip (tel: link)
 * with a small copy-to-clipboard button attached — used everywhere a
 * phone number shows up (leads, dealers, telecalling, follow-ups) so
 * numbers are easy to spot and easy to grab without retyping.
 */
export function PhoneChip({ value, className, label }: { value: string; className?: string; label?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-medium text-slate-700",
        className
      )}
    >
      <a href={`tel:${value}`} className="hover:text-brand-600">
        {value}
      </a>
      <CopyButton value={value} label={label ?? "Copy phone number"} />
    </span>
  );
}
