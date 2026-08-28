import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listQuickActionsForAdmin } from "@/services/whatsapp-quick-action.service";
import { QuickActionsEditor } from "@/components/settings/quick-actions-editor";

export default async function QuickActionsSettingsPage() {
  const user = await requireUser();

  if (!can(user, PERMISSIONS.SETTINGS_MANAGE) && !can(user, PERMISSIONS.SETTINGS_MANAGE_PARTIAL)) {
    return (
      <div className="border-chip-neg/25 bg-chip-neg/5 text-chip-neg rounded-lg border p-4 text-sm">
        You don&apos;t have permission to view this page.
      </div>
    );
  }

  const actions = await listQuickActionsForAdmin(user);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Quick send buttons</h1>
        <p className="mt-1 text-sm text-slate-500">
          One-press WhatsApp sends on the calling screen, so a telecaller can share photos, a brochure or the
          showroom location mid-call without picking up their own phone. Add as many as you need — each one can
          carry a message, several files, and a location pin.
        </p>
      </div>

      <QuickActionsEditor
        initialActions={actions.map((a) => ({
          id: a.id,
          label: a.label,
          text: a.text,
          enabled: a.enabled,
          latitude: a.latitude,
          longitude: a.longitude,
          locationName: a.locationName,
          media: a.media.map((m) => ({ id: m.id, fileName: m.fileName, mimeType: m.mimeType })),
        }))}
      />
    </div>
  );
}
