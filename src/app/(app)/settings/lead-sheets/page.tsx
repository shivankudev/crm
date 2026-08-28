import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listLeadSheetsForAdmin } from "@/services/lead-sheet.service";
import { getServiceAccountEmail } from "@/lib/google-sheets";
import { listCallersForSheets, listSourcesForSheets } from "@/services/lead-sheet-options";
import { LeadSheetsEditor } from "@/components/settings/lead-sheets-editor";

export default async function LeadSheetsSettingsPage() {
  const user = await requireUser();

  if (!can(user, PERMISSIONS.SETTINGS_MANAGE) && !can(user, PERMISSIONS.SETTINGS_MANAGE_PARTIAL)) {
    return (
      <div className="border-chip-neg/25 bg-chip-neg/5 text-chip-neg rounded-lg border p-4 text-sm">
        You don&apos;t have permission to view this page.
      </div>
    );
  }

  const [sheets, callers, sources] = await Promise.all([
    listLeadSheetsForAdmin(user),
    listCallersForSheets(),
    listSourcesForSheets(),
  ]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-lg font-semibold tracking-tight text-slate-900">Google Sheet lead sources</h1>
        <p className="mt-1 text-xs text-slate-500">
          New rows in a linked sheet become leads automatically, checked every ten minutes and again whenever
          this PC starts up. Each sheet goes to the telecaller (or telecallers) who work it — with more than
          one, rows are dealt out between them in turn. Only admins can set this up.
        </p>
      </div>

      <LeadSheetsEditor
        initialSheets={sheets.map((s) => ({
          id: s.id,
          name: s.name,
          enabled: s.enabled,
          accessMode: s.accessMode,
          spreadsheetId: s.spreadsheetId,
          sheetName: s.sheetName,
          csvUrl: s.csvUrl,
          sourceId: s.sourceId,
          lastRowImported: s.lastRowImported,
          lastPolledAt: s.lastPolledAt?.toISOString() ?? null,
          lastError: s.lastError,
          totalImported: s.totalImported,
          assigneeIds: s.assignees.map((a) => a.userId),
        }))}
        callers={callers}
        sources={sources}
        serviceAccountEmail={getServiceAccountEmail()}
      />
    </div>
  );
}
