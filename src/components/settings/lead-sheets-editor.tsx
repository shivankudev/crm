"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Check,
  RefreshCw,
  AlertTriangle,
  Lock,
  Globe,
  Users,
  Loader2,
  Copy,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/format";

type Sheet = {
  id: string;
  name: string;
  enabled: boolean;
  accessMode: string;
  spreadsheetId: string | null;
  sheetName: string | null;
  csvUrl: string | null;
  sourceId: string | null;
  lastRowImported: number;
  lastPolledAt: string | null;
  lastError: string | null;
  totalImported: number;
  assigneeIds: string[];
};
type Caller = { id: string; name: string; email: string };
type Source = { id: string; name: string };

const inputClass =
  "focus:border-brand-400 focus:ring-brand-100 w-full rounded-lg border border-slate-200 px-3 py-2 text-xs outline-none focus:ring-2";

export function LeadSheetsEditor({
  initialSheets,
  callers,
  sources,
  serviceAccountEmail,
}: {
  initialSheets: Sheet[];
  callers: Caller[];
  sources: Source[];
  serviceAccountEmail: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<"SERVICE_ACCOUNT" | "PUBLISHED_CSV">("SERVICE_ACCOUNT");
  const [creating, setCreating] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      const res = await fetch("/api/v1/settings/lead-sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, accessMode: mode }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't add that sheet");
        return;
      }
      setName("");
      router.refresh();
    } catch {
      toast.error("Couldn't reach the server — check your connection.");
    } finally {
      setCreating(false);
    }
  }

  const live = initialSheets.filter((s) => s.enabled).length;

  return (
    <div className="space-y-4">
      {initialSheets.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-slate-500">
          <span className="font-medium text-slate-700">
            {initialSheets.length} {initialSheets.length === 1 ? "sheet" : "sheets"}
          </span>
          <span aria-hidden>·</span>
          <span className="bg-chip-pos/10 text-chip-pos inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium">
            {live} pulling automatically
          </span>
        </div>
      )}

      {initialSheets.length === 0 && (
        <Card className="p-4 text-xs text-slate-500">
          No sheets linked yet. Add one below, point it at a Google Sheet, choose who works it, then switch it
          on.
        </Card>
      )}

      {initialSheets.map((s) => (
        <SheetCard
          key={s.id}
          sheet={s}
          callers={callers}
          sources={sources}
          serviceAccountEmail={serviceAccountEmail}
        />
      ))}

      <form onSubmit={create} className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New sheet name — e.g. Facebook Ads (Swati)"
          className={`${inputClass} min-w-0 flex-1`}
        />
        <select
          value={mode}
          onChange={(e) => setMode(e.target.value as typeof mode)}
          className={`${inputClass} w-auto shrink-0`}
        >
          <option value="SERVICE_ACCOUNT">Private sheet</option>
          <option value="PUBLISHED_CSV">Link-shared sheet</option>
        </select>
        <Button type="submit" variant="primary" size="sm" icon={Plus} disabled={creating || !name.trim()}>
          Add
        </Button>
      </form>
    </div>
  );
}

function SheetCard({
  sheet,
  callers,
  sources,
  serviceAccountEmail,
}: {
  sheet: Sheet;
  callers: Caller[];
  sources: Source[];
  serviceAccountEmail: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState(sheet.name);
  const [enabled, setEnabled] = useState(sheet.enabled);
  const [accessMode, setAccessMode] = useState(sheet.accessMode);
  const [spreadsheetId, setSpreadsheetId] = useState(sheet.spreadsheetId ?? "");
  const [sheetName, setSheetName] = useState(sheet.sheetName ?? "");
  const [csvUrl, setCsvUrl] = useState(sheet.csvUrl ?? "");
  const [sourceId, setSourceId] = useState(sheet.sourceId ?? "");
  const [assigneeIds, setAssigneeIds] = useState<string[]>(sheet.assigneeIds);
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const mark = () => setDirty(true);
  const isPrivate = accessMode === "SERVICE_ACCOUNT";

  function toggleAssignee(id: string) {
    setAssigneeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
    mark();
  }

  async function request(url: string, init: RequestInit, fallback: string) {
    setBusy(true);
    try {
      const res = await fetch(url, init);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? fallback);
        return null;
      }
      return data as Record<string, unknown>;
    } catch {
      toast.error("Couldn't reach the server — check your connection.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    const ok = await request(
      `/api/v1/settings/lead-sheets/${sheet.id}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          enabled,
          accessMode,
          spreadsheetId: isPrivate ? spreadsheetId : null,
          sheetName: isPrivate ? sheetName : null,
          csvUrl: isPrivate ? null : csvUrl,
          sourceId: sourceId || null,
          assigneeIds,
        }),
      },
      "Couldn't save that"
    );
    if (!ok) return;
    setDirty(false);
    toast.success(`"${name}" saved.`);
    router.refresh();
  }

  async function syncNow() {
    setSyncing(true);
    try {
      const res = await fetch(`/api/v1/settings/lead-sheets/${sheet.id}/sync`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Sync failed");
        return;
      }
      if (data.error) toast.error(data.error);
      else if (data.created > 0)
        toast.success(
          `${data.created} lead${data.created === 1 ? "" : "s"} added${data.skippedDuplicate ? `, ${data.skippedDuplicate} already existed` : ""}.`
        );
      else toast.success("No new rows to bring in.");
      router.refresh();
    } catch {
      toast.error("Couldn't reach the server — check your connection.");
    } finally {
      setSyncing(false);
    }
  }

  async function remove() {
    const ok = await request(`/api/v1/settings/lead-sheets/${sheet.id}`, { method: "DELETE" }, "Couldn't delete");
    if (!ok) return;
    toast.success(`"${sheet.name}" removed.`);
    router.refresh();
  }

  const chosen = callers.filter((c) => assigneeIds.includes(c.id));

  return (
    <Card className={dirty ? "border-brand-200 bg-brand-50/30 p-4" : "p-4"}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            mark();
          }}
          aria-label="Sheet name"
          className={`${inputClass} min-w-0 flex-1 basis-[calc(100%-1rem)] font-medium sm:max-w-[16rem] sm:basis-auto`}
        />
        <span
          className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
            enabled ? "bg-chip-pos/10 text-chip-pos" : "bg-slate-100 text-slate-500"
          }`}
        >
          {enabled ? "Pulling automatically" : "Paused"}
        </span>
        <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-slate-500">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              mark();
            }}
            className="accent-brand-600"
          />
          On
        </label>
        <button
          onClick={() => setConfirmDelete(true)}
          disabled={busy}
          className="hover:text-chip-neg ml-auto shrink-0 text-[11px] font-medium text-slate-400"
        >
          <Trash2 size={12} className="inline" /> Remove
        </button>
      </div>

      {confirmDelete && (
        <div className="border-chip-neg/25 bg-chip-neg/5 mt-3 flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
          <AlertTriangle size={13} className="text-chip-neg shrink-0" />
          <p className="text-chip-neg min-w-0 flex-1 text-[11px]">
            Stop pulling from <strong>{sheet.name}</strong>? Leads already imported are kept.
          </p>
          <button
            onClick={() => setConfirmDelete(false)}
            className="rounded px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-white"
          >
            Cancel
          </button>
          <button
            onClick={remove}
            disabled={busy}
            className="bg-chip-neg rounded px-2.5 py-1 text-[11px] font-medium text-white transition hover:brightness-110 disabled:opacity-60"
          >
            Remove
          </button>
        </div>
      )}

      {sheet.lastError && (
        <p className="mt-3 flex items-start gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
          <AlertTriangle size={12} className="mt-px shrink-0" />
          <span>
            <strong>Last check failed:</strong> {sheet.lastError}
          </span>
        </p>
      )}

      {/* How the CRM reaches the sheet. The privacy difference is stated on
          the control itself — publishing a sheet exposes customer names and
          phone numbers to anyone with the link. */}
      <div className="mt-3">
        <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">How to read it</p>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { key: "SERVICE_ACCOUNT", icon: Lock, label: "Private sheet", hint: "shared with the service account" },
              { key: "PUBLISHED_CSV", icon: Globe, label: "Link-shared sheet", hint: "no setup — anyone with the link can read it" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.key}
              onClick={() => {
                setAccessMode(opt.key);
                mark();
              }}
              className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition ${
                accessMode === opt.key
                  ? "border-brand-500 bg-brand-600 text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <opt.icon size={12} />
              {opt.label}
              <span className={accessMode === opt.key ? "opacity-75" : "text-slate-400"}>· {opt.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {isPrivate ? (
        <div className="mt-3 space-y-2">
          <input
            value={spreadsheetId}
            onChange={(e) => {
              setSpreadsheetId(e.target.value);
              mark();
            }}
            placeholder="Paste the Google Sheet link"
            aria-label="Google Sheet link"
            className={`${inputClass} bg-white`}
          />
          <input
            value={sheetName}
            onChange={(e) => {
              setSheetName(e.target.value);
              mark();
            }}
            placeholder="Tab name (optional — blank reads the first tab)"
            aria-label="Tab name"
            className={`${inputClass} bg-white`}
          />
          {serviceAccountEmail ? (
            <p className="flex flex-wrap items-center gap-1.5 rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              Share the sheet as <strong>Viewer</strong> with
              <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[10px]">{serviceAccountEmail}</code>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(serviceAccountEmail).then(
                    () => toast.success("Address copied."),
                    () => toast.error("Couldn't copy — select it by hand.")
                  );
                }}
                className="hover:text-brand-600 text-slate-400"
                aria-label="Copy service account address"
              >
                <Copy size={11} />
              </button>
            </p>
          ) : (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
              No Google service account is configured on this server yet, so a private sheet can&apos;t be read.
              Set <code className="font-mono">GOOGLE_SERVICE_ACCOUNT_JSON</code> (see MIGRATION_GUIDE.md), or use
              a published link instead.
            </p>
          )}
        </div>
      ) : (
        <div className="mt-3 space-y-2">
          <input
            value={csvUrl}
            onChange={(e) => {
              setCsvUrl(e.target.value);
              mark();
            }}
            placeholder="Paste the sheet link from your browser"
            aria-label="Google Sheet link"
            className={`${inputClass} bg-white`}
          />
          <p className="rounded-lg bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
            Paste the normal link from the sheet&apos;s address bar — no publishing needed. In the sheet, set{" "}
            <strong>Share → General access → Anyone with the link → Viewer</strong>. The tab you had open is the
            one that gets read.
          </p>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-[11px] text-amber-800">
            A link-shared sheet can be read by anyone who has that link, without signing in — including the
            customer names and phone numbers in it. Prefer a private sheet for real lead data.
          </p>
        </div>
      )}

      {/* Who works the sheet. Order of selection is the order rows are dealt out. */}
      <div className="mt-3">
        <p className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
          <Users size={11} /> Telecallers who work this sheet
        </p>
        <div className="flex flex-wrap gap-1.5">
          {callers.map((c) => {
            const on = assigneeIds.includes(c.id);
            return (
              <button
                key={c.id}
                onClick={() => toggleAssignee(c.id)}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                  on
                    ? "border-brand-500 bg-brand-600 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {c.name}
              </button>
            );
          })}
          {callers.length === 0 && <span className="text-[11px] text-slate-400">No active telecallers yet.</span>}
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">
          {chosen.length === 0
            ? "Pick at least one — the sheet can't be switched on until someone works it."
            : chosen.length === 1
              ? `Every lead from this sheet goes to ${chosen[0].name}.`
              : `Rows are dealt out in turn between ${chosen.map((c) => c.name).join(", ")}.`}
        </p>
      </div>

      <div className="mt-3">
        <p className="mb-1.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
          Stamp these leads as
        </p>
        <select
          value={sourceId}
          onChange={(e) => {
            setSourceId(e.target.value);
            mark();
          }}
          aria-label="Lead source"
          className={`${inputClass} bg-white`}
        >
          <option value="">No source</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <p className="min-w-0 flex-1 text-[11px] text-slate-400">
          {sheet.lastPolledAt ? `Last checked ${formatDateTime(sheet.lastPolledAt)}` : "Not checked yet"} ·{" "}
          {sheet.totalImported} imported so far · read to row {sheet.lastRowImported}
        </p>
        <Button size="sm" icon={syncing ? Loader2 : RefreshCw} onClick={syncNow} disabled={syncing || dirty}>
          {syncing ? "Checking…" : "Sync now"}
        </Button>
        <Button
          size="sm"
          variant={dirty ? "primary" : "secondary"}
          icon={Check}
          onClick={save}
          disabled={busy || !dirty}
        >
          {busy ? "Saving…" : dirty ? "Save" : "Saved"}
        </Button>
      </div>
    </Card>
  );
}
