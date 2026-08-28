import { notFound } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getTelecallerPerformanceDetail, TelecallerNotFoundError } from "@/services/reports.service";
import { ForbiddenError } from "@/lib/rbac/can";
import { StatCard, StatRail } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { DateRangePicker } from "@/components/reports/date-range-picker";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Parses a `YYYY-MM-DD` search param as a UTC midnight Date, falling back when absent/invalid. */
function parseDateParam(value: string | undefined, fallback: Date): Date {
  if (!value) return fallback;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export default async function TelecallerPerformanceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const { userId } = await params;
  const sp = await searchParams;

  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setDate(defaultFrom.getDate() - 29); // last 30 days, inclusive of today

  const from = parseDateParam(sp.from, defaultFrom);
  const to = parseDateParam(sp.to, today);

  let detail;
  try {
    detail = await getTelecallerPerformanceDetail(user, userId, { from, to });
  } catch (error) {
    if (error instanceof TelecallerNotFoundError) notFound();
    if (error instanceof ForbiddenError) notFound();
    throw error;
  }

  const winRate = detail.leadsAssigned > 0 ? Math.round((detail.leadsWon / detail.leadsAssigned) * 100) : null;
  const connectRate = detail.calls.total > 0 ? Math.round((detail.calls.connected / detail.calls.total) * 100) : null;

  return (
    <div className="mx-auto max-w-4xl">
      <Link
        href="/reports/telecaller-performance"
        className="hover:text-brand-600 inline-flex items-center gap-1.5 text-sm text-slate-500"
      >
        <ArrowLeft size={14} />
        Telecaller Performance
      </Link>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-slate-900">
            <span className="bg-brand-50 text-brand-600 flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold">
              {detail.userName.slice(0, 2).toUpperCase()}
            </span>
            {detail.userName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {isoDate(from)} to {isoDate(to)}
          </p>
        </div>
        <DateRangePicker from={isoDate(from)} to={isoDate(to)} />
      </div>

      <StatRail className="mt-5">
        <StatCard label="Leads assigned" value={detail.leadsAssigned} accent="brand" />
        <StatCard label="Calls logged" value={detail.callsLogged} accent="brand" />
        <StatCard label="Follow-ups completed" value={detail.followUpsCompleted} accent="brand" />
        <StatCard
          label="Leads won"
          value={detail.leadsWon}
          accent="pos"
          hint={winRate !== null ? `${winRate}% win rate` : undefined}
        />
      </StatRail>

      <Card className="mt-5 p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <TrendingUp size={15} className="text-slate-400" />
          Call outcomes in this range
        </h2>
        {detail.calls.total === 0 ? (
          <p className="mt-3 text-sm text-slate-400">No calls logged in this range.</p>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div className="flex h-full gap-0.5">
                  {[
                    { value: detail.calls.connected, className: "bg-chip-pos" },
                    { value: detail.calls.callBack, className: "bg-brand-500" },
                    { value: detail.calls.notConnected, className: "bg-slate-300" },
                  ]
                    .filter((seg) => seg.value > 0)
                    .map((seg, i) => (
                      <div
                        key={i}
                        className={clsx("h-full first:rounded-l-full last:rounded-r-full", seg.className)}
                        style={{ width: `${(seg.value / detail.calls.total) * 100}%` }}
                      />
                    ))}
                </div>
              </div>
              <span className="tnum text-xs font-medium text-slate-500">{connectRate}% connected</span>
            </div>
            <div className="grid grid-cols-4 gap-3 text-sm">
              <div>
                <p className="tnum font-semibold text-slate-900">{detail.calls.total}</p>
                <p className="text-xs text-slate-400">Total calls</p>
              </div>
              <div>
                <p className="tnum font-semibold text-chip-pos">{detail.calls.connected}</p>
                <p className="text-xs text-slate-400">Connected</p>
              </div>
              <div>
                <p className="tnum font-semibold text-brand-600">{detail.calls.callBack}</p>
                <p className="text-xs text-slate-400">Call back</p>
              </div>
              <div>
                <p className="tnum font-semibold text-slate-500">{detail.calls.notConnected}</p>
                <p className="text-xs text-slate-400">Not connected</p>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
