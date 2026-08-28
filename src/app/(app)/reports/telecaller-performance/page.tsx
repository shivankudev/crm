import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { getTelecallerPerformanceReport } from "@/services/reports.service";
import { Card } from "@/components/ui/card";

export default async function TelecallerPerformancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const rows = await getTelecallerPerformanceReport(user, {
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to) : undefined,
  });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Telecaller Performance</h1>
      <p className="mt-1 text-sm text-slate-500">
        Leads assigned, calls logged, follow-ups completed, and deals won — click a name to open its own date range.
      </p>

      <Card className="mt-5 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-medium tracking-wide whitespace-nowrap text-slate-400 uppercase">
              <th className="px-4 py-3">Telecaller</th>
              <th className="px-4 py-3">Leads assigned</th>
              <th className="px-4 py-3">Calls logged</th>
              <th className="px-4 py-3">Follow-ups completed</th>
              <th className="px-4 py-3">Won</th>
              <th className="px-4 py-3">Win rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No activity yet.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.userId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <Link
                    href={`/reports/telecaller-performance/${r.userId}`}
                    className="hover:text-brand-600 flex items-center gap-2.5 font-medium text-slate-900"
                  >
                    <span className="bg-brand-50 text-brand-600 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold">
                      {r.userName.slice(0, 2).toUpperCase()}
                    </span>
                    {r.userName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-slate-600">{r.leadsAssigned}</td>
                <td className="px-4 py-3 text-slate-600">{r.callsLogged}</td>
                <td className="px-4 py-3 text-slate-600">{r.followUpsCompleted}</td>
                <td className="px-4 py-3 text-slate-600">{r.leadsWon}</td>
                <td className="px-4 py-3 text-slate-600">
                  {r.leadsAssigned > 0 ? `${Math.round((r.leadsWon / r.leadsAssigned) * 100)}%` : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
