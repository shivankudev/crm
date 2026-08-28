"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
 * How closely to watch a link, and for how long after it first goes live.
 *
 * A scan is not the end of the story. Baileys opens the socket and reports
 * ready, and WhatsApp then immediately closes it with 515 "restart
 * required"; the gateway reconnects, and only that second connection
 * decides whether the link actually holds. If the phone drops out during
 * that window the session never comes back — and on a flat 30s heartbeat
 * the panel sat on a confident "Connected" throughout, which is precisely
 * the moment a telecaller is watching it to see whether their scan worked.
 */
const HEARTBEAT_SETTLING_MS = 4000;
const HEARTBEAT_STEADY_MS = 30000;
const SETTLE_WINDOW_MS = 90000;

/**
 * How often to re-read the code.
 *
 * Bounded by the gateway, not by taste: OpenWA's default limiter allows 100
 * requests a minute per key. At 3s each open QR screen costs 20/min, so
 * four telecallers scanning at once sit just under the ceiling. Halving
 * this to 1.5s for a tighter countdown put four of them at 168/min — and a
 * throttled poll is far worse than an imprecise timer, because the code
 * stops refreshing altogether.
 */
const QR_POLL_MS = 3000;


/**
 * How long a scan code is good for, used only to drive the countdown.
 *
 * Neither WhatsApp nor the gateway publishes an expiry, so this was
 * measured: polling the gateway's own QR endpoint twice a second gave
 * rotations of 20.4s and 20.2s. (A coarser reading through the browser
 * suggested 24s, but that measures from when the CLIENT noticed a change,
 * which inherits up to 3s of poll lag at each end — the gateway-side figure
 * is the real one.)
 *
 * Set marginally under the measured interval on purpose. Erring short means
 * the caption briefly says a new code is imminent while the old one is
 * still valid, which is harmless and stated as such. Erring long would have
 * it promise seconds that no longer exist.
 */
const QR_LIFETIME_MS = 20000;

/**
 * How long a code may sit unchanged before it is treated as dead.
 *
 * WhatsApp gives up on an unscanned code, and the gateway then keeps
 * serving whatever it generated last — a session found in this state had
 * been showing the same code for nineteen hours. Nothing distinguishes that
 * from a live code except that it never rotates, so the only honest signal
 * is elapsed time. Generous enough not to fire on a slow rotation.
 */
const QR_STALE_AFTER_MS = 3 * QR_LIFETIME_MS;

/**
 * Caption refresh rate. Only the wording depends on this now — the bar is
 * animated by CSS — so a whole second is plenty and it keeps re-renders to
 * one per second instead of five.
 */
const QR_TICK_MS = 1000;

/**
 * Longest the poll may back off to after repeated failures.
 *
 * It used to stop outright after five failures and wait for the 30s
 * heartbeat to notice and restart it, so a brief gateway hiccup froze the
 * code for the best part of a minute while the countdown kept draining —
 * indistinguishable, on screen, from a dead session. Slowing down instead
 * of stopping means it always recovers on its own.
 */
const QR_POLL_MAX_BACKOFF_MS = 15000;

/** Consecutive failures before the screen admits it is struggling. */
const QR_FAILURES_BEFORE_WARNING = 4;

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
  /**
   * A live status seen on two separate checks, far enough apart to have
   * survived the post-scan reconnect. Until then the panel says the link
   * is still finishing rather than claiming one that may be seconds from
   * collapsing.
   */
  const [confirmedLive, setConfirmedLive] = useState(false);
  /**
   * Milliseconds until the displayed code is replaced; null when no code is
   * showing. Held in ms, not whole seconds, so the bar can move smoothly
   * while the caption still counts in seconds.
   */
  const [qrMsLeft, setQrMsLeft] = useState<number | null>(null);
  /** False when the CRM could not reach the WhatsApp gateway at all. */
  const [gatewayReachable, setGatewayReachable] = useState(true);
  /** True once the displayed code has gone too long without rotating to be trusted. */
  const [qrStale, setQrStale] = useState(false);
  /** True while the gateway is turning our polls away for being too frequent. */
  const [throttled, setThrottled] = useState(false);
  /** True when the code has repeatedly failed to refresh, so the screen can say so. */
  const [pollFailing, setPollFailing] = useState(false);

  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Last status ANY poll saw, so we only react to genuine transitions. */
  const lastStatusRef = useRef<string | null>(null);
  /** When the session first reported live, so the settling window can end. */
  const liveSinceRef = useRef<number | null>(null);
  /** When the code currently on screen first appeared — the countdown's origin. */
  const qrSeenAtRef = useRef<number | null>(null);
  /** The code currently displayed, so a rotation can be told from a repeat poll. */
  const qrCodeRef = useRef<string | null>(null);
  /** The meter itself, animated directly rather than through React. */
  const barRef = useRef<HTMLDivElement | null>(null);
  /**
   * Re-arms the heartbeat at whatever cadence now applies. Held in a ref
   * because the moment the cadence needs to change — the QR poll seeing
   * the link go live — happens inside a callback defined before the
   * heartbeat itself.
   */
  const rearmHeartbeatRef = useRef<(() => void) | null>(null);

  /**
   * Swaps in a new scan code and restarts its countdown. Routed through one
   * function so the timer can never end up measuring a code other than the
   * one actually on screen.
   */
  const applyQrCode = useCallback((next: string | null) => {
    // Compared against a ref, and every write done here rather than inside
    // the setQrCode updater.
    //
    // Two bugs came out of the previous shape. The countdown was re-seeded
    // on EVERY poll instead of only on a genuine rotation, so it snapped
    // back to full every three seconds and then jumped to the real
    // remaining time — the bar visibly stuttered. And mutating a ref inside
    // a state updater is a side effect in a function React expects to be
    // pure and may call more than once.
    if (qrCodeRef.current === next) return;
    qrCodeRef.current = next;
    qrSeenAtRef.current = next ? Date.now() : null;
    setQrCode(next);
    setQrMsLeft(next ? QR_LIFETIME_MS : null);
    setQrStale(false);
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const stopHeartbeat = useCallback(() => {
    if (heartbeatRef.current) {
      clearTimeout(heartbeatRef.current);
      heartbeatRef.current = null;
    }
  }, []);

  /**
   * The single place a status is recorded.
   *
   * Every poll routes through here. The QR poll used to update the
   * rendered status but not `lastStatusRef`, so after a scan the
   * "previous" status stayed at qr_ready — and the later drop from ready
   * was never seen as a live→dead transition, meaning no warning fired for
   * the one failure a telecaller most needs to be told about.
   */
  const recordStatus = useCallback(
    (next: string, phone?: string | null) => {
      const prev = lastStatusRef.current;
      lastStatusRef.current = next;
      const nowLive = isWhatsAppLive(next);

      if (nowLive) {
        if (liveSinceRef.current === null) liveSinceRef.current = Date.now();
        else setConfirmedLive(true);
      } else {
        liveSinceRef.current = null;
        setConfirmedLive(false);
      }

      setSession((s) => ({ status: next, phone: phone ?? s?.phone ?? null }));

      if (prev && isWhatsAppLive(prev) && !nowLive) {
        toast.error("WhatsApp disconnected — your automated messages are no longer being sent.");
      }
    },
    [toast]
  );

  const startPolling = useCallback(() => {
    stopPolling();

    // WhatsApp rotates the QR roughly every 20s while it waits to be
    // scanned, and OpenWA emits a fresh one on every rotation. GET /qr
    // always returns the CURRENT one, so re-reading is what keeps the code
    // on screen scannable rather than silently stale. Polling here (rather
    // than subscribing to OpenWA's WebSocket) deliberately keeps the
    // gateway API key server-side — the browser only ever talks to this CRM.
    //
    // Self-rescheduling rather than a fixed interval so a failing gateway
    // can be backed away from without ever giving up on it.
    let consecutiveFailures = 0;

    const tick = async () => {
      const res = await fetch("/api/v1/whatsapp/session/qr").catch(() => null);
      let delay = QR_POLL_MS;

      if (!res || !res.ok) {
        consecutiveFailures++;
        setPollFailing(consecutiveFailures >= QR_FAILURES_BEFORE_WARNING);
        // Double the wait each time, capped — never stop.
        delay = Math.min(QR_POLL_MS * 2 ** consecutiveFailures, QR_POLL_MAX_BACKOFF_MS);
      } else {
        consecutiveFailures = 0;
        setPollFailing(false);
        const data = await res.json().catch(() => null);
        if (data) {
          // A throttled poll carries no code — applying it would blank a
          // perfectly good one on screen and restart the countdown.
          setThrottled(data.throttled === true);
          if (!data.throttled) applyQrCode(data.qrCode ?? null);
          setGatewayReachable(data.gatewayReachable !== false);
          recordStatus(data.status);
          if (!shouldPoll(data.status)) {
            stopPolling();
            // Hand over to the heartbeat at the cadence that now applies.
            rearmHeartbeatRef.current?.();
            return;
          }
          // Being turned away for asking too often is itself a reason to ask
          // less often.
          if (data.throttled) delay = QR_POLL_MAX_BACKOFF_MS;
        }
      }

      pollRef.current = setTimeout(tick, delay);
    };

    pollRef.current = setTimeout(tick, QR_POLL_MS);
  }, [applyQrCode, recordStatus, stopPolling]);

  /**
   * Liveness check that keeps running even while the device is happily
   * linked. A WhatsApp device can drop on its own at any time — the phone
   * goes offline for too long, someone removes it from Linked Devices, or
   * WhatsApp expires the companion — and none of that produces any signal
   * in the CRM. Without this the panel would keep showing a confident
   * "Connected" while every message silently failed until someone happened
   * to reload the page.
   *
   * Self-rescheduling rather than a fixed interval so the cadence can
   * tighten during the fragile window just after a link goes live, then
   * relax once it has held. It hits /whatsapp/session, which re-reads the
   * live status from OpenWA server-side rather than echoing our cached row.
   */
  const startHeartbeat = useCallback(() => {
    stopHeartbeat();

    const nextDelay = () => {
      const since = liveSinceRef.current;
      if (since !== null && Date.now() - since < SETTLE_WINDOW_MS) return HEARTBEAT_SETTLING_MS;
      return HEARTBEAT_STEADY_MS;
    };

    const tick = async () => {
      const res = await fetch("/api/v1/whatsapp/session").catch(() => null);
      if (res && res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.session) {
          recordStatus(data.session.status, data.session.phone);
          // Re-arm QR polling if it fell back into a scannable state.
          if (isWhatsAppPending(data.session.status) && !pollRef.current) startPolling();
        }
      }
      // Always reschedule — a transient failure must not end the watch.
      heartbeatRef.current = setTimeout(tick, nextDelay());
    };

    rearmHeartbeatRef.current = () => {
      stopHeartbeat();
      heartbeatRef.current = setTimeout(tick, nextDelay());
    };

    heartbeatRef.current = setTimeout(tick, nextDelay());
  }, [recordStatus, startPolling, stopHeartbeat]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/v1/whatsapp/session")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        if (data.session) {
          setSession({ status: data.session.status, phone: data.session.phone });
          lastStatusRef.current = data.session.status;
          if (isWhatsAppLive(data.session.status)) {
            // Already linked when the page opened, so it has plainly held —
            // no need to make them watch a "finishing" state.
            liveSinceRef.current = 0;
            setConfirmedLive(true);
          }
          if (shouldPoll(data.session.status)) startPolling();
          // Runs in every state, including a healthy one — this is what
          // catches a device that drops later.
          startHeartbeat();
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      stopPolling();
      stopHeartbeat();
    };
  }, [startPolling, startHeartbeat, stopPolling, stopHeartbeat]);

  // Ticks once a second while a code is displayed. Keyed on qrCode so a
  // rotation restarts it cleanly, and torn down the moment the code goes.
  useEffect(() => {
    if (!qrCode) return;
    const id = setInterval(() => {
      const seenAt = qrSeenAtRef.current ?? Date.now();
      const age = Date.now() - seenAt;
      setQrMsLeft(Math.max(0, QR_LIFETIME_MS - age));
      // A code that has not rotated in three lifetimes is not late, it is dead.
      if (age > QR_STALE_AFTER_MS) setQrStale(true);
    }, QR_TICK_MS);
    return () => clearInterval(id);
  }, [qrCode]);

  /**
   * Drains the meter with one CSS transition per code, rather than by
   * re-rendering a width.
   *
   * Setting the width from a timer moved it in visible ~1% steps five times
   * a second. Handing the whole remaining duration to the browser lets it
   * interpolate at native frame rate, so the motion is genuinely continuous
   * and costs no re-renders at all. The width is therefore set here and
   * never in JSX — leaving it in the markup would have React overwrite the
   * animation on the next render.
   */
  useEffect(() => {
    const el = barRef.current;
    if (!el) return;

    if (!qrCode) {
      el.style.transition = "none";
      el.style.width = "0%";
      return;
    }

    const seenAt = qrSeenAtRef.current ?? Date.now();
    const remaining = Math.max(0, QR_LIFETIME_MS - (Date.now() - seenAt));

    // Jump to where this code actually stands, with no animation...
    el.style.transition = "none";
    el.style.width = `${(remaining / QR_LIFETIME_MS) * 100}%`;
    // ...force the browser to take that as the start of the transition...
    void el.offsetWidth;
    // ...then let it run down to empty over whatever time is left.
    el.style.transition = `width ${remaining}ms linear`;
    el.style.width = "0%";
  }, [qrCode]);

  async function connect() {
    setBusy(true);
    const res = await fetch("/api/v1/whatsapp/session", { method: "POST" }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res || !res.ok) {
      toast.error(data.error ?? "Failed to start WhatsApp connection");
      return;
    }
    applyQrCode(data.qrCode ?? null);
    recordStatus(data.status);
    if (shouldPoll(data.status)) startPolling();
    startHeartbeat();
  }

  async function refreshQr() {
    setBusy(true);
    const res = await fetch("/api/v1/whatsapp/session/refresh", { method: "POST" }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res || !res.ok) {
      toast.error(data.error ?? "Failed to refresh QR code");
      return;
    }
    applyQrCode(data.qrCode ?? null);
    recordStatus(data.status);
    if (shouldPoll(data.status)) startPolling();
    // Restarting a session used to leave the watch un-armed if the page had
    // been opened with no session at all, so a link made this way was never
    // monitored afterwards.
    startHeartbeat();
  }

  async function logout() {
    setBusy(true);
    const res = await fetch("/api/v1/whatsapp/session", { method: "DELETE" }).catch(() => null);
    const data = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    stopPolling();
    if (!res || !res.ok) {
      toast.error(data.error ?? "Failed to log out of WhatsApp");
      return;
    }
    stopHeartbeat();
    applyQrCode(null);
    // Deliberate: no "disconnected" warning for a logout they just asked for.
    lastStatusRef.current = data.session.status;
    liveSinceRef.current = null;
    setConfirmedLive(false);
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

  // Caption seconds derived from the same millisecond value that drives the
  // bar, so the two can never disagree.
  const qrSecondsLeft = qrMsLeft === null ? null : Math.ceil(qrMsLeft / 1000);

  const status = session?.status ?? "disconnected";
  const statusIsLive = isWhatsAppLive(status);
  // "Connected" is claimed only once the link has actually held — see
  // confirmedLive. Everything else (QR, warnings) keys off the raw status.
  const showAsConnected = statusIsLive && confirmedLive;
  const label = statusIsLive && !confirmedLive ? "Finishing link…" : (STATUS_LABELS[status] ?? status);

  return (
    <Card className="mt-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div
            className={`flex h-9 w-9 items-center justify-center rounded-lg ${showAsConnected ? "bg-chip-pos/10 text-chip-pos" : "bg-slate-100 text-slate-400"}`}
          >
            <MessageCircle size={17} strokeWidth={2.25} />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-900">WhatsApp</p>
            <p className="text-xs text-slate-500">
              {label}
              {showAsConnected && session?.phone ? ` · ${session.phone}` : ""}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!session && (
            <Button size="sm" onClick={connect} disabled={busy}>
              Connect WhatsApp
            </Button>
          )}
          {session && !statusIsLive && (
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

      {!statusIsLive && session && !qrCode && !gatewayReachable && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            Can&apos;t reach the WhatsApp service, so no code can be shown. This is the CRM&apos;s own
            gateway, not your phone — ask whoever runs the server to check it.
          </span>
        </div>
      )}

      {!statusIsLive && session && !qrCode && gatewayReachable && (
        <div className="border-chip-neg/25 bg-chip-neg/5 text-chip-neg mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            WhatsApp isn&apos;t linked, so automated messages to your leads are <strong>not being sent</strong>.
            Tap Refresh QR and scan to reconnect.
          </span>
        </div>
      )}

      {pollFailing && !statusIsLive && !throttled && (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          Having trouble refreshing the code — still retrying. If this does not clear, tap{" "}
          <strong>Refresh QR</strong>.
        </p>
      )}

      {throttled && !statusIsLive && (
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
          The WhatsApp service is busy — still trying. The code below stays valid meanwhile.
        </p>
      )}

      {qrCode && !statusIsLive && qrStale && (
        <div className="border-chip-neg/25 bg-chip-neg/5 text-chip-neg mt-3 flex items-start gap-2 rounded-lg border px-3 py-2.5 text-xs">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
          <span>
            This code has expired — WhatsApp stopped refreshing it, so scanning it will not work. Tap{" "}
            <strong>Refresh QR</strong> for a working one.
          </span>
        </div>
      )}

      {qrCode && !statusIsLive && (
        <div className="mt-4 flex flex-col items-center gap-2 border-t border-slate-100 pt-4">
          {/* Dimmed once expired, so nobody keeps pointing a phone at a code
              that cannot work. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- a data: URI, not a static/remote asset Next's image pipeline handles */}
          <img
            src={qrCode}
            alt="WhatsApp QR code"
            width={200}
            height={200}
            className={`rounded-lg border border-slate-200 ${qrStale ? "opacity-25 grayscale" : ""}`}
          />
          <p className="text-xs text-slate-500">Open WhatsApp on your phone → Linked Devices → Link a Device</p>

          {/* Counts down to the next rotation. Approximate by nature — see
              QR_LIFETIME_MS — so it is phrased as "about", and once it runs
              out it says what is happening rather than sitting on zero. */}
          <div className={`w-full max-w-[200px] ${qrStale ? "hidden" : ""}`}>
            <div className="h-1 overflow-hidden rounded-full bg-slate-100">
              {/* Width is driven imperatively by the effect above — deliberately
                  absent here so a re-render cannot interrupt the animation.
                  Only the colour comes from React. */}
              <div
                ref={barRef}
                className={`h-full rounded-full transition-colors duration-500 ${
                  qrSecondsLeft !== null && qrSecondsLeft <= 5 ? "bg-amber-400" : "bg-brand-500"
                }`}
                style={{ width: 0 }}
              />
            </div>
            <p className="mt-1.5 text-center text-[11px] text-slate-400">
              {qrSecondsLeft === null
                ? "This code refreshes on its own."
                : qrSecondsLeft > 0
                  ? `New code in about ${qrSecondsLeft}s — scanning now is fine`
                  : "Refreshing any moment — the code on screen still works"}
            </p>
          </div>
        </div>
      )}
    </Card>
  );
}
