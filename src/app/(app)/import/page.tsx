import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";
import { listLeadStatuses } from "@/repositories/lookup.repository";
import { ImportLeadsWizard } from "@/app/(app)/import/import-leads-wizard";
import { Card } from "@/components/ui/card";

const CODE = "rounded bg-slate-100 px-1 font-mono text-xs";

export default async function ImportPage() {
  const user = await requireUser();
  if (!can(user, PERMISSIONS.IMPORT_EXPORT)) redirect("/dashboard");

  const statuses = await listLeadStatuses();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Import Leads</h1>
      <p className="mt-1 text-sm text-slate-500">
        Upload a CSV with columns: <code className={CODE}>name</code>, <code className={CODE}>phone</code>{" "}
        (required), plus optional <code className={CODE}>email</code>, <code className={CODE}>source</code>,{" "}
        <code className={CODE}>state</code>, <code className={CODE}>interestedProduct</code>,{" "}
        <code className={CODE}>temperature</code>, <code className={CODE}>priority</code>, and{" "}
        <code className={CODE}>status</code> (or <code className={CODE}>stage</code>). Up to 2,000 rows per file.
      </p>

      <Card className="mt-4 p-4">
        <p className="text-sm font-medium text-slate-900">Bringing leads over from a spreadsheet?</p>
        <p className="mt-1 text-sm text-slate-500">
          Export it as CSV, then rename your columns to match the ones above — a <code className={CODE}>status</code>{" "}
          (or <code className={CODE}>stage</code>) column carries over each lead&apos;s current pipeline stage
          instead of dropping every imported lead at NEW. The value in that column has to match one of these
          stage names exactly (not case-sensitive — spaces and dashes are treated the same as underscores):
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {statuses.map((s) => (
            <code key={s.id} className={CODE}>
              {s.name}
            </code>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Any row whose stage doesn&apos;t match one of these exactly will show as an error in the preview below
          and won&apos;t import until you either fix it in the sheet or leave the column blank (blank defaults to
          NEW). Rows past the pipeline&apos;s closing stages — WON, LOST, and similar — import fine too; they just
          won&apos;t get a follow-up scheduled, since those leads are already closed.
        </p>
      </Card>

      <div className="mt-6">
        <ImportLeadsWizard />
      </div>
    </div>
  );
}
