"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw, ArrowLeft } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Server-side console only — keeps the failure visible in logs without
    // leaking a raw stack trace onto the page itself.
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-chip-neg/10 text-chip-neg">
        <AlertTriangle size={26} strokeWidth={1.75} />
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">Something went wrong</h1>
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
    </main>
  );
}
