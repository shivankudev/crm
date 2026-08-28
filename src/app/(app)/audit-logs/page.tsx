import { ScrollText } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { listAuditLogsForUser } from "@/services/audit.service";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDateTime } from "@/lib/format";

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const page = sp.page ? Number(sp.page) : 1;

  const { logs, total } = await listAuditLogsForUser(user, { entityType: sp.entityType, page, pageSize: 50 });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Audit Logs</h1>
      <p className="mt-1 text-sm text-slate-500">
        {total} entr{total === 1 ? "y" : "ies"}
      </p>

      <Card className="mt-6 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-white">
            <tr className="border-b border-slate-100 text-xs font-medium tracking-wide whitespace-nowrap text-slate-400 uppercase">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && (
              <tr>
                <td colSpan={4}>
                  <EmptyState icon={ScrollText} title="No audit entries yet" description="Every meaningful change in the CRM gets logged here." />
                </td>
              </tr>
            )}
            {logs.map((log) => (
              <tr key={log.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/60">
                <td className="px-4 py-3 text-slate-400">{formatDateTime(log.createdAt.toISOString())}</td>
                <td className="px-4 py-3 text-slate-700">{log.user?.name ?? "System"}</td>
                <td className="px-4 py-3">
                  <span className="bg-brand-50 text-brand-700 rounded-full px-2.5 py-0.5 text-xs font-medium">
                    {log.action.replaceAll("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500">
                  <span className="font-medium text-slate-700">{log.entityType}</span>{" "}
                  <span className="font-mono text-xs text-slate-400">{log.entityId.slice(0, 10)}…</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
