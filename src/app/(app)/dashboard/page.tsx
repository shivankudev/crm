import Link from "next/link";
import { PhoneCall, AlarmClockOff, ArrowRight, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listLeadsForUser } from "@/services/lead.service";
import { listDealersForUser } from "@/services/dealer.service";
import { getTelecallerDailyStats, getOwnConnectRates } from "@/services/telecalling.service";
import { countLeadsPulledToday } from "@/services/lead-sheet.service";
import { StatCard, StatRail } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { WhatsAppWidget } from "@/components/whatsapp/whatsapp-widget";
import { WhatsAppDeliveryPanel } from "@/components/whatsapp/whatsapp-delivery-panel";

export default async function DashboardPage() {
  const user = await requireUser();
  const canCall = can(user, PERMISSIONS.LEADS_CALL_LOG);
  const canSeeDealers = can(user, PERMISSIONS.DEALERS_MANAGE) || can(user, PERMISSIONS.DEALERS_VIEW_FOLLOWUP);

  const [leads, dealers, calling, connectRates, pulledToday] = await Promise.all([
    listLeadsForUser(user, { page: 1, pageSize: 1 }),
    canSeeDealers ? listDealersForUser(user, { page: 1, pageSize: 1 }) : Promise.resolve({ total: 0 }),
    canCall ? getTelecallerDailyStats(user) : Promise.resolve(null),
    canCall ? getOwnConnectRates(user) : Promise.resolve(null),
    countLeadsPulledToday(user),
  ]);

  const hasWorkNow = calling ? calling.pending + calling.overdue > 0 : false;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Welcome back, {user.name.split(" ")[0]}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            <span className="chip chip-mute">{user.role.name.replaceAll("_", " ")}</span>
          </p>
        </div>
        {calling && (
          <Link
            href="/telecalling"
            className={
              hasWorkNow
                ? "flex items-center gap-2 rounded bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
                : "flex items-center gap-2 rounded border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            }
          >
            <PhoneCall size={15} strokeWidth={2.25} />
            {hasWorkNow ? "Start calling" : "Open telecalling"}
            <ArrowRight size={15} strokeWidth={2.25} />
          </Link>
        )}
      </div>

      {/* Today's calling — the scoreboard rail this whole direction is
          named after: a live figure per column, one hairline strip, no
          icon-square cards. This is the surface's first viewport thesis. */}
      {calling && (
        <div className="mt-6">
          <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Today&apos;s calling</p>
          <StatRail>
            <StatCard label="Due today" value={calling.dueToday} accent="brand" />
            <StatCard label="Connected" value={calling.connected} accent="pos" />
            <StatCard label="Not connected" value={calling.notConnected} accent="mute" />
            <StatCard label="Pending" value={calling.pending} accent="brand" href="/followups/today" />
            <StatCard
              label="Overdue"
              value={calling.overdue}
              accent={calling.overdue > 0 ? "neg" : "mute"}
              href="/followups/overdue"
            />
          </StatRail>

          {calling.overdue > 0 && (
            <Link
              href="/followups/overdue"
              className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-chip-neg/25 bg-chip-neg/5 px-4 py-3 text-sm transition hover:bg-chip-neg/10"
            >
              <span className="flex items-center gap-2.5 text-slate-700">
                <AlarmClockOff size={15} className="shrink-0 text-chip-neg" />
                <span>
                  <span className="font-semibold text-chip-neg">{calling.overdue} lead(s)</span> from earlier weren&apos;t
                  connected and are waiting on you — pick these up first.
                </span>
              </span>
              <ArrowRight size={15} className="shrink-0 text-slate-300" />
            </Link>
          )}

          {calling.overdue === 0 && calling.pending === 0 && calling.dueToday > 0 && (
            <div className="mt-3 flex items-center gap-2.5 rounded-lg border border-chip-pos/25 bg-chip-pos/5 px-4 py-3 text-sm text-slate-700">
              <Sparkles size={15} className="shrink-0 text-chip-pos" />
              All caught up — every lead due today has been called.
            </div>
          )}

          {/* A telecaller's only view of their own performance — they have no
              Reports access, so this stands in for it: their connect rate
              today and over the last 30 days, their numbers only. */}
          {connectRates && (
            <div className="mt-6">
              <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                Your connect rate
              </p>
              <StatRail className="max-w-md">
                <StatCard
                  label="Today"
                  value={connectRates.today.percent === null ? "—" : `${connectRates.today.percent}%`}
                  accent={connectRates.today.percent === null ? "mute" : "pos"}
                  hint={`${connectRates.today.connected} of ${connectRates.today.total} calls`}
                />
                <StatCard
                  label="Last 30 days"
                  value={connectRates.last30Days.percent === null ? "—" : `${connectRates.last30Days.percent}%`}
                  accent={connectRates.last30Days.percent === null ? "mute" : "pos"}
                  hint={`${connectRates.last30Days.connected} of ${connectRates.last30Days.total} calls`}
                />
              </StatRail>
            </div>
          )}

          <WhatsAppWidget />
          <WhatsAppDeliveryPanel />
        </div>
      )}

      <div className="mt-6">
        <p className="mb-2.5 text-[11px] font-semibold tracking-wide text-slate-500 uppercase">Overview</p>
        <StatRail className="max-w-md">
          <StatCard label="Leads in your view" value={leads.total} accent="brand" href="/leads" />
          {/* Scoped like every other figure here: an admin sees the day's
              whole intake, a telecaller only the rows dealt to them. */}
          <StatCard
            label="Pulled from sheets today"
            value={pulledToday}
            accent={pulledToday > 0 ? "pos" : "mute"}
            href="/leads"
          />
          {canSeeDealers && <StatCard label="Dealers in your view" value={dealers.total} accent="brand" href="/dealers" />}
        </StatRail>
      </div>

      {!calling && (
        <Card className="mt-6 p-6 text-sm text-slate-500">
          Use the sidebar to jump into Leads, Dealers, Reports, or Settings.
        </Card>
      )}
    </div>
  );
}
