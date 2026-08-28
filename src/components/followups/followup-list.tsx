"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarCheck2 } from "lucide-react";
import { formatDate } from "@/lib/format";
import { PhoneChip } from "@/components/ui/phone-chip";
import { useToast } from "@/components/ui/toast";
import { EmptyState } from "@/components/ui/empty-state";

type Option = { id: string; name: string };

export type FollowUpListItem = {
  id: string;
  type: string;
  sequenceNumber: number;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  notes: string | null;
  assignedUser: { id: string; name: string };
  lead: { id: string; leadCode: string; name: string; phone: string } | null;
  dealer: { id: string; dealerCode: string | null; dealerName: string; phone: string } | null;
};

export function FollowUpList({
  items,
  results,
  emptyMessage,
}: {
  items: FollowUpListItem[];
  results: Option[];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-slate-200/80 bg-white">
        <EmptyState icon={CalendarCheck2} title={emptyMessage} />
      </div>
    );
  }

  return (
    <ul className="motion-stagger space-y-2">
      {items.map((item, i) => (
        <FollowUpListRow key={item.id} item={item} results={results} index={i} />
      ))}
    </ul>
  );
}

const ACTION_SUCCESS_MESSAGE: Record<string, string> = {
  complete: "Follow-up marked complete.",
  reschedule: "Follow-up rescheduled.",
  cancel: "Follow-up cancelled.",
};

function FollowUpListRow({ item, results, index }: { item: FollowUpListItem; results: Option[]; index: number }) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState<"idle" | "complete" | "reschedule">("idle");
  const [resultId, setResultId] = useState("");
  const [continueFollowUp, setContinueFollowUp] = useState(true);
  const [notes, setNotes] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState(item.scheduledDate.slice(0, 10));
  const [rescheduleTime, setRescheduleTime] = useState(item.scheduledTime);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/v1/followups/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      const message = data.error ?? "Something went wrong";
      setError(message);
      toast.error(message);
      return;
    }
    toast.success(ACTION_SUCCESS_MESSAGE[body.action as string] ?? "Saved.");
    setMode("idle");
    router.refresh();
  }

  const subject = item.lead ?? item.dealer;
  const subjectHref = item.lead ? `/leads/${item.lead.id}` : null;
  const subjectLabel = item.lead ? item.lead.name : item.dealer?.dealerName;
  const subjectCode = item.lead ? item.lead.leadCode : item.dealer?.dealerCode;
  const subjectPhone = subject?.phone;

  return (
    <li
      style={{ "--i": Math.min(index, 10) } as React.CSSProperties}
      className="rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(10,11,16,0.04)] p-4 text-sm"
    >
      <div className="flex items-start justify-between">
        <div>
          {subjectHref ? (
            <Link href={subjectHref} className="font-medium text-slate-900 hover:underline">
              {subjectLabel}
            </Link>
          ) : (
            <span className="font-medium text-slate-900">{subjectLabel}</span>
          )}
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
            <span>{subjectCode}</span>
            <span>·</span>
            {subjectPhone && <PhoneChip value={subjectPhone} />}
            <span>·</span>
            <span>
              #{item.sequenceNumber} {item.type}
            </span>
          </p>
        </div>
        <div className="text-right">
          <p className="font-medium text-slate-900">
            {formatDate(item.scheduledDate)} {item.scheduledTime}
          </p>
          <span className={`chip ${item.status === "OVERDUE" ? "chip-neg" : "chip-live"}`}>{item.status}</span>
        </div>
      </div>

      {item.notes && <p className="mt-2 text-slate-600">{item.notes}</p>}

      {mode === "idle" && (
        <div className="mt-2 flex gap-3">
          <button onClick={() => setMode("complete")} className="text-xs font-medium text-chip-pos hover:underline">
            Complete
          </button>
          <button onClick={() => setMode("reschedule")} className="text-xs font-medium text-brand-700 hover:underline">
            Reschedule
          </button>
          <button
            onClick={() => patch({ action: "cancel" })}
            className="text-xs font-medium text-slate-500 hover:underline"
          >
            Cancel
          </button>
        </div>
      )}

      {mode === "complete" && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <select
            value={resultId}
            onChange={(e) => setResultId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          >
            <option value="">Select outcome…</option>
            {results.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <textarea
            placeholder="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
          />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" checked={continueFollowUp} onChange={(e) => setContinueFollowUp(e.target.checked)} />
            Schedule the next follow-up
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setMode("idle")} className="rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              disabled={!resultId || submitting}
              onClick={() => patch({ action: "complete", resultId, notes: notes || undefined, continueFollowUp })}
              className="rounded bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Mark complete"}
            </button>
          </div>
        </div>
      )}

      {mode === "reschedule" && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
            <input
              type="time"
              value={rescheduleTime}
              onChange={(e) => setRescheduleTime(e.target.value)}
              className="rounded-lg border border-slate-200 px-2.5 py-2 text-sm outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setMode("idle")} className="rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">
              Cancel
            </button>
            <button
              disabled={submitting}
              onClick={() => patch({ action: "reschedule", scheduledDate: rescheduleDate, scheduledTime: rescheduleTime })}
              className="rounded bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Reschedule"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}
