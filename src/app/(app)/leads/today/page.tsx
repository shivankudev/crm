import Link from "next/link";
import { ArrowRight, Table2, UserPen, Inbox } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getTodaysLeadIntake } from "@/services/lead.service";
import { Card } from "@/components/ui/card";
import { StatCard, StatRail } from "@/components/ui/stat-card";

/**
 * Where today's new leads came from.
 *
 * The dashboard figure answers "how many"; this answers "from where", and
 * every line goes on to the leads themselves — the useful question after
 * seeing a number is almost always "which ones?".
 */
export default async function LeadsTodayPage() {
  const user = await requireUser();
  const intake = await getTodaysLeadIntake(user);

  const sheetTotal = intake.fromSheets.reduce((n, s) => n + s.count, 0);
  const manualTotal = intake.manual.reduce((n, m) => n + m.count, 0);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">Leads added today</h1>
        <p className="mt-1 text-xs text-slate-500">
          Everything that arrived since midnight, and how it got here. Click any line to see those leads.
        </p>
      </div>

      <StatRail className="mb-5">
        <StatCard label="Added today" value={intake.total} accent="brand" size="sm" href="/leads?added=today" />
        <StatCard
          label="From sheets"
          value={sheetTotal}
          accent={sheetTotal > 0 ? "pos" : "mute"}
          size="sm"
          href="/leads?added=today&origin=sheet"
        />
        <StatCard
          label="Added by hand"
          value={manualTotal}
          accent={manualTotal > 0 ? "brand" : "mute"}
          size="sm"
          href="/leads?added=today&origin=manual"
        />
      </StatRail>

      {intake.total === 0 && (
        <Card className="flex items-center gap-2.5 p-4 text-xs text-slate-500">
          <Inbox size={15} className="shrink-0 text-slate-400" />
          No new leads yet today.
        </Card>
      )}

      {intake.fromSheets.length > 0 && (
        <Section
          icon={Table2}
          title="Pulled from Google Sheets"
          hint="Imported automatically, every five minutes."
          rows={intake.fromSheets.map((s) => ({
            key: s.id,
            label: s.name,
            count: s.count,
            href: `/leads?added=today&sheet=${s.id}`,
          }))}
        />
      )}

      {intake.manual.length > 0 && (
        <Section
          icon={UserPen}
          title="Added by hand"
          hint="Entered directly in the CRM, grouped by who added them."
          rows={intake.manual.map((m) => ({
            key: m.id,
            label: m.name,
            count: m.count,
            // origin=manual as well as the person: sheet imports run as a
            // Super Admin, so filtering on creator alone would fold those
            // rows back in and the list would not match the number above it.
            href: `/leads?added=today&origin=manual&by=${m.id}`,
          }))}
        />
      )}
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  hint,
  rows,
}: {
  icon: typeof Table2;
  title: string;
  hint: string;
  rows: { key: string; label: string; count: number; href: string }[];
}) {
  return (
    <div className="mb-5">
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
        <Icon size={11} /> {title}
      </p>
      <p className="mb-2 text-[11px] text-slate-400">{hint}</p>
      <Card className="divide-y divide-slate-100 p-0">
        {rows.map((r) => (
          <Link
            key={r.key}
            href={r.href}
            className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-slate-50"
          >
            <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800">{r.label}</span>
            <span className="tnum text-sm font-semibold text-slate-900">{r.count}</span>
            <ArrowRight size={13} className="shrink-0 text-slate-300" />
          </Link>
        ))}
      </Card>
    </div>
  );
}
