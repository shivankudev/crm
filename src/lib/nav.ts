import { PERMISSIONS, type PermissionKey } from "@/lib/rbac/permissions";

// Keys into the icon map in components/layout/sidebar.tsx. Kept as plain
// strings (not component references) because this module is imported from
// a Server Component (app layout) — React component values can't cross
// the server→client boundary as props, only pre-rendered JSX can.
export type NavIconKey =
  | "dashboard"
  | "leads"
  | "telecalling"
  | "followups"
  | "overdue"
  | "pipeline"
  | "dealers"
  | "onboarding"
  | "visits"
  | "products"
  | "orders"
  | "reports"
  | "import"
  | "export"
  | "settings"
  | "users"
  | "audit"
  | "whatsapp";

export type NavItem = {
  label: string;
  href: string;
  icon: NavIconKey;
  /** Any one of these grants visibility (OR, not AND). Omit to show to everyone. */
  permissions?: PermissionKey[];
  available: boolean; // false = planned for a later phase, shown greyed out
  /** true = temporarily hidden from the sidebar by user preference (route/page/data untouched). */
  hidden?: boolean;
};

export type NavSection = {
  label: string;
  items: NavItem[];
};

/** Mirrors the route map in 01-architecture.md §7, grouped for the sidebar. */
export const NAV_SECTIONS: NavSection[] = [
  {
    label: "Overview",
    items: [{ label: "Dashboard", href: "/dashboard", icon: "dashboard", available: true }],
  },
  {
    label: "Sales",
    items: [
      { label: "Leads", href: "/leads", icon: "leads", available: true },
      { label: "Telecalling", href: "/telecalling", icon: "telecalling", available: true },
      { label: "Follow-ups", href: "/followups/today", icon: "followups", available: true },
      { label: "Overdue Follow-ups", href: "/followups/overdue", icon: "overdue", available: true },
      { label: "Pipeline", href: "/pipeline", icon: "pipeline", available: true, hidden: true },
      {
        label: "WhatsApp",
        href: "/whatsapp",
        icon: "whatsapp",
        permissions: [PERMISSIONS.LEADS_CALL_LOG],
        available: true,
      },
    ],
  },
  {
    label: "Dealers & Operations",
    items: [
      {
        label: "Dealers",
        href: "/dealers",
        icon: "dealers",
        permissions: [PERMISSIONS.DEALERS_MANAGE, PERMISSIONS.DEALERS_VIEW_FOLLOWUP],
        available: true,
        hidden: true,
      },
      {
        label: "Dealer Onboarding",
        href: "/dealers/onboarding",
        icon: "onboarding",
        permissions: [PERMISSIONS.DEALERS_MANAGE, PERMISSIONS.DEALERS_VIEW_FOLLOWUP],
        available: true,
        hidden: true,
      },
      {
        label: "Factory Visits",
        href: "/factory-visits",
        icon: "visits",
        permissions: [PERMISSIONS.FACTORY_VISITS_MANAGE, PERMISSIONS.FACTORY_VISITS_CREATE],
        available: true,
        hidden: true,
      },
      {
        label: "Products",
        href: "/products",
        icon: "products",
        permissions: [
          PERMISSIONS.SETTINGS_MANAGE,
          PERMISSIONS.SETTINGS_MANAGE_PARTIAL,
          PERMISSIONS.DEALERS_MANAGE,
          PERMISSIONS.DEALERS_VIEW_FOLLOWUP,
        ],
        available: true,
        hidden: true,
      },
      {
        label: "Orders",
        href: "/orders",
        icon: "orders",
        permissions: [PERMISSIONS.DEALERS_MANAGE, PERMISSIONS.DEALERS_VIEW_FOLLOWUP],
        available: true,
        hidden: true,
      },
    ],
  },
  {
    label: "Insights",
    items: [
      {
        label: "Reports",
        href: "/reports",
        icon: "reports",
        permissions: [PERMISSIONS.REPORTS_VIEW_ALL, PERMISSIONS.REPORTS_VIEW_TEAM, PERMISSIONS.REPORTS_VIEW_OWN],
        available: true,
      },
      {
        label: "Import",
        href: "/import",
        icon: "import",
        permissions: [PERMISSIONS.IMPORT_EXPORT],
        available: true,
      },
      {
        label: "Export",
        href: "/export",
        icon: "export",
        permissions: [PERMISSIONS.IMPORT_EXPORT],
        available: true,
      },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        label: "Settings",
        href: "/settings",
        icon: "settings",
        permissions: [
          PERMISSIONS.SETTINGS_MANAGE,
          PERMISSIONS.SETTINGS_MANAGE_PARTIAL,
          PERMISSIONS.USERS_MANAGE_SCOPED,
        ],
        available: true,
      },
      {
        label: "Users & Permissions",
        href: "/settings/users",
        icon: "users",
        permissions: [PERMISSIONS.USERS_MANAGE_SCOPED],
        available: true,
      },
      {
        label: "Audit Logs",
        href: "/audit-logs",
        icon: "audit",
        permissions: [PERMISSIONS.AUDIT_LOGS_VIEW_ALL, PERMISSIONS.AUDIT_LOGS_VIEW_READONLY],
        available: true,
      },
    ],
  },
];

/** Flattened for anything that just needs the full item list (e.g. permission filtering helpers). */
export const NAV_ITEMS: NavItem[] = NAV_SECTIONS.flatMap((s) => s.items);
