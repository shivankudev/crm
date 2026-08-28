"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { useRouter } from "next/navigation";
import { Clock3, Package, MapPin, History, ArrowRight, PartyPopper, Search, X } from "lucide-react";
import { StatusBadge } from "@/components/leads/status-badge";
import { TemperatureBadge } from "@/components/leads/temperature-badge";
import { StatCard, StatRail } from "@/components/ui/stat-card";
import { LeadPhone } from "@/components/telecalling/lead-phone";
import { useToast } from "@/components/ui/toast";
import { QuickSendButtons } from "@/components/telecalling/quick-send-buttons";
import { formatDate } from "@/lib/format";
import { canonicalizePhone } from "@/lib/phone";

type Option = { id: string; name: string };

type QueueLead = {
  id: string;
  leadCode: string;
  name: string;
  phone: string;
  phone2: string | null;
  whatsapp: string | null;
  temperature: string;
  priority: string;
  interestedProduct: string | null;
  lastContactAt: string | null;
  status: { id: string; name: string; isTerminal: boolean };
  source: { name: string } | null;
  state: { name: string } | null;
};

type QueueItem = {
  kind: "OVERDUE_FOLLOWUP" | "TODAY_FOLLOWUP" | "NEW_LEAD";
  followUpId: string | null;
  sequenceNumber: number | null;
  scheduledDate: string | null;
  scheduledTime: string | null;
  notes: string | null;
  lead: QueueLead;
};

type DailyStats = {
  dueToday: number;
  connected: number;
  notConnected: number;
  callBack: number;
  pending: number;
  calledToday: number;
  overdue: number;
  newLeads: number;
};

// Client-side mirror of the OUTCOME_RULES the server actually enforces
// (telecalling.service.ts) — used only to drive local UI: which stat
// bucket to bump optimistically, and whether the card gets requeued
// (RETRY_TODAY) or dropped from the local list. The server is the source
// of truth for what's actually written; a mismatch here only means a
// stale optimistic count until the next refresh, never a wrong write.
type OutcomeBehavior = "SCHEDULE_NEXT" | "STOP" | "RETRY_TODAY";
const OUTCOME_CLIENT_RULES: Record<string, { callStatus: "CONNECTED" | "NOT_CONNECTED" | "WRONG_NUMBER" | "CALL_BACK"; behavior: OutcomeBehavior }> = {
  "Connected - Interested": { callStatus: "CONNECTED", behavior: "SCHEDULE_NEXT" },
  "Connected - Not Interested": { callStatus: "CONNECTED", behavior: "STOP" },
  "Not Reachable": { callStatus: "NOT_CONNECTED", behavior: "RETRY_TODAY" },
  "Wrong Number": { callStatus: "WRONG_NUMBER", behavior: "STOP" },
  "Call Back Later": { callStatus: "CALL_BACK", behavior: "RETRY_TODAY" },
};
const DEFAULT_CLIENT_RULE = { callStatus: "CONNECTED" as const, behavior: "SCHEDULE_NEXT" as const };

/**
 * Outcome buttons are tinted by what the choice actually MEANS, so a caller
 * finds the right one by colour rather than reading five similar labels
 * mid-conversation: green reached-and-interested, amber reached-but-closing,
 * slate couldn't-reach, red bad-number, blue call-again.
 *
 * Keyed off the same names as OUTCOME_CLIENT_RULES, with a neutral fallback
 * — outcome options are Settings-editable, so a custom one must still render
 * sensibly instead of losing its styling.
 *
 * Kept as bordered rectangles on purpose: the WhatsApp quick-sends above are
 * filled pills, and these two rows must never be confusable — one logs an
 * outcome and ends the call, the other fires a message.
 */
const OUTCOME_STYLES: Record<string, string> = {
  "Connected - Interested":
    "border-chip-pos/35 bg-chip-pos/10 text-chip-pos hover:bg-chip-pos/20 hover:border-chip-pos/60",
  "Connected - Not Interested":
    "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:border-amber-400",
  "Not Reachable": "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-400",
  "Wrong Number": "border-chip-neg/35 bg-chip-neg/10 text-chip-neg hover:bg-chip-neg/20 hover:border-chip-neg/60",
  "Call Back Later":
    "border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100 hover:border-brand-400",
};
const DEFAULT_OUTCOME_STYLE =
  "border-slate-300 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700";

const KIND_STYLES: Record<QueueItem["kind"], string> = {
  OVERDUE_FOLLOWUP: "chip chip-neg",
  TODAY_FOLLOWUP: "chip chip-live",
  NEW_LEAD: "inline-flex items-center rounded-sm border border-slate-300 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-600 uppercase",
};

const KIND_LABELS: Record<QueueItem["kind"], string> = {
  OVERDUE_FOLLOWUP: "Overdue follow-up",
  TODAY_FOLLOWUP: "Due today",
  NEW_LEAD: "New — not yet contacted",
};

export function TelecallingWorkspace({
  initialItems,
  counts,
  results,
  initialStats,
}: {
  initialItems: QueueItem[];
  counts: { overdue: number; today: number; newLeads: number };
  results: Option[];
  initialStats: DailyStats;
}) {
  const router = useRouter();
  const toast = useToast();
  const [queue, setQueue] = useState(initialItems);
  const [stats, setStats] = useState(initialStats);
  const [notes, setNotes] = useState("");
  const [continueFollowUp, setContinueFollowUp] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");

  const current = queue[0];

  // `requeue` (RETRY_TODAY outcomes) sends the card to the back of the
  // local list instead of dropping it — with nothing left ahead of it,
  // it's shown again immediately, exactly as if it had never been
  // actioned, since the follow-up behind it is still PENDING for today.
  function advance(requeue = false) {
    setQueue((q) => (requeue && q.length > 0 ? [...q.slice(1), q[0]] : q.slice(1)));
    setSearch("");
    setNotes("");
    setContinueFollowUp(true);
    setError(null);
  }

  // Searching only what's already in today's queue, never the whole book.
  // The caller who picks up an unexpected callback needs the card that
  // carries the follow-up they were going to ring about — jumping to it
  // here logs against that follow-up, which reaching the lead's own page
  // cannot do, and leaves this list consistent instead of stale.
  const matches = useMemo(() => {
    const q = search.trim().toLowerCase();
    const none = { isCurrent: false, items: [] as QueueItem[] };
    if (q.length < 2) return none;
    // Canonicalised so a number read off an incoming call ("+91 95200
    // 44032") matches one stored as "9520044032" — the same reason the
    // lead search needed it, and the likeliest way this box gets used.
    const digits = canonicalizePhone(search);
    const hit = (item: QueueItem) => {
      const l = item.lead;
      if (digits.length >= 4 && [l.phone, l.phone2, l.whatsapp].some((p) => p && canonicalizePhone(p).includes(digits))) return true;
      return l.name.toLowerCase().includes(q) || l.leadCode.toLowerCase().includes(q);
    };
    return {
      // The card on screen is not offered as somewhere to jump to, but it
      // still has to be recognised: without this, searching the name shown
      // directly below answered "not in today's queue", which is worse than
      // unhelpful when the lead is right there.
      isCurrent: current ? hit(current) : false,
      items: queue.filter((item, index) => index > 0 && hit(item)).slice(0, 6),
    };
  }, [search, queue, current]);

  // Bring a searched-for card to the front. Everything else keeps its
  // order, so the queue's priority is only interrupted, never rewritten.
  function jumpTo(item: QueueItem) {
    setQueue((q) => [item, ...q.filter((x) => x !== item)]);
    setSearch("");
    setNotes("");
    setContinueFollowUp(true);
    setError(null);
  }

  async function logOutcome(result: Option) {
    if (!current) return;
    setSubmitting(true);
    setError(null);

    const rule = OUTCOME_CLIENT_RULES[result.name] ?? DEFAULT_CLIENT_RULE;

    const res = await fetch("/api/v1/telecalling/log-outcome", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        leadId: current.lead.id,
        followUpId: current.followUpId,
        resultId: result.id,
        phoneUsed: current.lead.phone,
        notes: notes || undefined,
        continueFollowUp,
      }),
    });
    if (!res.ok) {
      const data = await res.json();
      setSubmitting(false);
      const message = data.error ?? "Failed to log the call outcome";
      setError(message);
      toast.error(message);
      return;
    }

    const isRetry = rule.behavior === "RETRY_TODAY";
    setStats((s) => ({
      ...s,
      connected: s.connected + (rule.callStatus === "CONNECTED" ? 1 : 0),
      notConnected: s.notConnected + (rule.callStatus === "NOT_CONNECTED" || rule.callStatus === "WRONG_NUMBER" ? 1 : 0),
      callBack: s.callBack + (rule.callStatus === "CALL_BACK" ? 1 : 0),
      calledToday: s.calledToday + 1,
      // A retried card is still owed today, so it stays counted in
      // pending/overdue rather than being decremented like a resolved one.
      pending: !isRetry && current.kind === "TODAY_FOLLOWUP" ? Math.max(0, s.pending - 1) : s.pending,
      overdue: !isRetry && current.kind === "OVERDUE_FOLLOWUP" ? Math.max(0, s.overdue - 1) : s.overdue,
    }));

    setSubmitting(false);
    toast.success(
      isRetry ? `${result.name} logged — back in today's queue for ${current.lead.name}.` : `${result.name} logged for ${current.lead.name}.`
    );
    advance(isRetry);
  }

  const statsRow = (
    <StatRail>
      <StatCard label="Due today" value={stats.dueToday} accent="brand" size="sm" />
      <StatCard label="Connected" value={stats.connected} accent="pos" size="sm" />
      <StatCard label="Not connected" value={stats.notConnected} accent="mute" size="sm" />
      <StatCard label="Pending" value={stats.pending} accent="brand" size="sm" />
      <StatCard label="Overdue" value={stats.overdue} accent={stats.overdue > 0 ? "neg" : "mute"} size="sm" />
    </StatRail>
  );

  if (!current) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">Telecalling</h1>
        <p className="mt-1 text-xs text-slate-500">Your daily calling queue, worked in priority order.</p>

        <div className="mt-5">{statsRow}</div>

        <div className="motion-rise mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center">
          <PartyPopper className="mx-auto text-brand-500" size={28} strokeWidth={1.75} />
          <p className="mt-3 text-sm font-semibold text-slate-900">You&apos;re all caught up</p>
          <p className="mt-1 text-xs text-slate-500">
            {stats.calledToday > 0 ? `${stats.calledToday} call(s) logged today. ` : ""}
            No overdue or due-today follow-ups, and no unworked new leads.
          </p>
          <button
            onClick={() => router.refresh()}
            className="mt-4 rounded border border-slate-300 px-3.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Refresh queue
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">Telecalling</h1>
        <p className="text-xs text-slate-500">
          {queue.length} remaining in queue · {counts.newLeads} new
        </p>
      </div>

      <div className="mt-5">{statsRow}</div>

      {/* Jump straight to any lead already in today's queue — for the
          callback that arrives mid-list, so the caller settles the right
          follow-up without leaving this screen. */}
      <div className="relative mt-5">
        <Search size={13} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSearch("");
            if (e.key === "Enter" && matches.items.length > 0) jumpTo(matches.items[0]);
          }}
          placeholder="Someone called back? Find them in today's queue — name, number or code"
          className="w-full rounded-md border border-slate-200 bg-white py-2 pr-8 pl-8 text-xs text-slate-800 placeholder:text-slate-400 focus:border-brand-400 focus:ring-1 focus:ring-brand-400 focus:outline-none"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            aria-label="Clear search"
            className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X size={13} />
          </button>
        )}

        {search.trim().length >= 2 && (
          <div className="motion-fade absolute z-20 mt-1 w-full overflow-hidden rounded-md border border-slate-200 bg-white shadow-lg">
            {matches.items.length === 0 ? (
              <p className="px-3 py-2.5 text-[11px] text-slate-500">
                {matches.isCurrent ? (
                  <>Already on screen — use the outcome buttons below.</>
                ) : (
                  <>
                    Not in today&apos;s queue.{" "}
                    <Link href={`/leads?q=${encodeURIComponent(search.trim())}`} className="font-medium text-brand-600 hover:underline">
                      Search all leads
                    </Link>
                  </>
                )}
              </p>
            ) : (
              matches.items.map((item) => (
                <button
                  key={item.followUpId ?? item.lead.id}
                  type="button"
                  onClick={() => jumpTo(item)}
                  className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-slate-50"
                >
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800">{item.lead.name}</span>
                  <span className="tnum shrink-0 font-mono text-[11px] text-slate-500">{item.lead.phone}</span>
                  <span className={KIND_STYLES[item.kind]}>{KIND_LABELS[item.kind]}</span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Keyed on the lead so every advance replays the entrance — the one
          authored moment in the app: the queue moving to the next call.
          Dips while the outcome is being written so the click registers. */}
      <div
        key={current.lead.id}
        className={clsx(
          "motion-queue-card mt-6 rounded-lg border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(10,11,16,0.04)] transition duration-200",
          submitting && "pointer-events-none scale-[0.99] opacity-60"
        )}
      >
        <div className="flex items-center justify-between">
          <span className={KIND_STYLES[current.kind]}>{KIND_LABELS[current.kind]}</span>
          {current.scheduledDate && (
            <span className="flex items-center gap-1 text-[11px] text-slate-400">
              <History size={11} />
              {formatDate(current.scheduledDate)} {current.scheduledTime}
            </span>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <h2 className="text-base font-semibold text-slate-900">{current.lead.name}</h2>
          <StatusBadge name={current.lead.status.name} isTerminal={current.lead.status.isTerminal} />
          <TemperatureBadge temperature={current.lead.temperature} />
        </div>
        <p className="mt-0.5 font-mono text-[11px] text-slate-400">{current.lead.leadCode}</p>

        {/* The number is the one thing on this card the caller has to read
            accurately, often while already reaching for the phone — so it
            gets its own highlighted row, big, and tap-to-call/copy. */}
        <LeadPhone value={current.lead.phone} alt={current.lead.phone2} />

        <dl className="mt-3.5 grid grid-cols-2 gap-x-6 gap-y-3 text-xs">
          <div className="flex items-start gap-2">
            <Package size={13} className="mt-0.5 shrink-0 text-slate-400" />
            <div>
              <dt className="text-[10px] font-medium tracking-wide text-slate-400 uppercase">Interested product</dt>
              <dd className="text-slate-800">{current.lead.interestedProduct || "—"}</dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MapPin size={13} className="mt-0.5 shrink-0 text-slate-400" />
            <div>
              <dt className="text-[10px] font-medium tracking-wide text-slate-400 uppercase">Source / State</dt>
              <dd className="text-slate-800">
                {[current.lead.source?.name, current.lead.state?.name].filter(Boolean).join(" · ") || "—"}
              </dd>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Clock3 size={13} className="mt-0.5 shrink-0 text-slate-400" />
            <div>
              <dt className="text-[10px] font-medium tracking-wide text-slate-400 uppercase">Last contact</dt>
              <dd className="text-slate-800">
                {current.lead.lastContactAt ? formatDate(current.lead.lastContactAt) : "Never"}
              </dd>
            </div>
          </div>
        </dl>

        {current.notes && (
          <p className="mt-3 rounded bg-slate-50 p-2.5 text-xs text-slate-600">Previous note: {current.notes}</p>
        )}

        <Link
          href={`/leads/${current.lead.id}`}
          className="hover:text-brand-600 mt-3 inline-flex items-center gap-1 text-[11px] font-medium text-slate-500"
        >
          View full profile <ArrowRight size={12} />
        </Link>

        {/* Sits above the outcome buttons on purpose: sharing details is
            something the caller does DURING the call, before deciding how
            it went. Deliberately NOT keyed on the lead — remounting per card
            refetched the (identical) button list every time and left a gap
            where the buttons should be; the component resets its own
            per-lead state instead. */}
        <QuickSendButtons leadId={current.lead.id} leadName={current.lead.name} />

        <div className="mt-5 border-t border-slate-100 pt-5">
          <p className="mb-2 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">Call outcome</p>
          <div className="flex flex-wrap gap-2">
            {results.map((r) => (
              <button
                key={r.id}
                disabled={submitting}
                onClick={() => logOutcome(r)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition duration-150 active:scale-[0.97] disabled:opacity-50 disabled:active:scale-100 motion-reduce:active:scale-100 ${
                  OUTCOME_STYLES[r.name] ?? DEFAULT_OUTCOME_STYLE
                }`}
              >
                {r.name}
              </button>
            ))}
          </div>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="focus:border-brand-400 focus:ring-brand-100 mt-3 w-full rounded border border-slate-200 px-3 py-2 text-xs outline-none focus:ring-2"
          />

          {current.followUpId && (
            <label className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-600">
              <input
                type="checkbox"
                checked={continueFollowUp}
                onChange={(e) => setContinueFollowUp(e.target.checked)}
              />
              Schedule the next follow-up
              {/* Only "Connected - Interested" reads this — the other four
                  outcomes have fixed behavior (stop, or retry today) that
                  this toggle can't override. */}
              <span className="text-slate-400">(applies to Connected – Interested only)</span>
            </label>
          )}

          {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

          <div className="mt-3 flex justify-end">
            <button
              onClick={() => advance()}
              disabled={submitting}
              className="text-xs font-medium text-slate-400 hover:text-slate-700"
            >
              Skip for now →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
