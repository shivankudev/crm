"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle, X } from "lucide-react";
import { isWhatsAppLive } from "@/lib/whatsapp-constants";

/** How often the device's real state is checked. */
const CHECK_INTERVAL_MS = 60_000;
/** How long a dismissal buys before the prompt comes back. */
const REMIND_AFTER_MS = 3 * 60_000;

/**
 * App-wide "your WhatsApp isn't connected" prompt.
 *
 * Lives in the shell rather than the dashboard because a telecaller spends
 * their day on /telecalling, not /dashboard — a warning only they'd see by
 * navigating away is a warning they'd never see. While the device is
 * unlinked every automated message silently fails, so this re-surfaces on
 * a timer instead of being dismissible once and forgotten.
 *
 * Deliberately NOT shown on /whatsapp itself: that page already carries
 * the QR and the inline warning, and a modal over it would block the very
 * fix it's asking for.
 */
export function WhatsAppConnectionReminder({ enabled }: { enabled: boolean }) {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  /** Epoch ms before which the prompt stays suppressed after a dismissal. */
  const suppressUntilRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function check() {
      const res = await fetch("/api/v1/whatsapp/session").catch(() => null);
      if (!res || !res.ok || cancelled) return;

      const data = await res.json();
      const live = isWhatsAppLive(data.session?.status);
      if (cancelled) return;

      setStatus(data.session?.status ?? null);

      if (live) {
        // Reconnected — clear any pending suppression so a future drop
        // prompts immediately rather than waiting out an old timer.
        suppressUntilRef.current = 0;
        setVisible(false);
        return;
      }
      if (Date.now() >= suppressUntilRef.current) setVisible(true);
    }

    check();
    const id = setInterval(check, CHECK_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled]);

  if (!enabled || !visible) return null;
  if (pathname.startsWith("/whatsapp")) return null;

  function dismiss() {
    suppressUntilRef.current = Date.now() + REMIND_AFTER_MS;
    setVisible(false);
  }

  const neverConnected = status === null;

  return (
    <div className="motion-fade fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]">
      <div className="motion-pop w-full max-w-sm rounded-lg bg-white p-6 shadow-xl">
        <div className="flex items-start gap-3">
          <div className="bg-chip-neg/10 text-chip-neg flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
            <AlertTriangle size={17} strokeWidth={2.25} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold text-slate-900">
              {neverConnected ? "Connect your WhatsApp" : "WhatsApp disconnected"}
            </h2>
            <p className="mt-1.5 text-sm text-slate-600">
              {neverConnected
                ? "Scan the QR code to link your WhatsApp so your leads get their follow-up messages automatically."
                : "Your device is no longer linked, so automated messages to your leads are not being sent. Scan the QR code again to reconnect."}
            </p>
          </div>
          <button onClick={dismiss} className="shrink-0 text-slate-300 hover:text-slate-500" aria-label="Dismiss">
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button onClick={dismiss} className="px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-700">
            Later
          </button>
          {/* A plain Link, not <Button href>: that variant renders a Link
              and does not forward onClick, so the dismiss would silently
              never run. */}
          <Link
            href="/whatsapp"
            onClick={dismiss}
            className="bg-brand-600 hover:bg-brand-700 inline-flex shrink-0 items-center justify-center gap-1.5 rounded px-3.5 py-2 text-sm font-medium text-white shadow-sm transition"
          >
            Connect WhatsApp
          </Link>
        </div>
      </div>
    </div>
  );
}
