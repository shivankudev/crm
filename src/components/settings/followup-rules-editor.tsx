"use client";

import { Fragment, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useToast } from "@/components/ui/toast";

type Rule = {
  id: string;
  sequenceNumber: number;
  daysAfterPrevious: number;
  defaultTime: string;
  enabled: boolean;
  appliesTo: string;
};

const fieldClass =
  "focus:border-brand-400 focus:ring-brand-100 rounded-lg border border-slate-200 px-2 py-1 text-xs outline-none focus:ring-2";

export function FollowUpRulesEditor({ rules }: { rules: Rule[] }) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState({ sequenceNumber: "", daysAfterPrevious: "", defaultTime: "10:00", appliesTo: "LEAD" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // A gap edit is held here — pending a "new leads only" vs "existing too"
  // choice — instead of patching on blur like every other field, since
  // changing this one has consequences beyond the row itself (§6).
  const [pendingGap, setPendingGap] = useState<{ ruleId: string; days: number } | null>(null);
  // Bumped to force the (uncontrolled) number input to remount with its
  // original defaultValue when a pending change is cancelled.
  const [resetTick, setResetTick] = useState(0);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/v1/settings/followup-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sequenceNumber: Number(form.sequenceNumber),
        daysAfterPrevious: Number(form.daysAfterPrevious),
        defaultTime: form.defaultTime,
        appliesTo: form.appliesTo,
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    setForm({ sequenceNumber: "", daysAfterPrevious: "", defaultTime: "10:00", appliesTo: "LEAD" });
    router.refresh();
  }

  async function patch(rule: Rule, body: Record<string, unknown>) {
    const res = await fetch(`/api/v1/settings/followup-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      toast.error(data.error ?? "Failed to update the rule");
      return;
    }
    if (typeof data.shiftedCount === "number" && data.shiftedCount > 0) {
      toast.success(`Rescheduled ${data.shiftedCount} already-pending follow-up${data.shiftedCount === 1 ? "" : "s"}.`);
    }
    router.refresh();
  }

  async function confirmGapChange(rule: Rule, applyToExisting: boolean) {
    if (!pendingGap) return;
    setSubmitting(true);
    await patch(rule, { daysAfterPrevious: pendingGap.days, applyToExisting });
    setSubmitting(false);
    setPendingGap(null);
  }

  function cancelGapChange() {
    setPendingGap(null);
    setResetTick((t) => t + 1);
  }

  return (
    <div className="space-y-3">
      <Card className="divide-y divide-slate-100 overflow-hidden">
        {rules.map((rule) => (
          <Fragment key={rule.id}>
            <div className="flex items-center gap-3 px-4 py-2.5 text-sm">
              <span className="w-10 font-medium text-slate-900">#{rule.sequenceNumber}</span>
              <span className="bg-brand-50 text-brand-600 w-16 rounded-full px-2 py-0.5 text-center text-xs font-medium">
                {rule.appliesTo}
              </span>
              <label className="flex items-center gap-1 text-xs text-slate-500">
                Every
                <input
                  key={`${rule.id}-${rule.daysAfterPrevious}-${resetTick}`}
                  type="number"
                  min={0}
                  disabled={submitting}
                  defaultValue={rule.daysAfterPrevious}
                  onBlur={(e) => {
                    const value = Number(e.target.value);
                    if (value !== rule.daysAfterPrevious) setPendingGap({ ruleId: rule.id, days: value });
                  }}
                  className={`w-14 ${fieldClass}`}
                />
                day(s) at
              </label>
              <input
                type="time"
                defaultValue={rule.defaultTime}
                onBlur={(e) => {
                  if (e.target.value !== rule.defaultTime) patch(rule, { defaultTime: e.target.value });
                }}
                className={fieldClass}
              />
              <button
                onClick={() => patch(rule, { enabled: !rule.enabled })}
                className={`ml-auto text-xs font-medium hover:underline ${rule.enabled ? "text-slate-500" : "text-amber-600"}`}
              >
                {rule.enabled ? "Disable" : "Enable"}
              </button>
            </div>

            {pendingGap?.ruleId === rule.id && (
              <div className="bg-amber-50 px-4 py-3 text-xs text-amber-900">
                <p>
                  Change step #{rule.sequenceNumber} to every <strong>{pendingGap.days} day(s)</strong> — who should
                  this apply to?
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    disabled={submitting}
                    onClick={() => confirmGapChange(rule, false)}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
                  >
                    New leads only
                  </button>
                  <button
                    disabled={submitting}
                    onClick={() => confirmGapChange(rule, true)}
                    className="rounded border border-slate-300 bg-white px-2.5 py-1 font-medium text-slate-700 transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
                  >
                    Also reschedule existing pending follow-ups
                  </button>
                  <button
                    disabled={submitting}
                    onClick={cancelGapChange}
                    className="px-2.5 py-1 font-medium text-slate-400 hover:text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </Fragment>
        ))}
      </Card>

      <form onSubmit={create} className="flex flex-wrap items-center gap-2">
        <input
          required
          type="number"
          min={1}
          placeholder="Seq #"
          value={form.sequenceNumber}
          onChange={(e) => setForm({ ...form, sequenceNumber: e.target.value })}
          className={`w-20 ${fieldClass} py-1.5`}
        />
        <input
          required
          type="number"
          min={0}
          placeholder="Days after"
          value={form.daysAfterPrevious}
          onChange={(e) => setForm({ ...form, daysAfterPrevious: e.target.value })}
          className={`w-28 ${fieldClass} py-1.5`}
        />
        <input
          type="time"
          value={form.defaultTime}
          onChange={(e) => setForm({ ...form, defaultTime: e.target.value })}
          className={`${fieldClass} py-1.5`}
        />
        <select
          value={form.appliesTo}
          onChange={(e) => setForm({ ...form, appliesTo: e.target.value })}
          className={`${fieldClass} bg-white py-1.5`}
        >
          <option value="LEAD">LEAD</option>
          <option value="DEALER">DEALER</option>
          <option value="BOTH">BOTH</option>
        </select>
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-1.5 rounded bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          <Plus size={14} strokeWidth={2.5} />
          Add
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
