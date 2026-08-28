import {
  createUser as createUserRow,
  updateUser as updateUserRow,
  updateUserPassword,
  deleteUser as deleteUserRow,
  getUserActivityCounts,
  countUsersByRole,
  findUserById,
  listUsers as listUsersRows,
} from "@/repositories/user.repository";
import { findRoleById, findRoleByName } from "@/repositories/role.repository";
import { hashPassword } from "@/lib/auth/password";
import { purgeWhatsAppDataForUser } from "@/services/whatsapp.service";
import { invalidateAllUserSessions } from "@/lib/auth/session";
import { writeAuditLog } from "@/services/audit.service";
import { can, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS, ROLE_NAMES, isRoleBelow } from "@/lib/rbac/permissions";
import type { CurrentUser } from "@/lib/auth/current-user";
import type { CreateUserInput, UpdateUserInput } from "@/lib/validation/user";

export class UserServiceError extends Error {}

export function listUsers() {
  return listUsersRows();
}

/**
 * `USERS_MANAGE_ALL` (Super Admin) has no ceiling. `USERS_MANAGE_SCOPED`
 * (Admin) is bounded to roles strictly junior to the actor's own — "manage
 * users below own scope" per §3 of the architecture doc — so an Admin can
 * administer Sales Managers and Telecallers but never another Admin or a
 * Super Admin. Checked against both the target's CURRENT role and, on a
 * role change, the role being assigned TO them.
 */
function assertCanManageRole(actor: CurrentUser, roleName: string) {
  if (can(actor, PERMISSIONS.USERS_MANAGE_ALL)) return;
  if (!isRoleBelow(actor.role.name, roleName)) {
    throw new ForbiddenError(`Not allowed to manage a ${roleName.replaceAll("_", " ").toLowerCase()} account`);
  }
}

export async function createUser(input: CreateUserInput, actor: CurrentUser) {
  const role = await findRoleById(input.roleId);
  if (!role) throw new UserServiceError("Role not found");
  assertCanManageRole(actor, role.name);

  const passwordHash = await hashPassword(input.password);
  const user = await createUserRow({ ...input, passwordHash });

  await writeAuditLog({
    userId: actor.id,
    action: "USER_CREATED",
    entityType: "User",
    entityId: user.id,
    newValue: { email: user.email, roleId: user.roleId },
  });

  return user;
}

/**
 * Guards against removing the last active Super Admin's role or access —
 * otherwise the org could lock itself out of Users & Permissions entirely.
 */
async function assertNotLastSuperAdmin(userId: string) {
  const superAdminRole = await findRoleByName(ROLE_NAMES.SUPER_ADMIN);
  if (!superAdminRole) return;

  const target = await findUserById(userId);
  if (!target || target.roleId !== superAdminRole.id) return;

  const activeSuperAdmins = await countUsersByRole(superAdminRole.id);
  if (activeSuperAdmins <= 1) {
    throw new UserServiceError("Cannot remove the last active Super Admin");
  }
}

export async function updateUser(userId: string, input: UpdateUserInput, actor: CurrentUser) {
  const before = await findUserById(userId);
  if (!before) throw new UserServiceError("User not found");
  assertCanManageRole(actor, before.role.name);

  const isDemoting = input.roleId !== undefined && input.roleId !== before.roleId;
  const isDeactivating = input.active === false && before.active;

  if (isDemoting) {
    const targetRole = await findRoleById(input.roleId!);
    if (!targetRole) throw new UserServiceError("Role not found");
    assertCanManageRole(actor, targetRole.name); // can't hand out a role above the actor's own reach either
  }

  if (isDemoting || isDeactivating) {
    await assertNotLastSuperAdmin(userId);
  }

  const user = await updateUserRow(userId, input);

  if (isDemoting || isDeactivating) {
    // Force re-login so the new role/active state takes effect immediately.
    await invalidateAllUserSessions(userId);
  }

  await writeAuditLog({
    userId: actor.id,
    action: "USER_UPDATED",
    entityType: "User",
    entityId: user.id,
    previousValue: { roleId: before.roleId, active: before.active },
    newValue: { roleId: user.roleId, active: user.active },
  });

  return user;
}

/**
 * Admin-initiated password reset — there's no email/SMS delivery in this
 * deployment (mirrors how `createUser` takes an admin-set temporary
 * password), so the admin sets the new password directly and shares it
 * with the employee out of band. Every existing session is torn down so
 * the old password can't keep a device logged in.
 */
export async function resetUserPassword(userId: string, newPassword: string, actor: CurrentUser) {
  const target = await findUserById(userId);
  if (!target) throw new UserServiceError("User not found");
  assertCanManageRole(actor, target.role.name);

  const passwordHash = await hashPassword(newPassword);
  await updateUserPassword(userId, passwordHash);
  await invalidateAllUserSessions(userId);

  await writeAuditLog({
    userId: actor.id,
    action: "USER_PASSWORD_RESET",
    entityType: "User",
    entityId: userId,
  });
}

/**
 * Hard delete — only permitted for an account with zero footprint in the
 * business data (see getUserActivityCounts). Anyone who has actually
 * worked a lead, logged a call, or touched anything else in the system
 * must be deactivated instead: deleting them would either hit a foreign
 * key constraint or blow away records the business still needs.
 */
export async function deleteUser(userId: string, actor: CurrentUser) {
  if (userId === actor.id) {
    throw new UserServiceError("You can't delete your own account");
  }

  const target = await findUserById(userId);
  if (!target) throw new UserServiceError("User not found");
  assertCanManageRole(actor, target.role.name);

  await assertNotLastSuperAdmin(userId);

  const { total } = await getUserActivityCounts(userId);
  if (total > 0) {
    throw new UserServiceError(
      "This user has leads, calls, or other activity on record and can't be deleted — deactivate them instead."
    );
  }

  // Their WhatsApp session/templates are config, not record — clear them
  // (and unlink the device) so they don't block the delete with a raw FK
  // violation. Sent-message history is counted above and blocks instead.
  await purgeWhatsAppDataForUser(userId);

  await deleteUserRow(userId);

  await writeAuditLog({
    userId: actor.id,
    action: "USER_DELETED",
    entityType: "User",
    entityId: userId,
    previousValue: { name: target.name, email: target.email, roleId: target.roleId },
  });
}
