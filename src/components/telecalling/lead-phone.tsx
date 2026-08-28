"use client";

import { useState } from "react";
import { Phone, Check, X } from "lucide-react";
import { copyToClipboard } from "@/components/ui/copy-button";

/**
 * The lead's number on the calling screen — the one value a caller has to
 * read accurately, usually while already reaching for a handset.
 *
 * Tapping does BOTH: `tel:` is left to proceed (so on a phone it dials) and
 * the number is copied at the same time, which is the useful half on a
 * desktop where `tel:` does nothing. Copying deliberately does not
 * preventDefault — suppressing the dial to gain a copy would be a bad trade
 * on the device where dialling matters most.
 */
export function LeadPhone({ value, alt }: { value: string; alt?: string | null }) {
  return (
    <div className="border-brand-100 bg-brand-50 mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 rounded-lg border px-3.5 py-2.5">
      <PhoneLink value={value} primary />
      {alt && (
        <span className="flex items-center gap-2 text-xs">
          <span className="text-[10px] tracking-wide text-slate-400 uppercase">alt</span>
          <PhoneLink value={alt} />
        </span>
      )}
    </div>
  );
}

function PhoneLink({ value, primary = false }: { value: string; primary?: boolean }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  function handleCopy() {
    // Failure is surfaced too, not swallowed: clipboard writes can be denied
    // by permissions policy, and a caller who saw nothing happen would paste
    // whatever was on the clipboard before.
    copyToClipboard(value).then((ok) => {
      setState(ok ? "copied" : "failed");
      setTimeout(() => setState("idle"), 1500);
    });
  }

  return (
    <a
      href={`tel:${value}`}
      onClick={handleCopy}
      title="Tap to call — also copies the number"
      className={
        primary
          ? "text-brand-800 hover:text-brand-900 flex items-center gap-2 font-mono text-xl font-semibold tracking-wide tabular-nums"
          : "hover:text-brand-700 flex items-center gap-1.5 font-mono text-xs font-medium text-slate-700 tabular-nums"
      }
    >
      {primary && <Phone size={17} strokeWidth={2.25} className="text-brand-500 shrink-0" />}
      {value}
      {state === "copied" ? (
        <span className="text-chip-pos flex shrink-0 items-center gap-0.5 font-sans text-[11px] font-medium">
          <Check size={12} strokeWidth={3} />
          Copied
        </span>
      ) : state === "failed" ? (
        <span className="text-chip-neg flex shrink-0 items-center gap-0.5 font-sans text-[11px] font-medium">
          <X size={12} strokeWidth={3} />
          Copy blocked
        </span>
      ) : (
        // font-sans so it doesn't inherit the number's monospace, and hidden
        // on phones where it wrapped to three lines beside the number — the
        // action is obvious on a touch device anyway.
        primary && (
          <span className="hidden shrink-0 font-sans text-[11px] font-normal whitespace-nowrap text-slate-400 sm:inline">
            tap to call / copy
          </span>
        )
      )}
    </a>
  );
}
