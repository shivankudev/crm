import { requireUser } from "@/lib/auth/current-user";
import { getGeographyReport } from "@/services/reports.service";
import { BarList } from "@/components/reports/bar-list";

export default async function GeographyReportPage() {
  const user = await requireUser();
  const rows = await getGeographyReport(user);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Leads by Geography</h1>
      <p className="mt-1 text-sm text-slate-500">Lead volume by state</p>

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <BarList rows={rows.map((r) => ({ label: r.stateName, value: r.count }))} />
      </div>
    </div>
  );
}
