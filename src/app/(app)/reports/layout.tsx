import { requireUser } from "@/lib/auth/current-user";
import { canAny } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";

/**
 * One permission gate for every page under /reports.
 *
 * The individual report pages only ever called requireUser(), so they were
 * reachable by URL for any signed-in account — hiding the sidebar entry is
 * not access control. A layout guard covers the whole segment at once,
 * including report pages added later, which is exactly the kind of thing a
 * per-page check gets forgotten on.
 */
export default async function ReportsLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const allowed = canAny(user, [
    PERMISSIONS.REPORTS_VIEW_ALL,
    PERMISSIONS.REPORTS_VIEW_TEAM,
    PERMISSIONS.REPORTS_VIEW_OWN,
  ]);

  if (!allowed) {
    return (
      <div className="border-chip-neg/25 bg-chip-neg/5 text-chip-neg rounded-lg border p-4 text-sm">
        You don&apos;t have permission to view this page.
      </div>
    );
  }

  return <>{children}</>;
}
