import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listDealerStatusesForSettings } from "@/services/settings.service";
import { StatusLookupEditor } from "@/components/settings/status-lookup-editor";

export default async function DealerSettingsPage() {
  const user = await requireUser();
  if (!can(user, PERMISSIONS.SETTINGS_MANAGE) && !can(user, PERMISSIONS.SETTINGS_MANAGE_PARTIAL)) {
    redirect("/dashboard");
  }

  const statuses = await listDealerStatusesForSettings(user);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dealer Settings</h1>
        <p className="mt-1 text-sm text-slate-500">
          Dealer onboarding statuses — names are fixed once created (AGREEMENT triggers dealer-code
          issuance, APPROVED requires the approval permission).
        </p>
      </div>

      <section>
        <h2 className="mb-2 text-sm font-medium text-slate-900">Dealer statuses</h2>
        <StatusLookupEditor apiBase="/api/v1/settings/dealer-statuses" rows={statuses} showTerminal={false} />
      </section>
    </div>
  );
}
