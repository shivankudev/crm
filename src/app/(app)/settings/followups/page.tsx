import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listFollowUpRulesForSettings, listLeadStatusesForSettings } from "@/services/settings.service";
import { getSetting } from "@/repositories/lookup.repository";
import {
  DEFAULT_TELECALLER_ALLOWED_STATUSES,
  TELECALLER_ALLOWED_STATUSES_SETTING_KEY,
} from "@/lib/leads/constants";
import { FollowUpRulesEditor } from "@/components/settings/followup-rules-editor";
import { TelecallerStatusesEditor } from "@/components/settings/telecaller-statuses-editor";

export default async function FollowUpSettingsPage() {
  const user = await requireUser();
  if (!can(user, PERMISSIONS.SETTINGS_MANAGE) && !can(user, PERMISSIONS.SETTINGS_MANAGE_PARTIAL)) {
    redirect("/dashboard");
  }

  const [rules, statuses, allowedStatuses] = await Promise.all([
    listFollowUpRulesForSettings(user),
    listLeadStatusesForSettings(user),
    getSetting<string[]>(TELECALLER_ALLOWED_STATUSES_SETTING_KEY),
  ]);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Follow-up Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          The follow-up cadence (§6): sequence #1 fires when a lead/dealer first needs a follow-up;
          completing one with &quot;continue&quot; checked advances to the next sequence number.
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-900">Follow-up cadence rules</h2>
        <FollowUpRulesEditor rules={rules} />
      </section>

      <section>
        <h2 className="mb-1 text-sm font-medium text-slate-900">Telecaller-settable lead statuses</h2>
        <p className="mb-2 text-xs text-slate-500">
          Telecallers with the limited status-change permission may only move a lead into one of these
          statuses — everything past qualification needs a Sales Manager or Admin.
        </p>
        <TelecallerStatusesEditor
          allStatusNames={statuses.map((s) => s.name)}
          allowedStatusNames={allowedStatuses ?? DEFAULT_TELECALLER_ALLOWED_STATUSES}
        />
      </section>
    </div>
  );
}
