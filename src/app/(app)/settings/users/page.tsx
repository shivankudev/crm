import { requireUser } from "@/lib/auth/current-user";
import { can, canAny } from "@/lib/rbac/can";
import { PERMISSIONS, isRoleBelow } from "@/lib/rbac/permissions";
import { listUsers } from "@/services/user.service";
import { listRoles } from "@/repositories/role.repository";
import { UsersTable } from "@/app/(app)/settings/users/users-table";

export default async function UsersSettingsPage() {
  const user = await requireUser();

  if (!canAny(user, [PERMISSIONS.USERS_MANAGE_ALL, PERMISSIONS.USERS_MANAGE_SCOPED])) {
    return (
      <div className="rounded-lg border border-chip-neg/25 bg-chip-neg/5 p-4 text-sm text-chip-neg">
        You don&apos;t have permission to view this page.
      </div>
    );
  }

  const [users, roles] = await Promise.all([listUsers(), listRoles()]);
  const canManageAll = can(user, PERMISSIONS.USERS_MANAGE_ALL);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Users &amp; Permissions</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage who has access and what role they hold. Roles determine permissions —
          see Settings for the full matrix.
        </p>
      </div>

      <UsersTable
        currentUserId={user.id}
        canManageAll={canManageAll}
        currentUserRoleName={user.role.name}
        initialUsers={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          phone: u.phone,
          active: u.active,
          roleId: u.roleId,
          roleName: u.role.name,
          teamName: u.team?.name ?? null,
          // Mirrors assertCanManageRole() in user.service.ts — an Admin
          // (USERS_MANAGE_SCOPED) can only act on roles strictly junior to
          // their own; this just keeps the UI from offering an action the
          // API will reject anyway.
          canManage: canManageAll || isRoleBelow(user.role.name, u.role.name),
        }))}
        roles={roles.map((r) => ({ id: r.id, name: r.name }))}
      />
    </div>
  );
}
