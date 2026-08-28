"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react";

/**
 * Same treatment as the root error.tsx, but scoped inside the (app) route
 * group — the sidebar/topbar in (app)/layout.tsx stay mounted and usable
 * above this boundary, so a page-level error doesn't strand the user with
 * no navigation.
 */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-chip-neg/10 text-chip-neg">
        <AlertTriangle size={26} strokeWidth={1.75} />
      </div>
      <h1 className="mt-5 text-xl font-semibold tracking-tight text-slate-900">Something went wrong</h1>
      <p className="mt-1.5 max-w-sm text-sm text-slate-500">
        This page hit an unexpected error. Try again, or head back to the dashboard — it&apos;s already been
        logged.
      </p>
      <div className="mt-6 flex items-center gap-2">
        <button
          onClick={reset}
          className="flex items-center gap-1.5 rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
        >
          <RotateCcw size={15} />
          Try again
        </button>
        <Link
          href="/dashboard"
          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
        >
          <ArrowLeft size={15} />
          Dashboard
        </Link>
      </div>
    </div>
  );
}
