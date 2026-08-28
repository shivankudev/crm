"use client";

import { CopyButton } from "@/components/ui/copy-button";
import clsx from "clsx";
import { formatPhoneForDisplay } from "@/lib/phone";

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
        // nowrap: the display grouping adds a space, which the browser will
        // happily break a narrow table column on — splitting one number across
        // two lines is exactly the misreading this formatting exists to avoid.
        "inline-flex items-center gap-1 rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs font-medium whitespace-nowrap text-slate-700",
        className
      )}
    >
      {/* Grouped for reading; the tel: link and the copy both carry the
          stored digits, since that is what dials and what staff paste
          elsewhere. */}
      <a href={`tel:${value}`} className="hover:text-brand-600">
        {formatPhoneForDisplay(value)}
      </a>
      <CopyButton value={value} label={label ?? "Copy phone number"} />
    </span>
  );
}
