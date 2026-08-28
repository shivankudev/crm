import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listResultOptions, listFollowUpRules } from "@/repositories/lookup.repository";
import { listTemplateTargets } from "@/services/whatsapp.service";
import { WhatsAppTemplatesAdmin } from "@/components/settings/whatsapp-templates-admin";

export default async function WhatsAppTemplatesSettingsPage() {
  const user = await requireUser();

  if (!can(user, PERMISSIONS.SETTINGS_MANAGE) && !can(user, PERMISSIONS.SETTINGS_MANAGE_PARTIAL)) {
    return (
      <div className="border-chip-neg/25 bg-chip-neg/5 text-chip-neg rounded-lg border p-4 text-sm">
        You don&apos;t have permission to view this page.
      </div>
    );
  }

  const [targets, results, rules] = await Promise.all([
    listTemplateTargets(user),
    listResultOptions(),
    listFollowUpRules(),
  ]);

  // One slot per distinct lead-facing cadence step. A disabled rule still
  // gets a slot so a message written before it was switched off stays visible.
  const sequenceNumbers = Array.from(
    new Set(rules.filter((r) => r.appliesTo === "LEAD" || r.appliesTo === "BOTH").map((r) => r.sequenceNumber))
  ).sort((a, b) => a - b);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">WhatsApp messages</h1>
        <p className="mt-1 text-sm text-slate-500">
          The automated messages sent to leads. Set them here for every telecaller, or for one person at a time —
          telecallers can&apos;t change these themselves, they only link their own WhatsApp.
        </p>
      </div>

      <WhatsAppTemplatesAdmin
        targets={targets.map((t) => ({ id: t.id, name: t.name }))}
        resultNames={results.map((r) => r.name)}
        sequenceNumbers={sequenceNumbers}
      />
    </div>
  );
}
