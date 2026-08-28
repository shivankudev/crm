"use client";

import { useState } from "react";
import Link from "next/link";

type Option = { id: string; name: string };
type DuplicateInfo = { id: string; leadCode: string; name: string; phone: string };

const inputClass =
  "focus:border-brand-400 focus:ring-brand-100 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2";

export function CreateLeadModal({
  sources,
  states,
  assignableUsers,
  canAssign,
  onClose,
  onCreated,
}: {
  sources: Option[];
  states: Option[];
  assignableUsers: Option[];
  canAssign: boolean;
  onClose: () => void;
  onCreated: (leadId: string) => void;
}) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [stateId, setStateId] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [interestedProduct, setInterestedProduct] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(allowDuplicate: boolean) {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/v1/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        phone,
        email: email || undefined,
        sourceId: sourceId || undefined,
        stateId: stateId || undefined,
        assignedUserId: assignedUserId || undefined,
        interestedProduct: interestedProduct || undefined,
        allowDuplicate,
      }),
    });
    const data = await res.json();
    setSubmitting(false);

    if (res.status === 409) {
      setDuplicate(data.existing);
      return;
    }
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    onCreated(data.lead.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]">
      <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold text-slate-900">New lead</h2>

        {duplicate ? (
          <div className="mt-4 space-y-3">
            <p className="rounded border border-brand-400/40 bg-brand-50 px-3 py-2.5 text-sm text-brand-900">
              A lead with this phone number already exists:{" "}
              <Link href={`/leads/${duplicate.id}`} className="font-medium underline">
                {duplicate.name} ({duplicate.leadCode})
              </Link>
              . Create a new lead anyway?
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setDuplicate(null)}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => submit(true)}
                disabled={submitting}
                className="rounded bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
              >
                {submitting ? "Creating…" : "Create anyway"}
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(false);
            }}
            className="mt-4 space-y-3"
          >
            <input
              required
              placeholder="Full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={inputClass}
            />
            <input
              required
              placeholder="Phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
            />
            <input
              type="email"
              placeholder="Email (optional)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
            />
            <input
              placeholder="Interested product (optional)"
              value={interestedProduct}
              onChange={(e) => setInterestedProduct(e.target.value)}
              className={inputClass}
            />
            <div className="grid grid-cols-2 gap-2">
              <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className={`${inputClass} bg-white`}>
                <option value="">Source</option>
                {sources.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select value={stateId} onChange={(e) => setStateId(e.target.value)} className={`${inputClass} bg-white`}>
                <option value="">State</option>
                {states.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            {canAssign && (
              <select
                value={assignedUserId}
                onChange={(e) => setAssignedUserId(e.target.value)}
                className={`${inputClass} bg-white`}
              >
                <option value="">Assign to me</option>
                {assignableUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            )}

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="rounded bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
              >
                {submitting ? "Creating…" : "Create lead"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
