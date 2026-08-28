"use client";

import { useState } from "react";
import Link from "next/link";

type Option = { id: string; name: string };
type DuplicateInfo = { id: string; dealerCode: string | null; dealerName: string; phone: string };

const inputClass =
  "focus:border-brand-400 focus:ring-brand-100 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:ring-2";

export function CreateDealerModal({
  states,
  onClose,
  onCreated,
}: {
  states: Option[];
  onClose: () => void;
  onCreated: (dealerId: string) => void;
}) {
  const [dealerName, setDealerName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [stateId, setStateId] = useState("");
  const [existingBusiness, setExistingBusiness] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [duplicate, setDuplicate] = useState<DuplicateInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(allowDuplicate: boolean) {
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/v1/dealers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dealerName,
        contactPerson: contactPerson || undefined,
        phone,
        email: email || undefined,
        stateId: stateId || undefined,
        existingBusiness: existingBusiness || undefined,
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
    onCreated(data.dealer.id);
  }

  return (
    <div className="motion-fade fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]">
      <div className="motion-pop w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h2 className="text-base font-semibold text-slate-900">New dealer</h2>

        {duplicate ? (
          <div className="mt-4 space-y-3">
            <p className="rounded border border-brand-400/40 bg-brand-50 px-3 py-2.5 text-sm text-brand-900">
              A dealer with this phone number already exists:{" "}
              <Link href={`/dealers/${duplicate.id}`} className="font-medium underline">
                {duplicate.dealerName} ({duplicate.dealerCode ?? "no code yet"})
              </Link>
              . Create a new dealer anyway?
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
              placeholder="Dealer / shop name"
              value={dealerName}
              onChange={(e) => setDealerName(e.target.value)}
              className={inputClass}
            />
            <input
              placeholder="Contact person"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
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
              placeholder="Existing business (optional)"
              value={existingBusiness}
              onChange={(e) => setExistingBusiness(e.target.value)}
              className={inputClass}
            />
            <select value={stateId} onChange={(e) => setStateId(e.target.value)} className={`${inputClass} bg-white`}>
              <option value="">State</option>
              {states.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>

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
                {submitting ? "Creating…" : "Create dealer"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
