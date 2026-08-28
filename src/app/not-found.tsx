import Link from "next/link";
import { SearchX, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <div className="bg-brand-50 text-brand-500 flex h-14 w-14 items-center justify-center rounded-lg">
        <SearchX size={26} strokeWidth={1.75} />
      </div>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight text-slate-900">Page not found</h1>
      <p className="mt-1.5 max-w-sm text-sm text-slate-500">
        Whatever you were looking for doesn&apos;t exist, or you don&apos;t have access to it — the lead, dealer,
        or page may have moved.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 flex items-center gap-1.5 rounded bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
      >
        <ArrowLeft size={15} />
        Back to Dashboard
      </Link>
    </main>
  );
}
