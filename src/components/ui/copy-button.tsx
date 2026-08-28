"use client";

import { useState } from "react";
import { Copy, Check, X } from "lucide-react";
import clsx from "clsx";

/** Legacy fallback for contexts where the async Clipboard API is blocked
 * (permissions policy, no user-activation heuristics matched, embedded/
 * sandboxed iframes) — a hidden textarea + execCommand still works there. */
function legacyCopy(value: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  document.body.removeChild(textarea);
  return ok;
}

/** Exported so other surfaces (e.g. the big tap-to-copy phone number on the
 *  calling screen) reuse the same clipboard fallback chain. */
export async function copyToClipboard(value: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Clipboard-write can be denied by permissions policy in some
      // embedded contexts — fall through to the legacy path instead of
      // throwing an unhandled rejection.
    }
  }
  return legacyCopy(value);
}

/**
 * Small icon-only copy-to-clipboard button, meant to sit right next to a
 * value (phone number, code, etc.) rather than replace it. Stops
 * propagation/default so it's safe to drop inside a table row or link
 * without triggering navigation.
 */
export function CopyButton({ value, className, label = "Copy" }: { value: string; className?: string; label?: string }) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  return (
    <button
      type="button"
      title={state === "copied" ? "Copied" : state === "failed" ? "Couldn't copy — copy manually" : label}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        copyToClipboard(value).then((ok) => {
          setState(ok ? "copied" : "failed");
          setTimeout(() => setState("idle"), 1200);
        });
      }}
      className={clsx(
        "hover:text-brand-600 inline-flex shrink-0 items-center justify-center rounded p-0.5 text-slate-300 transition hover:bg-slate-100",
        className
      )}
    >
      {state === "copied" ? (
        <Check size={12} className="text-green-600" />
      ) : state === "failed" ? (
        <X size={12} className="text-red-500" />
      ) : (
        <Copy size={12} />
      )}
    </button>
  );
}
