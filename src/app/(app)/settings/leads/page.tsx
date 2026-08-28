import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import {
  listLeadStatusesForSettings,
  listLeadSourcesForSettings,
  listResultOptionsForSettings,
  listLostReasonsForSettings,
} from "@/services/settings.service";
import { StatusLookupEditor } from "@/components/settings/status-lookup-editor";
import { SimpleLookupEditor } from "@/components/settings/simple-lookup-editor";

export default async function LeadSettingsPage() {
  const user = await requireUser();
  if (!can(user, PERMISSIONS.SETTINGS_MANAGE) && !can(user, PERMISSIONS.SETTINGS_MANAGE_PARTIAL)) {
    redirect("/dashboard");
  }

  const [statuses, sources, results, lostReasons] = await Promise.all([
    listLeadStatusesForSettings(user),
    listLeadSourcesForSettings(user),
    listResultOptionsForSettings(user),
    listLostReasonsForSettings(user),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Lead Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Lead statuses drive the pipeline lifecycle — names are fixed once created since the app matches
          specific ones (WON, LOST, …) by name; you can still reorder, add new ones, and deactivate.
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-900">Lead statuses</h2>
        <StatusLookupEditor
          apiBase="/api/v1/settings/lead-statuses"
          rows={statuses}
          showTerminal
        />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-900">Lead sources</h2>
        <SimpleLookupEditor apiBase="/api/v1/settings/lead-sources" rows={sources} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-900">Call/follow-up result options</h2>
        <SimpleLookupEditor apiBase="/api/v1/settings/result-options" rows={results} />
      </section>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-900">Lost reasons</h2>
        <SimpleLookupEditor apiBase="/api/v1/settings/lost-reasons" rows={lostReasons} />
      </section>
    </div>
  );
}
