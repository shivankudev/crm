"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Image as ImageIcon, MapPin, Loader2, Check, FileText } from "lucide-react";
import { useToast } from "@/components/ui/toast";

type QuickAction = {
  id: string;
  label: string;
  mediaCount: number;
  hasText: boolean;
  hasLocation: boolean;
};

/** idle → sending → sent (then back to idle). Failures toast and reset. */
type SendState = "idle" | "sending" | "sent";

/** How long the green "Sent" confirmation stays before the button resets. */
const SENT_FEEDBACK_MS = 3000;

/**
 * One-press WhatsApp sends on the calling screen.
 *
 * A telecaller mid-conversation should never have to pick up their own
 * phone to find a brochure or a set of product photos — they hit a button
 * and it goes from their linked number. Buttons, their contents and their
 * number are set by an admin (Settings → Quick send buttons).
 *
 * Styled deliberately unlike the call-outcome buttons below: those are
 * neutral, mutually-exclusive choices that end the call, whereas these are
 * repeatable actions that fire immediately. Making them look the same
 * invites a mis-click that logs an outcome when the caller meant to share
 * a photo — so these are filled brand-tinted pills, the outcomes stay plain
 * bordered rectangles.
 */
export function QuickSendButtons({ leadId, leadName }: { leadId: string; leadName: string }) {
  const toast = useToast();
  const [actions, setActions] = useState<QuickAction[] | null>(null);
  const [states, setStates] = useState<Record<string, SendState>>({});
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  // Fetched once for the whole session: the buttons are the same for every
  // lead, so refetching per card left them briefly missing each time the
  // caller advanced the queue.
  useEffect(() => {
    fetch("/api/v1/telecalling/quick-actions")
      .then((r) => (r.ok ? r.json() : { actions: [] }))
      .then((d) => setActions(d.actions ?? []))
      .catch(() => setActions([]));

    const pending = timers.current;
    return () => Object.values(pending).forEach(clearTimeout);
  }, []);

  // New lead: clear any lingering "Sent" ticks so the buttons don't imply
  // something was already sent to THIS person.
  useEffect(() => {
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {};
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStates({});
  }, [leadId]);

  const anySending = Object.values(states).some((s) => s === "sending");

  async function send(action: QuickAction) {
    setStates((s) => ({ ...s, [action.id]: "sending" }));

    const res = await fetch("/api/v1/telecalling/quick-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quickActionId: action.id, leadId }),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      setStates((s) => ({ ...s, [action.id]: "idle" }));
      toast.error(data.error ?? "Couldn't send that");
      return;
    }
    // A set can partly fail — say so rather than a flat "sent".
    if (data.failed > 0) {
      setStates((s) => ({ ...s, [action.id]: "idle" }));
      toast.error(`Sent ${data.sent}, but ${data.failed} didn't go through.`);
      return;
    }

    setStates((s) => ({ ...s, [action.id]: "sent" }));
    toast.success(`Sent to ${leadName}.`);
    timers.current[action.id] = setTimeout(() => {
      setStates((s) => ({ ...s, [action.id]: "idle" }));
    }, SENT_FEEDBACK_MS);
  }

  // Nothing configured yet — stay out of the caller's way entirely.
  if (!actions || actions.length === 0) return null;

  return (
    <div className="border-brand-100 bg-brand-50/40 mt-4 rounded-lg border border-dashed p-2.5">
      <p className="text-brand-700 mb-2 flex items-center gap-1.5 text-[10px] font-semibold tracking-wide uppercase">
        <Send size={10} strokeWidth={2.5} />
        Send on WhatsApp
      </p>

      <div className="flex flex-wrap gap-2">
        {actions.map((a) => {
          const state = states[a.id] ?? "idle";
          const isSent = state === "sent";
          const isSending = state === "sending";

          return (
            <button
              key={a.id}
              onClick={() => send(a)}
              // Only the in-flight button locks the rest — a caller shouldn't
              // fire two sets at the same lead at once.
              disabled={anySending}
              aria-live="polite"
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium shadow-sm transition disabled:cursor-not-allowed ${
                isSent
                  ? "bg-chip-pos text-white"
                  : isSending
                    ? "bg-brand-600 text-white"
                    : "bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-50"
              }`}
            >
              {isSending ? (
                <>
                  <Loader2 size={11} className="animate-spin" />
                  Sending…
                </>
              ) : isSent ? (
                <>
                  <Check size={11} strokeWidth={3} />
                  Sent
                </>
              ) : (
                <>
                  {a.label}
                  <span className="flex items-center gap-1 opacity-70">
                    {a.hasText && <FileText size={10} />}
                    {a.mediaCount > 0 && (
                      <span className="flex items-center gap-0.5 text-[11px]">
                        <ImageIcon size={10} />
                        {a.mediaCount}
                      </span>
                    )}
                    {a.hasLocation && <MapPin size={10} />}
                  </span>
                </>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
