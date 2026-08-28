"use client";

import { useState } from "react";
import { UploadCloud, CheckCircle2, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";

type PreviewRow = {
  rowNumber: number;
  name: string;
  phone: string;
  email?: string;
  interestedProduct?: string;
  temperature?: string;
  priority?: string;
  sourceId?: string;
  sourceName?: string;
  stateId?: string;
  stateName?: string;
  statusId?: string;
  statusName?: string;
  errors: string[];
  duplicateOf?: { id: string; leadCode: string; name: string } | null;
};

type CommitResult = {
  created: number;
  skippedDuplicate: number;
  failed: number;
  failures: { row: { name: string; phone: string }; error: string }[];
};

export function ImportLeadsWizard() {
  const [rows, setRows] = useState<PreviewRow[] | null>(null);
  const [truncated, setTruncated] = useState(false);
  const [allowDuplicates, setAllowDuplicates] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CommitResult | null>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setError(null);
    setResult(null);
    const form = new FormData();
    form.set("file", file);
    const res = await fetch("/api/v1/import/leads/preview", { method: "POST", body: form });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Failed to parse the file");
      return;
    }
    setRows(data.rows);
    setTruncated(data.truncated);
  }

  async function commit() {
    if (!rows) return;
    const importable = rows.filter((r) => r.errors.length === 0 && (allowDuplicates || !r.duplicateOf));
    if (importable.length === 0) {
      setError("Nothing to import — fix the errors above or allow duplicates.");
      return;
    }

    setLoading(true);
    setError(null);
    const res = await fetch("/api/v1/import/leads/commit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        rows: importable.map((r) => ({
          name: r.name,
          phone: r.phone,
          email: r.email,
          interestedProduct: r.interestedProduct,
          temperature: r.temperature,
          priority: r.priority,
          sourceId: r.sourceId,
          stateId: r.stateId,
          statusId: r.statusId,
          allowDuplicate: allowDuplicates,
        })),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Import failed");
      return;
    }
    setResult(data);
    setRows(null);
  }

  const validCount = rows?.filter((r) => r.errors.length === 0).length ?? 0;
  const duplicateCount = rows?.filter((r) => r.errors.length === 0 && r.duplicateOf).length ?? 0;
  const errorCount = rows?.filter((r) => r.errors.length > 0).length ?? 0;

  if (result) {
    return (
      <Card className="p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-chip-pos/10 text-chip-pos">
            <CheckCircle2 size={17} strokeWidth={2.25} />
          </div>
          <p className="font-medium text-slate-900">Import complete</p>
        </div>
        <p className="tnum mt-3 text-sm text-slate-600">
          <span className="font-medium text-chip-pos">{result.created} created</span> ·{" "}
          <span className="text-brand-600">{result.skippedDuplicate} skipped as duplicates</span> ·{" "}
          <span className="text-chip-neg">{result.failed} failed</span>
        </p>
        {result.failures.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs text-red-600">
            {result.failures.map((f, i) => (
              <li key={i}>
                {f.row.name} ({f.row.phone}): {f.error}
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={() => {
            setResult(null);
            setRows(null);
          }}
          className="mt-4 flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
        >
          <RotateCcw size={13} />
          Import another file
        </button>
      </Card>
    );
  }

  if (!rows) {
    return (
      <label className="hover:border-brand-300 hover:bg-brand-50/30 block cursor-pointer rounded-lg border-2 border-dashed border-slate-200 bg-white p-10 text-center transition">
        <input
          type="file"
          accept=".csv,text/csv"
          disabled={loading}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
          className="hidden"
        />
        <UploadCloud size={28} className="mx-auto text-slate-300" strokeWidth={1.75} />
        <p className="mt-3 text-sm font-medium text-slate-700">Click to choose a CSV file</p>
        <p className="mt-1 text-xs text-slate-400">or drag it here</p>
        {loading && <p className="mt-3 text-sm text-slate-500">Parsing…</p>}
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </label>
    );
  }

  return (
    <div>
      <Card className="mb-3 flex items-center justify-between p-4 text-sm">
        <div>
          <span className="font-medium text-slate-900">{rows.length} row(s) parsed</span>
          {/* Mutually exclusive so these three sum to the row count above —
              "valid" here means "clean and not a duplicate", not just
              "no errors" (validCount, used below for the import-button
              math, still means the latter). */}
          <span className="ml-3 text-chip-pos">{validCount - duplicateCount} valid</span>
          <span className="ml-3 text-brand-700">{duplicateCount} duplicate</span>
          <span className="ml-3 text-chip-neg">{errorCount} error</span>
          {truncated && <span className="ml-3 text-slate-400">(file truncated to 2,000 rows)</span>}
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={allowDuplicates}
            onChange={(e) => setAllowDuplicates(e.target.checked)}
            className="accent-brand-600"
          />
          Import duplicates anyway
        </label>
      </Card>

      <Card className="max-h-96 overflow-y-auto">
        <table className="w-full text-left text-xs">
          <thead className="sticky top-0 bg-slate-50">
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="px-3 py-2">Row</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Phone</th>
              <th className="px-3 py-2">Source</th>
              <th className="px-3 py-2">State</th>
              <th className="px-3 py-2">Stage</th>
              <th className="px-3 py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.rowNumber} className="border-b border-slate-50 last:border-0">
                <td className="px-3 py-1.5 text-slate-400">{r.rowNumber}</td>
                <td className="px-3 py-1.5 text-slate-800">{r.name || "—"}</td>
                <td className="px-3 py-1.5 text-slate-600">{r.phone || "—"}</td>
                <td className="px-3 py-1.5 text-slate-600">{r.sourceName ?? "—"}</td>
                <td className="px-3 py-1.5 text-slate-600">{r.stateName ?? "—"}</td>
                <td className="px-3 py-1.5 text-slate-600">{r.statusName ?? "NEW (default)"}</td>
                <td className="px-3 py-1.5">
                  {r.errors.length > 0 ? (
                    <span className="text-chip-neg">{r.errors.join("; ")}</span>
                  ) : r.duplicateOf ? (
                    <span className="text-brand-700">Duplicate of {r.duplicateOf.leadCode}</span>
                  ) : (
                    <span className="text-chip-pos">Ready</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={() => setRows(null)}
          className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
        <button
          onClick={commit}
          disabled={loading}
          className="rounded bg-brand-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Importing…" : `Import ${validCount - (allowDuplicates ? 0 : duplicateCount)} lead(s)`}
        </button>
      </div>
    </div>
  );
}
