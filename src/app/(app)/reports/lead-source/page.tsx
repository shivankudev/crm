import { requireUser } from "@/lib/auth/current-user";
import { getLeadSourceReport } from "@/services/reports.service";
import { BarList } from "@/components/reports/bar-list";

export default async function LeadSourceReportPage() {
  const user = await requireUser();
  const rows = await getLeadSourceReport(user);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Leads by Source</h1>
      <p className="mt-1 text-sm text-slate-500">Volume and won-count per acquisition source</p>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <BarList
          rows={rows.map((r) => ({ label: r.sourceName, value: r.count, secondaryValue: r.won }))}
          secondaryLabel="Won"
          totalLabel="All leads"
        />
      </div>
    </div>
  );
}
