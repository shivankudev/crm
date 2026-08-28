"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  UserCheck,
  ArrowRightLeft,
  PhoneCall,
  StickyNote,
  CalendarClock,
  CalendarCheck,
  CalendarX,
  Car,
  MessageCircle,
  MessageCircleX,
  CheckCheck,
  type LucideIcon,
} from "lucide-react";
import { StatusBadge } from "@/components/leads/status-badge";
import { TemperatureBadge } from "@/components/leads/temperature-badge";
import { PhoneChip } from "@/components/ui/phone-chip";
import { Timeline } from "@/components/ui/timeline";
import { formatDate, formatDateTime } from "@/lib/format";

type Option = { id: string; name: string };
type StatusOption = Option & { isTerminal: boolean };

type Lead = {
  id: string;
  leadCode: string;
  name: string;
  phone: string;
  phone2: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  pincode: string | null;
  temperature: string;
  priority: string;
  closedStatus: string;
  interestedProduct: string | null;
  expectedQuantity: number | null;
  investmentCapacity: string | null;
  financingRequired: boolean;
  status: StatusOption;
  source: { id: string; name: string } | null;
  state: { id: string; name: string } | null;
  assignedUser: { id: string; name: string } | null;
  createdBy: { id: string; name: string };
  lostReason: { name: string } | null;
  createdAt: string;
};

type Activity = {
  id: string;
  type: string;
  fromValue: string | null;
  toValue: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
};

type Call = {
  id: string;
  phoneUsed: string;
  callStatus: string;
  direction?: string;
  durationSecs: number | null;
  notes: string | null;
  user: { id: string; name: string };
  createdAt: string;
};

type Note = {
  id: string;
  body: string;
  user: { id: string; name: string };
  createdAt: string;
};

type FollowUp = {
  id: string;
  type: string;
  sequenceNumber: number;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  notes: string | null;
  result: { name: string } | null;
  assignedUser: { id: string; name: string };
};

type Visit = {
  id: string;
  visitDate: string;
  contactPerson: string | null;
  numberOfVisitors: number | null;
  status: string;
  productDiscussed: string | null;
  notes: string | null;
  result: string | null;
};

const TABS = ["Info", "Timeline", "Calls", "Follow-ups", "Visits", "Notes"] as const;
type Tab = (typeof TABS)[number];

export function LeadProfile({
  lead,
  activity,
  calls,
  notes,
  followUps,
  visits,
  statuses,
  sources,
  states,
  results,
  lostReasons,
  assignableUsers,
  canChangeStatus,
  canAssign,
  canLogCall,
  canManageFollowUps,
  canManageVisits,
  canCreateVisits,
}: {
  lead: Lead;
  activity: Activity[];
  calls: Call[];
  notes: Note[];
  followUps: FollowUp[];
  visits: Visit[];
  statuses: StatusOption[];
  sources: Option[];
  states: Option[];
  results: Option[];
  lostReasons: Option[];
  assignableUsers: Option[];
  canChangeStatus: boolean;
  canAssign: boolean;
  canLogCall: boolean;
  canManageFollowUps: boolean;
  canManageVisits: boolean;
  canCreateVisits: boolean;
}) {
  const [tab, setTab] = useState<Tab>("Info");

  return (
    <div className="mx-auto max-w-4xl">
      <LeadHeader lead={lead} statuses={statuses} lostReasons={lostReasons} canChangeStatus={canChangeStatus} />

      <div className="mt-6 overflow-x-auto border-b border-slate-200/80">
        <nav className="-mb-px flex gap-4">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`shrink-0 border-b-2 px-1 py-2 text-sm font-medium whitespace-nowrap ${
                tab === t ? "border-brand-600 text-brand-700" : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              {t}
              {t === "Follow-ups" && followUps.filter((f) => f.status === "PENDING" || f.status === "OVERDUE").length > 0
                ? ` (${followUps.filter((f) => f.status === "PENDING" || f.status === "OVERDUE").length})`
                : ""}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-4">
        {tab === "Info" && (
          <InfoTab lead={lead} sources={sources} states={states} assignableUsers={assignableUsers} canAssign={canAssign} />
        )}
        {tab === "Timeline" && <TimelineTab activity={activity} />}
        {tab === "Calls" && (
          <CallsTab
            leadId={lead.id}
            leadPhone={lead.phone}
            calls={calls}
            canLogCall={canLogCall}
            results={results}
          />
        )}
        {tab === "Follow-ups" && (
          <FollowUpsTab
            leadId={lead.id}
            followUps={followUps}
            results={results}
            canManage={canManageFollowUps}
          />
        )}
        {tab === "Visits" && (
          <VisitsTab
            leadId={lead.id}
            visits={visits}
            canManage={canManageVisits}
            canCreate={canCreateVisits}
          />
        )}
        {tab === "Notes" && <NotesTab leadId={lead.id} notes={notes} />}
      </div>
    </div>
  );
}

function LeadHeader({
  lead,
  statuses,
  lostReasons,
  canChangeStatus,
}: {
  lead: Lead;
  statuses: StatusOption[];
  lostReasons: Option[];
  canChangeStatus: boolean;
}) {
  const router = useRouter();
  const [showStatusForm, setShowStatusForm] = useState(false);
  const [statusId, setStatusId] = useState(lead.status.id);
  const [lostReasonId, setLostReasonId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const targetStatus = statuses.find((s) => s.id === statusId);

  async function submitStatus() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/v1/leads/${lead.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        statusId,
        lostReasonId: targetStatus?.name === "LOST" ? lostReasonId : undefined,
        note: note || undefined,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    setShowStatusForm(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(10,11,16,0.04)] p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">{lead.name}</h1>
            <StatusBadge name={lead.status.name} isTerminal={lead.status.isTerminal} />
            <TemperatureBadge temperature={lead.temperature} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
            <span>{lead.leadCode}</span>
            <span>·</span>
            <PhoneChip value={lead.phone} />
            <span>· Owner: {lead.assignedUser?.name ?? "Unassigned"}</span>
          </p>
          {lead.lostReason && (
            <p className="mt-1 text-sm text-red-600">Lost reason: {lead.lostReason.name}</p>
          )}
        </div>
        {canChangeStatus && (
          <button
            onClick={() => setShowStatusForm((v) => !v)}
            className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Change status
          </button>
        )}
      </div>

      {showStatusForm && (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
          <select
            value={statusId}
            onChange={(e) => setStatusId(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
          >
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          {targetStatus?.name === "LOST" && (
            <select
              value={lostReasonId}
              onChange={(e) => setLostReasonId(e.target.value)}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-sm"
            >
              <option value="">Select a lost reason…</option>
              {lostReasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Note (optional)"
            rows={2}
            className="w-full rounded-md border border-slate-300 px-2 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowStatusForm(false)}
              className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={submitStatus}
              disabled={submitting || (targetStatus?.name === "LOST" && !lostReasonId)}
              className="rounded bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoTab({
  lead,
  sources,
  states,
  assignableUsers,
  canAssign,
}: {
  lead: Lead;
  sources: Option[];
  states: Option[];
  assignableUsers: Option[];
  canAssign: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    name: lead.name,
    phone: lead.phone,
    email: lead.email ?? "",
    address: lead.address ?? "",
    interestedProduct: lead.interestedProduct ?? "",
    temperature: lead.temperature,
    priority: lead.priority,
    sourceId: lead.source?.id ?? "",
    stateId: lead.state?.id ?? "",
  });
  const [assignedUserId, setAssignedUserId] = useState(lead.assignedUser?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/v1/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  async function reassign(newUserId: string) {
    setAssignedUserId(newUserId);
    const res = await fetch(`/api/v1/leads/${lead.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assignedUserId: newUserId }),
    });
    if (res.ok) router.refresh();
  }

  if (editing) {
    return (
      <div className="space-y-3 rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(10,11,16,0.04)] p-5">
        <Field label="Name">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Phone">
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Email">
          <input
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Address">
          <input
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Interested product">
          <input
            value={form.interestedProduct}
            onChange={(e) => setForm({ ...form, interestedProduct: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Source">
            <select
              value={form.sourceId}
              onChange={(e) => setForm({ ...form, sourceId: e.target.value })}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">—</option>
              {sources.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="State">
            <select
              value={form.stateId}
              onChange={(e) => setForm({ ...form, stateId: e.target.value })}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              <option value="">—</option>
              {states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Temperature">
            <select
              value={form.temperature}
              onChange={(e) => setForm({ ...form, temperature: e.target.value })}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {["HOT", "WARM", "COLD"].map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Priority">
            <select
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
              className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {["LOW", "MEDIUM", "HIGH", "URGENT"].map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2 pt-2">
          <button
            onClick={() => setEditing(false)}
            className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={submitting}
            className="rounded bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(10,11,16,0.04)] p-5">
        <div className="flex justify-end">
          <button onClick={() => setEditing(true)} className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Edit
          </button>
        </div>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <Detail label="Phone" value={<PhoneChip value={lead.phone} />} />
          <Detail label="Alt. phone" value={lead.phone2 ? <PhoneChip value={lead.phone2} /> : null} />
          <Detail label="WhatsApp" value={lead.whatsapp} />
          <Detail label="Email" value={lead.email} />
          <Detail label="Address" value={lead.address} />
          <Detail label="Pincode" value={lead.pincode} />
          <Detail label="State" value={lead.state?.name ?? null} />
          <Detail label="Source" value={lead.source?.name ?? null} />
          <Detail label="Interested product" value={lead.interestedProduct} />
          <Detail label="Expected quantity" value={lead.expectedQuantity?.toString() ?? null} />
          <Detail label="Investment capacity" value={lead.investmentCapacity} />
          <Detail label="Financing required" value={lead.financingRequired ? "Yes" : "No"} />
          <Detail label="Priority" value={lead.priority} />
          <Detail label="Created by" value={lead.createdBy.name} />
          <Detail label="Created" value={formatDateTime(lead.createdAt)} />
        </dl>
      </div>

      {canAssign && (
        <div className="rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(10,11,16,0.04)] p-5">
          <p className="mb-2 text-sm font-medium text-slate-900">Assigned to</p>
          <select
            value={assignedUserId}
            onChange={(e) => reassign(e.target.value)}
            className="w-full max-w-xs rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            <option value="">Unassigned</option>
            {assignableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode | null }) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className="text-slate-800">{value || "—"}</dd>
    </div>
  );
}

const ACTIVITY_LABELS: Record<string, string> = {
  CREATED: "Lead created",
  ASSIGNED: "Reassigned",
  STATUS_CHANGED: "Status changed",
  CALL: "Call logged",
  NOTE: "Note added",
  FOLLOWUP_CREATED: "Follow-up scheduled",
  FOLLOWUP_SCHEDULED: "Next follow-up scheduled",
  FOLLOWUP_COMPLETED: "Follow-up completed",
  FOLLOWUP_RESCHEDULED: "Follow-up rescheduled",
  FOLLOWUP_CANCELLED: "Follow-up cancelled",
  FOLLOWUP_AUTO_CANCELLED: "Follow-ups cancelled (lead closed)",
  VISIT_SCHEDULED: "Factory visit scheduled",
  VISIT_STATUS_CHANGED: "Factory visit status changed",
  // Automated WhatsApp sends, keyed by the message's delivery state so the
  // timeline distinguishes "we handed it to WhatsApp" from "it actually
  // reached them" — see WhatsAppMessageLog.
  WHATSAPP_SENT: "WhatsApp sent",
  WHATSAPP_DELIVERED: "WhatsApp delivered",
  WHATSAPP_READ: "WhatsApp read",
  WHATSAPP_FAILED: "WhatsApp failed",
  WHATSAPP_SKIPPED_NOT_CONNECTED: "WhatsApp not sent (device offline)",
  WHATSAPP_QUEUED: "WhatsApp queued",
};

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  CREATED: Sparkles,
  ASSIGNED: UserCheck,
  STATUS_CHANGED: ArrowRightLeft,
  CALL: PhoneCall,
  NOTE: StickyNote,
  FOLLOWUP_CREATED: CalendarClock,
  FOLLOWUP_SCHEDULED: CalendarClock,
  FOLLOWUP_COMPLETED: CalendarCheck,
  FOLLOWUP_RESCHEDULED: CalendarClock,
  FOLLOWUP_CANCELLED: CalendarX,
  FOLLOWUP_AUTO_CANCELLED: CalendarX,
  VISIT_SCHEDULED: Car,
  VISIT_STATUS_CHANGED: Car,
  WHATSAPP_SENT: MessageCircle,
  WHATSAPP_DELIVERED: MessageCircle,
  WHATSAPP_READ: CheckCheck,
  WHATSAPP_FAILED: MessageCircleX,
  WHATSAPP_SKIPPED_NOT_CONNECTED: MessageCircleX,
  WHATSAPP_QUEUED: MessageCircle,
};

function TimelineTab({ activity }: { activity: Activity[] }) {
  return <Timeline entries={activity} labels={ACTIVITY_LABELS} icons={ACTIVITY_ICONS} />;
}

/**
 * Outcome colours, matching the calling screen exactly. A telecaller who
 * learns "green means reached and interested" at the queue must not meet a
 * different scheme here.
 */
const OUTCOME_STYLES: Record<string, string> = {
  "Connected - Interested":
    "border-chip-pos/35 bg-chip-pos/10 text-chip-pos hover:bg-chip-pos/20 hover:border-chip-pos/60",
  "Connected - Not Interested":
    "border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 hover:border-amber-400",
  "Not Reachable": "border-slate-300 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:border-slate-400",
  "Wrong Number": "border-chip-neg/35 bg-chip-neg/10 text-chip-neg hover:bg-chip-neg/20 hover:border-chip-neg/60",
  "Call Back Later": "border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100 hover:border-brand-400",
};
const DEFAULT_OUTCOME_STYLE =
  "border-slate-300 bg-white text-slate-700 hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700";

/**
 * Logging a call from the lead's own page.
 *
 * This used to write a bare call record and nothing else — no outcome, no
 * follow-up completed, no status change. So the very case it is most used
 * for, a lead ringing back after being marked unreachable, left the
 * follow-up owed forever however well the conversation went. It now goes
 * through the same path the calling queue uses, so a call answered here
 * settles the work exactly as one answered there does.
 */
function CallsTab({
  leadId,
  leadPhone,
  calls,
  canLogCall,
  results,
}: {
  leadId: string;
  leadPhone: string;
  calls: Call[];
  canLogCall: boolean;
  results: Option[];
}) {
  const router = useRouter();
  // Defaults to inbound: outbound calls are logged from the calling queue,
  // so someone reaching for this form is usually recording a call that came
  // in.
  const [direction, setDirection] = useState<"INBOUND" | "OUTBOUND">("INBOUND");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function logOutcome(result: Option) {
    setSubmitting(result.id);
    setError(null);
    try {
      const res = await fetch("/api/v1/telecalling/log-outcome", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadId,
          // No followUpId: the server finds whatever this lead currently owes.
          resultId: result.id,
          phoneUsed: leadPhone,
          notes: notes || undefined,
          direction,
          continueFollowUp: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Couldn't log that call");
        return;
      }
      setNotes("");
      router.refresh();
    } catch {
      setError("Couldn't reach the server — check your connection.");
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="space-y-4">
      {canLogCall && (
        <div className="rounded-lg border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(10,11,16,0.04)]">
          <p className="text-sm font-medium text-slate-900">Log a call</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Records the outcome and settles whatever follow-up this lead owes — the same as logging it from the
            calling screen.
          </p>

          <div className="mt-3 flex flex-wrap gap-2">
            {(
              [
                { key: "INBOUND", label: "They called us" },
                { key: "OUTBOUND", label: "We called them" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setDirection(opt.key)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  direction === opt.key
                    ? "border-brand-500 bg-brand-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <textarea
            placeholder="Notes (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="focus:border-brand-400 focus:ring-brand-100 mt-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:ring-2"
          />

          <p className="mt-3 mb-2 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
            How did it go?
          </p>
          <div className="flex flex-wrap gap-2">
            {results.map((r) => (
              <button
                key={r.id}
                disabled={submitting !== null}
                onClick={() => logOutcome(r)}
                className={`rounded-lg border px-3 py-2 text-xs font-semibold shadow-sm transition disabled:opacity-50 ${
                  OUTCOME_STYLES[r.name] ?? DEFAULT_OUTCOME_STYLE
                }`}
              >
                {submitting === r.id ? "Saving…" : r.name}
              </button>
            ))}
          </div>

          {error && <p className="text-chip-neg mt-2 text-xs">{error}</p>}
        </div>
      )}

      {calls.length === 0 ? (
        <p className="text-sm text-slate-400">No calls logged yet.</p>
      ) : (
        <ul className="space-y-2">
          {calls.map((c) => (
            <li key={c.id} className="rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(10,11,16,0.04)] p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-medium text-slate-900">
                  {/* Which way the call went matters when reading history: a
                      lead who rang back is a warmer signal than one we chased. */}
                  {c.direction === "INBOUND" && (
                    <span className="bg-chip-pos/10 text-chip-pos rounded px-1.5 py-0.5 text-[10px] font-semibold">
                      They called
                    </span>
                  )}
                  {c.callStatus.replaceAll("_", " ")}
                </span>
                <span className="text-xs text-slate-400">{formatDateTime(c.createdAt)}</span>
              </div>
              <p className="text-slate-500">
                {c.user.name} · {c.phoneUsed}
                {c.durationSecs ? ` · ${c.durationSecs}s` : ""}
              </p>
              {c.notes && <p className="mt-1 text-slate-700">{c.notes}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const VISIT_STATUSES = ["PLANNED", "CONFIRMED", "COMPLETED", "CANCELLED", "RESCHEDULED", "NO_SHOW"] as const;

function VisitsTab({
  leadId,
  visits,
  canManage,
  canCreate,
}: {
  leadId: string;
  visits: Visit[];
  canManage: boolean;
  canCreate: boolean;
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [visitDate, setVisitDate] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [numberOfVisitors, setNumberOfVisitors] = useState("");
  const [productDiscussed, setProductDiscussed] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function createVisit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/v1/leads/${leadId}/visits`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        visitDate,
        contactPerson: contactPerson || undefined,
        numberOfVisitors: numberOfVisitors ? Number(numberOfVisitors) : undefined,
        productDiscussed: productDiscussed || undefined,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    setShowCreate(false);
    setVisitDate("");
    setContactPerson("");
    setNumberOfVisitors("");
    setProductDiscussed("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      {canCreate && (
        <div>
          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Schedule factory visit
            </button>
          ) : (
            <form onSubmit={createVisit} className="space-y-2 rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(10,11,16,0.04)] p-4">
              <input
                required
                type="date"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <input
                placeholder="Contact person"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={1}
                  placeholder="No. of visitors"
                  value={numberOfVisitors}
                  onChange={(e) => setNumberOfVisitors(e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <input
                  placeholder="Product discussed"
                  value={productDiscussed}
                  onChange={(e) => setProductDiscussed(e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Schedule"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {visits.length === 0 ? (
        <p className="text-sm text-slate-400">No factory visits yet.</p>
      ) : (
        <ul className="space-y-2">
          {visits.map((v) => (
            <VisitRow key={v.id} visit={v} canManage={canManage} />
          ))}
        </ul>
      )}
    </div>
  );
}

function VisitRow({ visit, canManage }: { visit: Visit; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState(visit.status);
  const [result, setResult] = useState(visit.result ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/v1/factory-visits/${visit.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, result: result || undefined }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <li className="rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(10,11,16,0.04)] p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-900">{formatDate(visit.visitDate)}</span>
        <span className="chip chip-live">{visit.status.replaceAll("_", " ")}</span>
      </div>
      {visit.contactPerson && <p className="text-slate-500">Contact: {visit.contactPerson}</p>}
      {visit.numberOfVisitors && <p className="text-slate-500">{visit.numberOfVisitors} visitor(s)</p>}
      {visit.productDiscussed && <p className="text-slate-600">Discussed: {visit.productDiscussed}</p>}
      {visit.result && <p className="mt-1 text-slate-700">Result: {visit.result}</p>}

      {canManage && !editing && (
        <button onClick={() => setEditing(true)} className="mt-2 text-xs font-medium text-slate-600 hover:underline">
          Update
        </button>
      )}

      {editing && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          >
            {VISIT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replaceAll("_", " ")}
              </option>
            ))}
          </select>
          <textarea
            placeholder="Result / outcome"
            value={result}
            onChange={(e) => setResult(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setEditing(false)} className="rounded-md px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={submitting}
              className="rounded bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function NotesTab({ leadId, notes }: { leadId: string; notes: Note[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/v1/leads/${leadId}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="space-y-2 rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(10,11,16,0.04)] p-4">
        <textarea
          required
          placeholder="Add a note…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Add note"}
          </button>
        </div>
      </form>

      {notes.length === 0 ? (
        <p className="text-sm text-slate-400">No notes yet.</p>
      ) : (
        <ul className="space-y-2">
          {notes.map((n) => (
            <li key={n.id} className="rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(10,11,16,0.04)] p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-medium text-slate-900">{n.user.name}</span>
                <span className="text-xs text-slate-400">{formatDateTime(n.createdAt)}</span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-slate-700">{n.body}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FollowUpsTab({
  leadId,
  followUps,
  results,
  canManage,
}: {
  leadId: string;
  followUps: FollowUp[];
  results: Option[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("10:00");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function createFollowUp(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/v1/leads/${leadId}/followups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledDate, scheduledTime, type: "CALL" }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    setShowCreate(false);
    router.refresh();
  }

  const active = followUps.filter((f) => f.status === "PENDING" || f.status === "OVERDUE");
  const history = followUps.filter((f) => f.status !== "PENDING" && f.status !== "OVERDUE");

  return (
    <div className="space-y-6">
      {canManage && (
        <div>
          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Schedule follow-up
            </button>
          ) : (
            <form onSubmit={createFollowUp} className="space-y-2 rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(10,11,16,0.04)] p-4">
              <div className="grid grid-cols-2 gap-2">
                <input
                  required
                  type="date"
                  value={scheduledDate}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
                <input
                  required
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="rounded bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Schedule"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-slate-900">Active</p>
        {active.length === 0 ? (
          <p className="text-sm text-slate-400">No active follow-ups.</p>
        ) : (
          <ul className="space-y-2">
            {active.map((f) => (
              <FollowUpRow key={f.id} followUp={f} results={results} canManage={canManage} />
            ))}
          </ul>
        )}
      </div>

      {history.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-slate-900">History</p>
          <ul className="space-y-2">
            {history.map((f) => (
              <li key={f.id} className="rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(10,11,16,0.04)] p-3 text-sm text-slate-500">
                <div className="flex items-center justify-between">
                  <span>
                    #{f.sequenceNumber} · {formatDate(f.scheduledDate)} {f.scheduledTime}
                  </span>
                  <span className={`chip ${f.status === "COMPLETED" ? "chip-pos" : f.status === "MISSED" ? "chip-neg" : "chip-mute"}`}>
                    {f.status}
                  </span>
                </div>
                {f.result && <p className="mt-1 text-slate-600">Result: {f.result.name}</p>}
                {f.notes && <p className="mt-1 text-slate-600">{f.notes}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FollowUpRow({
  followUp,
  results,
  canManage,
}: {
  followUp: FollowUp;
  results: Option[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "complete" | "reschedule">("idle");
  const [resultId, setResultId] = useState("");
  const [continueFollowUp, setContinueFollowUp] = useState(true);
  const [notes, setNotes] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState(followUp.scheduledDate.slice(0, 10));
  const [rescheduleTime, setRescheduleTime] = useState(followUp.scheduledTime);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function patch(body: Record<string, unknown>) {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/v1/followups/${followUp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    setMode("idle");
    router.refresh();
  }

  return (
    <li className="rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(10,11,16,0.04)] p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium text-slate-900">
          #{followUp.sequenceNumber} · {formatDate(followUp.scheduledDate)} {followUp.scheduledTime}
        </span>
        <span className={`chip ${followUp.status === "OVERDUE" ? "chip-neg" : "chip-live"}`}>
          {followUp.status}
        </span>
      </div>
      <p className="text-slate-500">Assigned to {followUp.assignedUser.name}</p>

      {canManage && mode === "idle" && (
        <div className="mt-2 flex gap-2">
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
            className="w-full rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
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
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={continueFollowUp}
              onChange={(e) => setContinueFollowUp(e.target.checked)}
            />
            Schedule the next follow-up
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setMode("idle")} className="rounded-md px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100">
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
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
            <input
              type="time"
              value={rescheduleTime}
              onChange={(e) => setRescheduleTime(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setMode("idle")} className="rounded-md px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              disabled={submitting}
              onClick={() =>
                patch({ action: "reschedule", scheduledDate: rescheduleDate, scheduledTime: rescheduleTime })
              }
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
