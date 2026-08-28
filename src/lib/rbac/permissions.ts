/**
 * Permission keys, one per row/nuance of the Role & Permission Matrix in
 * 01-architecture.md §3. These are seeded as `Permission` rows and wired
 * to roles via `RolePermission` — the matrix lives in the database, not
 * in code, so Super Admin can adjust it from Settings without a deploy.
 * This file only fixes the *vocabulary* of keys the app checks against.
 */
export const PERMISSIONS = {
  USERS_MANAGE_ALL: "users.manage_all", // create/edit any user, assign any role
  USERS_MANAGE_SCOPED: "users.manage_scoped", // Admin: manage below own scope

  LEADS_VIEW_ALL: "leads.view_all",
  LEADS_VIEW_TEAM: "leads.view_team",
  LEADS_VIEW_ASSIGNED: "leads.view_assigned",
  LEADS_ASSIGN: "leads.assign",
  LEADS_CALL_LOG: "leads.call_log",
  LEADS_FOLLOWUPS_MANAGE: "leads.followups_manage",
  LEADS_STATUS_CHANGE_ALL: "leads.status_change_all",
  LEADS_STATUS_CHANGE_LIMITED: "leads.status_change_limited",

  DEALERS_MANAGE: "dealers.manage",
  DEALERS_VIEW_FOLLOWUP: "dealers.view_followup",
  DEALERS_APPROVE_ONBOARDING: "dealers.approve_onboarding",

  FACTORY_VISITS_MANAGE: "factory_visits.manage",
  FACTORY_VISITS_CREATE: "factory_visits.create",

  REPORTS_VIEW_ALL: "reports.view_all",
  REPORTS_VIEW_TEAM: "reports.view_team",
  REPORTS_VIEW_OWN: "reports.view_own",

  IMPORT_EXPORT: "import_export.use",

  SETTINGS_MANAGE: "settings.manage",
  SETTINGS_MANAGE_PARTIAL: "settings.manage_partial",

  AUDIT_LOGS_VIEW_ALL: "audit_logs.view_all",
  AUDIT_LOGS_VIEW_READONLY: "audit_logs.view_readonly",
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  [PERMISSIONS.USERS_MANAGE_ALL]: "Manage all users, roles & permissions",
  [PERMISSIONS.USERS_MANAGE_SCOPED]: "Manage users below own scope",
  [PERMISSIONS.LEADS_VIEW_ALL]: "View all leads",
  [PERMISSIONS.LEADS_VIEW_TEAM]: "View team's leads",
  [PERMISSIONS.LEADS_VIEW_ASSIGNED]: "View own assigned leads",
  [PERMISSIONS.LEADS_ASSIGN]: "Assign / reassign leads",
  [PERMISSIONS.LEADS_CALL_LOG]: "Log calls, activity & notes",
  [PERMISSIONS.LEADS_FOLLOWUPS_MANAGE]: "Create / complete follow-ups",
  [PERMISSIONS.LEADS_STATUS_CHANGE_ALL]: "Change lead status (any)",
  [PERMISSIONS.LEADS_STATUS_CHANGE_LIMITED]: "Change lead status (limited set)",
  [PERMISSIONS.DEALERS_MANAGE]: "Manage dealers",
  [PERMISSIONS.DEALERS_VIEW_FOLLOWUP]: "View dealers & log follow-ups",
  [PERMISSIONS.DEALERS_APPROVE_ONBOARDING]: "Approve dealer onboarding stage",
  [PERMISSIONS.FACTORY_VISITS_MANAGE]: "Schedule / complete factory visits",
  [PERMISSIONS.FACTORY_VISITS_CREATE]: "Create factory visits",
  [PERMISSIONS.REPORTS_VIEW_ALL]: "View all reports",
  [PERMISSIONS.REPORTS_VIEW_TEAM]: "View team reports",
  [PERMISSIONS.REPORTS_VIEW_OWN]: "View own performance stats",
  [PERMISSIONS.IMPORT_EXPORT]: "Import / export data",
  [PERMISSIONS.SETTINGS_MANAGE]: "Manage all settings",
  [PERMISSIONS.SETTINGS_MANAGE_PARTIAL]: "Manage some settings",
  [PERMISSIONS.AUDIT_LOGS_VIEW_ALL]: "View audit logs",
  [PERMISSIONS.AUDIT_LOGS_VIEW_READONLY]: "View audit logs (read-only)",
};

export const ROLE_NAMES = {
  SUPER_ADMIN: "SUPER_ADMIN",
  ADMIN: "ADMIN",
  SALES_MANAGER: "SALES_MANAGER",
  TELECALLER: "TELECALLER",
} as const;

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];

/**
 * Seniority order, lowest number = most senior. This is what
 * `USERS_MANAGE_SCOPED` ("Admin: manage below own scope") actually
 * bounds: an Admin may manage Sales Managers and Telecallers, never
 * another Admin or a Super Admin. Unknown/legacy role names sort last
 * (treated as junior to everyone) rather than crashing a rank lookup.
 */
const ROLE_RANK: Record<RoleName, number> = {
  SUPER_ADMIN: 0,
  ADMIN: 1,
  SALES_MANAGER: 2,
  TELECALLER: 3,
};

export function roleRank(roleName: string): number {
  return ROLE_RANK[roleName as RoleName] ?? Number.MAX_SAFE_INTEGER;
}

/** True when `targetRoleName` is strictly junior to `actorRoleName` — i.e. "below own scope". */
export function isRoleBelow(actorRoleName: string, targetRoleName: string): boolean {
  return roleRank(targetRoleName) > roleRank(actorRoleName);
}

/** Source of truth for seeding — mirrors 01-architecture.md §3 exactly. */
export const ROLE_PERMISSION_MATRIX: Record<RoleName, PermissionKey[]> = {
  SUPER_ADMIN: Object.values(PERMISSIONS),
  ADMIN: [
    PERMISSIONS.USERS_MANAGE_SCOPED,
    PERMISSIONS.LEADS_VIEW_ALL,
    PERMISSIONS.LEADS_ASSIGN,
    PERMISSIONS.LEADS_CALL_LOG,
    PERMISSIONS.LEADS_FOLLOWUPS_MANAGE,
    PERMISSIONS.LEADS_STATUS_CHANGE_ALL,
    PERMISSIONS.DEALERS_MANAGE,
    PERMISSIONS.DEALERS_APPROVE_ONBOARDING,
    PERMISSIONS.FACTORY_VISITS_MANAGE,
    PERMISSIONS.REPORTS_VIEW_ALL,
    PERMISSIONS.IMPORT_EXPORT, // "if granted" — on by default, Admin can be scoped down per-role in Settings
    PERMISSIONS.SETTINGS_MANAGE_PARTIAL,
    PERMISSIONS.AUDIT_LOGS_VIEW_READONLY,
  ],
  SALES_MANAGER: [
    PERMISSIONS.LEADS_VIEW_TEAM,
    PERMISSIONS.LEADS_ASSIGN,
    PERMISSIONS.LEADS_CALL_LOG,
    PERMISSIONS.LEADS_FOLLOWUPS_MANAGE,
    PERMISSIONS.LEADS_STATUS_CHANGE_ALL,
    PERMISSIONS.DEALERS_VIEW_FOLLOWUP,
    PERMISSIONS.FACTORY_VISITS_MANAGE,
    PERMISSIONS.REPORTS_VIEW_TEAM,
  ],
  TELECALLER: [
    PERMISSIONS.LEADS_VIEW_ASSIGNED,
    PERMISSIONS.LEADS_CALL_LOG,
    PERMISSIONS.LEADS_FOLLOWUPS_MANAGE,
    PERMISSIONS.LEADS_STATUS_CHANGE_LIMITED,
    PERMISSIONS.FACTORY_VISITS_CREATE,
    // Deliberately NO reports access. A telecaller's own performance is
    // surfaced on their dashboard instead (getOwnConnectRates) — today's and
    // the last 30 days' connect rate, their numbers only. Granting
    // REPORTS_VIEW_OWN would put the whole Reports section in their sidebar,
    // which is more than they should be looking at.
  ],
};
