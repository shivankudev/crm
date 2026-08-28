import Link from "next/link";
import { requireUser } from "@/lib/auth/current-user";
import { getTeamCallingActivityReport, type CallBucket } from "@/services/reports.service";
import { StatCard, StatRail } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";

function connectRate(bucket: CallBucket) {
  return bucket.total > 0 ? Math.round((bucket.connected / bucket.total) * 100) : null;
}

function BucketCell({ bucket }: { bucket: CallBucket }) {
  if (bucket.total === 0) {
    return <span className="tnum text-sm text-slate-300">—</span>;
  }
  return (
    <div>
      <p className="tnum text-sm font-semibold text-slate-900">{bucket.total}</p>
      <p className="tnum text-xs text-slate-400">
        <span className="text-chip-pos">{bucket.connected} conn.</span>
        {" · "}
        <span className="text-slate-400">{bucket.notConnected} not</span>
        {bucket.callBack > 0 ? (
          <>
            {" · "}
            <span className="text-brand-600">{bucket.callBack} cb</span>
          </>
        ) : null}
      </p>
    </div>
  );
}

export default async function TeamCallingReportPage() {
  const user = await requireUser();
  const rows = await getTeamCallingActivityReport(user);

  const totalToday = rows.reduce((sum, r) => sum + r.today.total, 0);
  const connectedToday = rows.reduce((sum, r) => sum + r.today.connected, 0);
  const activeToday = rows.filter((r) => r.today.total > 0).length;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Team Calling Activity</h1>
      <p className="mt-1 text-sm text-slate-500">
        Per-telecaller call volume and connect rate — today, the last two days, and a 30-day window.
      </p>

      <StatRail className="mt-5">
        <StatCard label="Telecallers tracked" value={rows.length} accent="brand" />
        <StatCard label="Calls today" value={totalToday} accent="brand" />
        <StatCard
          label="Connected today"
          value={connectedToday}
          accent="pos"
          hint={totalToday > 0 ? `${Math.round((connectedToday / totalToday) * 100)}% connect rate` : undefined}
        />
        <StatCard label="Active on calls today" value={`${activeToday}/${rows.length}`} accent="brand" />
      </StatRail>

      <Card className="mt-5 overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-100 text-xs font-medium tracking-wide whitespace-nowrap text-slate-400 uppercase">
              <th className="px-4 py-3">Telecaller</th>
              <th className="px-4 py-3">Today</th>
              <th className="px-4 py-3">Yesterday</th>
              <th className="px-4 py-3">Day before</th>
              <th className="px-4 py-3">Last 30 days</th>
              <th className="px-4 py-3">30-day connect rate</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                  No telecallers in your view yet.
                </td>
              </tr>
            )}
            {rows.map((r) => {
              const rate30 = connectRate(r.last30Days);
              return (
                <tr key={r.userId} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/reports/telecaller-performance/${r.userId}`}
                      className="hover:text-brand-600 font-medium text-slate-900"
                    >
                      {r.userName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <BucketCell bucket={r.today} />
                  </td>
                  <td className="px-4 py-3">
                    <BucketCell bucket={r.yesterday} />
                  </td>
                  <td className="px-4 py-3">
                    <BucketCell bucket={r.dayBeforeYesterday} />
                  </td>
                  <td className="px-4 py-3">
                    <BucketCell bucket={r.last30Days} />
                  </td>
                  <td className="px-4 py-3">
                    {rate30 === null ? (
                      <span className="text-sm text-slate-300">—</span>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-brand-500/10">
                          <div
                            className={rate30 >= 50 ? "h-full rounded-full bg-chip-pos" : "h-full rounded-full bg-brand-500"}
                            style={{ width: `${rate30}%` }}
                          />
                        </div>
                        <span className="tnum text-xs text-slate-500">{rate30}%</span>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
