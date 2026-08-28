import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { NAV_SECTIONS } from "@/lib/nav";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const sections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) => !item.hidden && (!item.permissions || item.permissions.some((p) => can(user, p)))
    ),
  })).filter((section) => section.items.length > 0);

  return (
    <AppShell
      sections={sections}
      name={user.name}
      role={user.role.name}
      canCall={can(user, PERMISSIONS.LEADS_CALL_LOG)}
    >
      {children}
    </AppShell>
  );
}
