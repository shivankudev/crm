"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, RotateCcw, LogOut, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { isWhatsAppLive, isWhatsAppPending } from "@/lib/whatsapp-constants";

type Session = { status: string; phone: string | null } | null;

// Keyed to OpenWA's own SessionStatus values — "ready" is the linked
// state (there is no "connected"), see lib/whatsapp-constants.ts.
const STATUS_LABELS: Record<string, string> = {
  ready: "Connected",
  qr_ready: "Scan to connect",
  authenticating: "Linking…",
  initializing: "Starting up…",
  created: "Starting up…",
  disconnected: "Not connected",
  action_required: "Needs attention on your phone",
  failed: "Connection failed",
};

/**
 * Keep polling while the session is still working toward a link. A
 * freshly started (or refreshed) session sits in "initializing" for a few
 * seconds *before* its QR exists, so polling only on "qr_ready" would
 * stall there forever and show a scan prompt with nothing to scan.
 */
function shouldPoll(status: string) {
  return isWhatsAppPending(status);
}

/**
 * Per-telecaller WhatsApp connection card — "every telecaller gets its
 * own QR code to scan" (§ WhatsApp integration). Talks only to this
 * CRM's own /api/v1/whatsapp/* routes, which in turn talk to the OpenWA
 * gateway; this component never calls OpenWA directly.
 */
export function WhatsAppWidget() {
  const toast = useToast();
  const [session, setSession] = useState<Session>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** Last status the heartbeat saw, so we only react to actual transitions. */
  const lastStatusRef = useRef<string | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function stopHeartbeat() {
    if (heartbeatRef.current) {
      clearInterval(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }

  /**
   * Liveness check that keeps running even while the device is happily
   * linked. A WhatsApp device can drop on its own at any time — the phone
   * goes offline for too long, someone removes it from Linked Devices, or
   * WhatsApp expires the companion — and none of that produces any signal
   * in the CRM. Without this the panel would keep showing a confident
   * "Connected" while every message silently failed until someone
   * happened to reload the page.
   *
   * Slower than the QR poll (that one is racing a ~40s code rotation;
   * this is just watching for a state change), and it hits
   * /whatsapp/session, which re-reads the live status from OpenWA
   * server-side rather than echoing our cached row.
   */
  function startHeartbeat() {
    stopHeartbeat();
    heartbeatRef.current = setInterval(async () => {
      const res = await fetch("/api/v1/whatsapp/session").catch(() => null);
      if (!res || !res.ok) return; // transient — keep watching

      const data = await res.json();
      if (!data.session) return;

      const next = data.session.status as string;
      const prev = lastStatusRef.current;
      lastStatusRef.current = next;

      setSession({ status: next, phone: data.session.phone });

      if (prev && isWhatsAppLive(prev) && !isWhatsAppLive(next)) {
        // Dropped while they were working — say so loudly, since the
        // consequence (messages silently not sending) is invisible.
        toast.error("WhatsApp disconnected — your automated messages are no longer being sent.");
      }
      // Re-arm QR polling if it fell back into a scannable state.
      if (isWhatsAppPending(next) && !pollRef.current) startPolling();
    }, 30000);
  }

  function startPolling() {
    stopPolling();

    // WhatsApp rotates the QR roughly every 20s while it waits to be
    // scanned, and OpenWA emits a fresh one on every rotation (its
    // onQRCode handler re-persists QR_READY each time). GET /qr always
    // returns the CURRENT one, so re-reading on this interval is what
    // keeps the code on screen scannable instead of going stale and
    // silently failing when the telecaller finally points their phone at
    // it. Polling here (rather than subscribing to OpenWA's session.qr
    // WebSocket, which is its own suggestion for dashboard clients)
    // deliberately keeps the gateway API key server-side — the browser
    // only ever talks to this CRM.
    //
    // The cap counts CONSECUTIVE failures, never total polls: someone can
    // legitimately sit on this screen for many minutes before scanning,
    // and a total-attempt cap would freeze the QR at an expired image
    // while still telling them to scan it.
    let consecutiveFailures = 0;
    const MAX_CONSECUTIVE_FAILURES = 5;

    pollRef.current = setInterval(async () => {
      const res = await fetch("/api/v1/whatsapp/session/qr").catch(() => null);

      if (!res || !res.ok) {
        // A removed session or an unreachable gateway fails every tick —
        // stop rather than hammer it forever. A brief blip is tolerated.
        if (++consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) stopPolling();
        return;
      }
      consecutiveFailures = 0;

      const data = await res.json();
      // Only swap the image when the code actually changed, so a QR that
      // hasn't rotated yet doesn't visibly flicker on every poll.
      setQrCode((prev) => (prev === data.qrCode ? prev : data.qrCode));
      setSession((s) => ({ status: data.status, phone: s?.phone ?? null }));
      if (!shouldPoll(data.status)) stopPolling();
    }, 3000);
  }

  useEffect(() => {
    fetch("/api/v1/whatsapp/session")
      .then((r) => r.json())
      .then((data) => {
        setSession(data.session ? { status: data.session.status, phone: data.session.phone } : null);
        if (data.session) {
          lastStatusRef.current = data.session.status;
          if (shouldPoll(data.session.status)) startPolling();
          // Runs in every state, including a healthy one — this is what
          // catches a device that drops later.
          startHeartbeat();
        }
      })
      .finally(() => setLoading(false));
    return () => {
      stopPolling();
      stopHeartbeat();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function connect() {
    setBusy(true);
    const res = await fetch("/api/v1/whatsapp/session", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? "Failed to start WhatsApp connection");
      return;
    }
    setQrCode(data.qrCode);
    setSession({ status: data.status, phone: null });
    lastStatusRef.current = data.status;
    if (shouldPoll(data.status)) startPolling();
    startHeartbeat();
  }

  async function refreshQr() {
    setBusy(true);
    const res = await fetch("/api/v1/whatsapp/session/refresh", { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      toast.error(data.error ?? "Failed to refresh QR code");
      return;
    }
    setQrCode(data.qrCode);
    setSession((s) => ({ status: data.status, phone: s?.phone ?? null }));
    lastStatusRef.current = data.status;
    if (shouldPoll(data.status)) startPolling();
  }

  async function logout() {
    setBusy(true);
    const res = await fetch("/api/v1/whatsapp/session", { method: "DELETE" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    stopPolling();
    if (!res.ok) {
      toast.error(data.error ?? "Failed to log out of WhatsApp");
      return;
    }
    stopHeartbeat();
    lastStatusRef.current = data.session.status;
    setQrCode(null);
    setSession({ status: data.session.status, phone: null });
    toast.success("Logged out of WhatsApp.");
  }

  if (loading) {
    return (
      <Card className="mt-3 p-4">
        <Skeleton className="h-9 w-48" />
      </Card>
    );
  }

  const status = session?.status ?? "disconnected";
  const isConnected = isWhatsAppLive(status);

  return (
    <Card className="mt-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${isConnected ? "bg-chip-pos/10 text-chip-pos" : "bg-slate-100 text-slate-400"}`}
          >
            <MessageCircle size={17} strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">WhatsApp</p>
            <p className="text-xs text-slate-500">
              {STATUS_LABELS[status] ?? status}
              {isConnected && session?.phone ? ` · ${session.phone}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!session && (
            <Button size="sm" onClick={connect} disabled={busy}>
              Connect WhatsApp
            </Button>
          )}
          {session && !isConnected && (
            <Button size="sm" variant="secondary" icon={RotateCcw} onClick={refreshQr} disabled={busy}>
              Refresh QR
            </Button>
          )}
          {session && (
            <Button size="sm" variant="ghost" icon={LogOut} onClick={logout} disabled={busy}>
              Logout
            </Button>
          )}
        </div>
      </div>

      {!isConnected && session && !qrCode && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-chip-neg/25 bg-chip-neg/5 px-3 py-2.5 text-xs text-chip-neg">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            WhatsApp isn&apos;t linked, so automated messages to your leads are <strong>not being sent</strong>.
            Tap Refresh QR and scan to reconnect.
          </span>
        </div>
      )}

      {qrCode && !isConnected && (
        <div className="mt-4 flex flex-col items-center gap-2 border-t border-slate-100 pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URI, not a static/remote asset Next's image pipeline handles */}
          <img src={qrCode} alt="WhatsApp QR code" width={200} height={200} className="rounded-lg border border-slate-200" />
          <p className="text-xs text-slate-500">Open WhatsApp on your phone → Linked Devices → Link a Device</p>
          <p className="text-xs text-slate-400">
            This code refreshes on its own — always scan whatever is showing.
          </p>
        </div>
      )}
    </Card>
  );
}
