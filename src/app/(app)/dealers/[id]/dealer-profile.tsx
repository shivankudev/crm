"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Sparkles,
  ArrowRightLeft,
  BadgeCheck,
  StickyNote,
  FileText,
  FileX,
  CalendarClock,
  CalendarCheck,
  CalendarX,
  ShoppingCart,
  type LucideIcon,
} from "lucide-react";
import { DealerStatusBadge } from "@/components/dealers/dealer-status-badge";
import { PhoneChip } from "@/components/ui/phone-chip";
import { Timeline } from "@/components/ui/timeline";
import { formatDate, formatDateTime } from "@/lib/format";

type Option = { id: string; name: string };

type Dealer = {
  id: string;
  dealerCode: string | null;
  dealerName: string;
  phone: string;
  altPhone: string | null;
  whatsapp: string | null;
  email: string | null;
  address: string | null;
  pincode: string | null;
  contactPerson: string | null;
  gstin: string | null;
  pan: string | null;
  existingBusiness: string | null;
  existingEvBrands: string | null;
  investmentCapacity: string | null;
  status: { id: string; name: string };
  state: { id: string; name: string } | null;
  createdByName: string;
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

type Note = { id: string; body: string; user: { id: string; name: string }; createdAt: string };

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

type DealerDocument = { id: string; docType: string; fileName: string; uploadedAt: string };

type OrderItem = { id: string; productName: string; quantity: number; unitPrice: number; lineTotal: number };
type Order = {
  id: string;
  orderCode: string;
  paymentStatus: string;
  deliveryStatus: string;
  totalAmount: number;
  orderDate: string;
  items: OrderItem[];
};
type ProductOption = { id: string; name: string; price: number };

const TABS = ["Info", "Timeline", "Documents", "Follow-ups", "Orders", "Notes"] as const;
type Tab = (typeof TABS)[number];

const ACTIVITY_LABELS: Record<string, string> = {
  CREATED: "Dealer created",
  STATUS_CHANGED: "Status changed",
  DEALER_CODE_ISSUED: "Dealer code issued",
  NOTE: "Note added",
  DOCUMENT_UPLOADED: "Document uploaded",
  DOCUMENT_DELETED: "Document deleted",
  FOLLOWUP_CREATED: "Follow-up scheduled",
  FOLLOWUP_COMPLETED: "Follow-up completed",
  FOLLOWUP_RESCHEDULED: "Follow-up rescheduled",
  FOLLOWUP_CANCELLED: "Follow-up cancelled",
  FOLLOWUP_AUTO_CANCELLED: "Follow-ups cancelled (dealer closed)",
  ORDER_CREATED: "Order placed",
  ORDER_STATUS_CHANGED: "Order status updated",
};

const currency = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 });

export function DealerProfile({
  dealer,
  activity,
  notes,
  followUps,
  documents,
  orders,
  products,
  statuses,
  states,
  results,
  docTypes,
  canManage,
  canApprove,
}: {
  dealer: Dealer;
  activity: Activity[];
  notes: Note[];
  followUps: FollowUp[];
  documents: DealerDocument[];
  orders: Order[];
  products: ProductOption[];
  statuses: Option[];
  states: Option[];
  results: Option[];
  docTypes: string[];
  canManage: boolean;
  canApprove: boolean;
}) {
  const [tab, setTab] = useState<Tab>("Info");
  const activeFollowUps = followUps.filter((f) => f.status === "PENDING" || f.status === "OVERDUE");

  return (
    <div className="mx-auto max-w-4xl">
      <DealerHeader
        dealer={dealer}
        statuses={statuses}
        canManage={canManage}
        canApprove={canApprove}
      />

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
              {t === "Follow-ups" && activeFollowUps.length > 0 ? ` (${activeFollowUps.length})` : ""}
              {t === "Documents" && documents.length > 0 ? ` (${documents.length})` : ""}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-4">
        {tab === "Info" && <InfoTab dealer={dealer} states={states} canManage={canManage} />}
        {tab === "Timeline" && <TimelineTab activity={activity} />}
        {tab === "Documents" && (
          <DocumentsTab dealerId={dealer.id} documents={documents} docTypes={docTypes} canManage={canManage} />
        )}
        {tab === "Follow-ups" && (
          <FollowUpsTab dealerId={dealer.id} followUps={followUps} results={results} canManage={canManage} />
        )}
        {tab === "Orders" && (
          <OrdersTab dealerId={dealer.id} orders={orders} products={products} canManage={canManage} />
        )}
        {tab === "Notes" && <NotesTab dealerId={dealer.id} notes={notes} />}
      </div>
    </div>
  );
}

function DealerHeader({
  dealer,
  statuses,
  canManage,
  canApprove,
}: {
  dealer: Dealer;
  statuses: Option[];
  canManage: boolean;
  canApprove: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [statusId, setStatusId] = useState(dealer.status.id);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submitStatus() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/v1/dealers/${dealer.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusId, note: note || undefined }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    setShowForm(false);
    router.refresh();
  }

  return (
    <div className="rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(10,11,16,0.04)] p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">{dealer.dealerName}</h1>
            <DealerStatusBadge name={dealer.status.name} />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-slate-500">
            <span>{dealer.dealerCode ?? "No dealer code yet"}</span>
            <span>·</span>
            <PhoneChip value={dealer.phone} />
            {dealer.contactPerson && <span>· {dealer.contactPerson}</span>}
          </p>
        </div>
        {(canManage || canApprove) && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Change status
          </button>
        )}
      </div>

      {showForm && (
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
              onClick={() => setShowForm(false)}
              className="rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              onClick={submitStatus}
              disabled={submitting}
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

function InfoTab({ dealer, states, canManage }: { dealer: Dealer; states: Option[]; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    dealerName: dealer.dealerName,
    contactPerson: dealer.contactPerson ?? "",
    phone: dealer.phone,
    email: dealer.email ?? "",
    address: dealer.address ?? "",
    gstin: dealer.gstin ?? "",
    pan: dealer.pan ?? "",
    existingBusiness: dealer.existingBusiness ?? "",
    existingEvBrands: dealer.existingEvBrands ?? "",
    investmentCapacity: dealer.investmentCapacity ?? "",
    stateId: dealer.state?.id ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/v1/dealers/${dealer.id}`, {
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

  if (editing) {
    return (
      <div className="space-y-3 rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(10,11,16,0.04)] p-5">
        <Field label="Dealer name">
          <input
            value={form.dealerName}
            onChange={(e) => setForm({ ...form, dealerName: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Contact person">
          <input
            value={form.contactPerson}
            onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="GSTIN">
            <input
              value={form.gstin}
              onChange={(e) => setForm({ ...form, gstin: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </Field>
          <Field label="PAN">
            <input
              value={form.pan}
              onChange={(e) => setForm({ ...form, pan: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </Field>
        </div>
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
        <Field label="Existing business">
          <input
            value={form.existingBusiness}
            onChange={(e) => setForm({ ...form, existingBusiness: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Existing EV brands">
          <input
            value={form.existingEvBrands}
            onChange={(e) => setForm({ ...form, existingEvBrands: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </Field>
        <Field label="Investment capacity">
          <input
            value={form.investmentCapacity}
            onChange={(e) => setForm({ ...form, investmentCapacity: e.target.value })}
            className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          />
        </Field>
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
    <div className="rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(10,11,16,0.04)] p-5">
      {canManage && (
        <div className="flex justify-end">
          <button onClick={() => setEditing(true)} className="text-sm font-medium text-slate-600 hover:text-slate-900">
            Edit
          </button>
        </div>
      )}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <Detail label="Phone" value={<PhoneChip value={dealer.phone} />} />
        <Detail label="Alt. phone" value={dealer.altPhone ? <PhoneChip value={dealer.altPhone} /> : null} />
        <Detail label="WhatsApp" value={dealer.whatsapp} />
        <Detail label="Email" value={dealer.email} />
        <Detail label="Address" value={dealer.address} />
        <Detail label="Pincode" value={dealer.pincode} />
        <Detail label="State" value={dealer.state?.name ?? null} />
        <Detail label="GSTIN" value={dealer.gstin} />
        <Detail label="PAN" value={dealer.pan} />
        <Detail label="Existing business" value={dealer.existingBusiness} />
        <Detail label="Existing EV brands" value={dealer.existingEvBrands} />
        <Detail label="Investment capacity" value={dealer.investmentCapacity} />
        <Detail label="Created by" value={dealer.createdByName} />
        <Detail label="Created" value={formatDateTime(dealer.createdAt)} />
      </dl>
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

const ACTIVITY_ICONS: Record<string, LucideIcon> = {
  CREATED: Sparkles,
  STATUS_CHANGED: ArrowRightLeft,
  DEALER_CODE_ISSUED: BadgeCheck,
  NOTE: StickyNote,
  DOCUMENT_UPLOADED: FileText,
  DOCUMENT_DELETED: FileX,
  FOLLOWUP_CREATED: CalendarClock,
  FOLLOWUP_COMPLETED: CalendarCheck,
  FOLLOWUP_RESCHEDULED: CalendarClock,
  FOLLOWUP_CANCELLED: CalendarX,
  FOLLOWUP_AUTO_CANCELLED: CalendarX,
  ORDER_CREATED: ShoppingCart,
  ORDER_STATUS_CHANGED: ShoppingCart,
};

function TimelineTab({ activity }: { activity: Activity[] }) {
  return <Timeline entries={activity} labels={ACTIVITY_LABELS} icons={ACTIVITY_ICONS} />;
}

function DocumentsTab({
  dealerId,
  documents,
  docTypes,
  canManage,
}: {
  dealerId: string;
  documents: DealerDocument[];
  docTypes: string[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [docType, setDocType] = useState(docTypes[0]);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setSubmitting(true);
    setError(null);

    const form = new FormData();
    form.set("docType", docType);
    form.set("file", file);

    const res = await fetch(`/api/v1/dealers/${dealerId}/documents`, { method: "POST", body: form });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Upload failed");
      return;
    }
    setFile(null);
    router.refresh();
  }

  async function remove(docId: string) {
    const res = await fetch(`/api/v1/dealer-documents/${docId}`, { method: "DELETE" });
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <form onSubmit={upload} className="space-y-2 rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(10,11,16,0.04)] p-4">
          <p className="text-sm font-medium text-slate-900">Upload a document</p>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {docTypes.map((t) => (
                <option key={t} value={t}>
                  {t.replaceAll("_", " ")}
                </option>
              ))}
            </select>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!file || submitting}
              className="rounded bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? "Uploading…" : "Upload"}
            </button>
          </div>
        </form>
      )}

      {documents.length === 0 ? (
        <p className="text-sm text-slate-400">No documents uploaded yet.</p>
      ) : (
        <ul className="space-y-2">
          {documents.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(10,11,16,0.04)] p-3 text-sm"
            >
              <div>
                <p className="font-medium text-slate-900">{d.docType.replaceAll("_", " ")}</p>
                <p className="text-xs text-slate-400">
                  {d.fileName} · {formatDate(d.uploadedAt)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={`/api/v1/dealer-documents/${d.id}`}
                  className="text-xs font-medium text-slate-600 hover:underline"
                >
                  Download
                </a>
                {canManage && (
                  <button onClick={() => remove(d.id)} className="text-xs font-medium text-red-600 hover:underline">
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const DELIVERY_STATUSES = ["DRAFT", "CONFIRMED", "PROCESSING", "DISPATCHED", "DELIVERED", "CANCELLED"] as const;
const PAYMENT_STATUSES = ["PENDING", "PARTIAL", "PAID", "REFUNDED"] as const;

function OrdersTab({
  dealerId,
  orders,
  products,
  canManage,
}: {
  dealerId: string;
  orders: Order[];
  products: ProductOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [showCreate, setShowCreate] = useState(false);
  const [items, setItems] = useState<{ productId: string; quantity: string; discount: string }[]>([
    { productId: products[0]?.id ?? "", quantity: "1", discount: "0" },
  ]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function updateItem(i: number, patch: Partial<(typeof items)[number]>) {
    setItems((rows) => rows.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function createOrder(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/v1/dealers/${dealerId}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        items: items.map((i) => ({
          productId: i.productId,
          quantity: Number(i.quantity),
          discount: Number(i.discount || 0),
        })),
      }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Something went wrong");
      return;
    }
    setShowCreate(false);
    setItems([{ productId: products[0]?.id ?? "", quantity: "1", discount: "0" }]);
    router.refresh();
  }

  if (products.length === 0 && canManage) {
    return <p className="text-sm text-slate-400">No products in the catalog yet — add some under Products first.</p>;
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div>
          {!showCreate ? (
            <button
              onClick={() => setShowCreate(true)}
              className="rounded-lg border border-slate-200 px-3.5 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              New order
            </button>
          ) : (
            <form onSubmit={createOrder} className="space-y-3 rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(10,11,16,0.04)] p-4">
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-[1fr_80px_100px] gap-2">
                  <select
                    value={item.productId}
                    onChange={(e) => updateItem(i, { productId: e.target.value })}
                    className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({currency.format(p.price)})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    placeholder="Qty"
                    value={item.quantity}
                    onChange={(e) => updateItem(i, { quantity: e.target.value })}
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                  <input
                    type="number"
                    min={0}
                    placeholder="Discount"
                    value={item.discount}
                    onChange={(e) => updateItem(i, { discount: e.target.value })}
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={() =>
                  setItems((rows) => [...rows, { productId: products[0]?.id ?? "", quantity: "1", discount: "0" }])
                }
                className="text-xs font-medium text-slate-600 hover:underline"
              >
                + Add another item
              </button>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
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
                  {submitting ? "Placing…" : "Place order"}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {orders.length === 0 ? (
        <p className="text-sm text-slate-400">No orders yet.</p>
      ) : (
        <ul className="space-y-2">
          {orders.map((o) => (
            <OrderRow key={o.id} order={o} canManage={canManage} />
          ))}
        </ul>
      )}
    </div>
  );
}

function OrderRow({ order, canManage }: { order: Order; canManage: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deliveryStatus, setDeliveryStatus] = useState(order.deliveryStatus);
  const [paymentStatus, setPaymentStatus] = useState(order.paymentStatus);
  const [submitting, setSubmitting] = useState(false);

  async function save() {
    setSubmitting(true);
    const res = await fetch(`/api/v1/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryStatus, paymentStatus }),
    });
    setSubmitting(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    }
  }

  return (
    <li className="rounded-lg border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(10,11,16,0.04)] p-3 text-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-slate-900">{order.orderCode}</p>
          <p className="text-xs text-slate-400">{formatDate(order.orderDate)}</p>
        </div>
        <p className="font-medium text-slate-900">{currency.format(order.totalAmount)}</p>
      </div>
      <ul className="mt-2 space-y-0.5 text-xs text-slate-500">
        {order.items.map((it) => (
          <li key={it.id}>
            {it.quantity} × {it.productName} — {currency.format(it.lineTotal)}
          </li>
        ))}
      </ul>

      {!editing ? (
        <div className="mt-2 flex items-center gap-2">
          <span className="chip chip-live">{order.deliveryStatus}</span>
          <span className="chip chip-mute">{order.paymentStatus}</span>
          {canManage && (
            <button onClick={() => setEditing(true)} className="ml-auto text-xs font-medium text-slate-600 hover:underline">
              Update
            </button>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={deliveryStatus}
              onChange={(e) => setDeliveryStatus(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {DELIVERY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <select
              value={paymentStatus}
              onChange={(e) => setPaymentStatus(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            >
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
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

function NotesTab({ dealerId, notes }: { dealerId: string; notes: Note[] }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const res = await fetch(`/api/v1/dealers/${dealerId}/notes`, {
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
  dealerId,
  followUps,
  results,
  canManage,
}: {
  dealerId: string;
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
    const res = await fetch(`/api/v1/dealers/${dealerId}/followups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledDate, scheduledTime, type: "DEALER_MEETING" }),
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
              <DealerFollowUpRow key={f.id} followUp={f} results={results} canManage={canManage} />
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

function DealerFollowUpRow({
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
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => setMode("idle")} className="rounded-md px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100">
              Cancel
            </button>
            <button
              disabled={!resultId || submitting}
              onClick={() => patch({ action: "complete", resultId, notes: notes || undefined, continueFollowUp: false })}
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
