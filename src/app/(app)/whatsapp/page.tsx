import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { WhatsAppWidget } from "@/components/whatsapp/whatsapp-widget";

/**
 * A telecaller's WhatsApp page is now connection-only.
 *
 * The message templates moved to Settings -> WhatsApp messages, where an
 * admin sets them centrally: the business controls what goes out under its
 * name, and a telecaller's job here is just to link their own device.
 */
export default async function WhatsAppPage() {
  const user = await requireUser();

  if (!can(user, PERMISSIONS.LEADS_CALL_LOG)) {
    return (
      <div className="border-chip-neg/25 bg-chip-neg/5 text-chip-neg rounded-lg border p-4 text-sm">
        You don&apos;t have permission to view this page.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">WhatsApp</h1>
        <p className="mt-1 text-sm text-slate-500">
          Link your WhatsApp so your leads get their follow-up messages automatically. Scan once — it stays
          connected. The messages themselves are set by your admin.
        </p>
      </div>

      <WhatsAppWidget />
    </div>
  );
}
