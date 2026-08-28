import Link from "next/link";
import { Users2, MapPin, TrendingUp, PhoneCall } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { getOverviewReport } from "@/services/reports.service";

const SUB_REPORTS = [
  { href: "/reports/team-calling", label: "Team calling activity", icon: PhoneCall },
  { href: "/reports/telecaller-performance", label: "Telecaller performance", icon: TrendingUp },
  { href: "/reports/lead-source", label: "Lead source", icon: Users2 },
  { href: "/reports/geography", label: "Geography", icon: MapPin },
];

export default async function ReportsPage() {
  const user = await requireUser();
  // Only the headline count is shown here now — the funnel / outcome /
  // temperature breakdowns were removed as unused.
  const { funnel } = await getOverviewReport(user);

  const totalLeads = funnel.reduce((sum, f) => sum + f.count, 0);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Reports</h1>
      <p className="mt-1 text-sm text-slate-500">{totalLeads} lead(s) in your view</p>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SUB_REPORTS.map((r) => (
          <Link
            key={r.href}
            href={r.href}
            className="group flex items-center gap-2.5 rounded-lg border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(10,11,16,0.04)] transition hover:border-slate-300 hover:shadow-[0_4px_12px_rgba(10,11,16,0.06)]"
          >
            <div className="bg-brand-50 text-brand-600 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
              <r.icon size={17} strokeWidth={2.25} />
            </div>
            <span className="group-hover:text-brand-700 text-sm font-medium text-slate-700">{r.label}</span>
          </Link>
        ))}
      </div>

    </div>
  );
}
