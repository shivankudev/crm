"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Zap,
  X,
  ChevronsLeft,
  ChevronsRight,
  LayoutDashboard,
  Users2,
  PhoneCall,
  ListChecks,
  AlarmClockOff,
  Kanban,
  Building2,
  ClipboardCheck,
  Car,
  Package,
  ShoppingCart,
  BarChart3,
  Upload,
  Download,
  Settings as SettingsIcon,
  ShieldCheck,
  ScrollText,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";
import type { NavIconKey, NavSection } from "@/lib/nav";

// Icon *components* live here (a Client Component) rather than in the nav
// data module (imported by the Server Component layout) — function/
// component references can't cross the server→client prop boundary,
// only the string keys in NavItem.icon can.
const ICONS: Record<NavIconKey, LucideIcon> = {
  dashboard: LayoutDashboard,
  leads: Users2,
  telecalling: PhoneCall,
  followups: ListChecks,
  overdue: AlarmClockOff,
  pipeline: Kanban,
  dealers: Building2,
  onboarding: ClipboardCheck,
  visits: Car,
  products: Package,
  orders: ShoppingCart,
  reports: BarChart3,
  import: Upload,
  export: Download,
  settings: SettingsIcon,
  users: ShieldCheck,
  audit: ScrollText,
  whatsapp: MessageCircle,
};

export function Sidebar({
  sections,
  open,
  onClose,
  collapsed,
  onToggleCollapsed,
}: {
  sections: NavSection[];
  /** Whether the mobile drawer is open — ignored at md+ where the sidebar is always visible. */
  open: boolean;
  onClose: () => void;
  /** Desktop-only icon-rail mode — ignored below md, where the drawer is always full width. */
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const pathname = usePathname();

  /**
   * The nav entry that best matches the current URL.
   *
   * A plain prefix test lit up every ancestor: /settings/users matched both
   * "Users & Permissions" and "Settings", so two rows appeared selected at
   * once. Prefix matching still has to stay, though — /leads/<id> has no nav
   * entry of its own and should keep "Leads" lit — so the rule is the
   * LONGEST matching href wins, and only that one.
   */
  const activeHref = useMemo(() => {
    const matches = sections
      .flatMap((s) => s.items.map((i) => i.href))
      .filter((href) => pathname === href || pathname.startsWith(`${href}/`));
    return matches.sort((a, b) => b.length - a.length)[0] ?? null;
  }, [pathname, sections]);

  // Close the mobile drawer automatically whenever navigation happens —
  // covers every nav Link without wiring an onClick on each one.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <>
      {/* Backdrop — mobile only, only rendered while the drawer is open */}
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-[1px] md:hidden"
          aria-hidden="true"
        />
      )}

      <nav
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex h-full shrink-0 -translate-x-full flex-col border-r border-slate-200 bg-white transition-[transform,width] duration-200 ease-out md:relative md:z-auto md:translate-x-0",
          open && "translate-x-0",
          collapsed ? "w-64 md:w-[68px]" : "w-64"
        )}
      >
        <div className={clsx("flex items-center gap-2.5 px-5 py-5", collapsed && "md:justify-center md:px-0")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white shadow-sm">
            <Zap size={17} strokeWidth={2.25} fill="currentColor" />
          </div>
          <div className={clsx("flex-1", collapsed && "md:hidden")}>
            <p className="text-sm leading-tight font-semibold whitespace-nowrap text-slate-900">Gatti E-Rickshaw</p>
            <p className="text-xs leading-tight text-slate-400">CRM</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-x-hidden overflow-y-auto px-3 pb-4">
          {sections.map((section) => (
            <div key={section.label}>
              <p
                className={clsx(
                  "mb-1 px-3 text-[11px] font-semibold tracking-wide text-slate-400 uppercase",
                  collapsed && "md:hidden"
                )}
              >
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = item.href === activeHref;
                  const Icon = ICONS[item.icon];

                  if (!item.available) {
                    return (
                      <span
                        key={item.href}
                        title="Coming in a later phase"
                        className={clsx(
                          "flex cursor-not-allowed items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm text-slate-300",
                          collapsed && "md:justify-center md:px-0"
                        )}
                      >
                        <Icon size={16} strokeWidth={2} />
                        <span className={clsx(collapsed && "md:hidden")}>{item.label}</span>
                      </span>
                    );
                  }

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={collapsed ? item.label : undefined}
                      className={clsx(
                        "group/nav relative flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                        collapsed && "md:justify-center md:px-0",
                        active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      )}
                    >
                      <Icon
                        size={16}
                        strokeWidth={2}
                        className={clsx("shrink-0", active ? "text-brand-600" : "text-slate-400 group-hover/nav:text-slate-500")}
                      />
                      <span className={clsx(collapsed && "md:hidden")}>{item.label}</span>

                      {/* Hover tooltip — desktop-collapsed only */}
                      {collapsed && (
                        <span className="pointer-events-none absolute left-full z-50 ml-2 hidden -translate-x-1 rounded-md bg-slate-800 px-2 py-1 text-xs whitespace-nowrap text-white opacity-0 shadow-lg transition-all delay-150 duration-150 group-hover/nav:translate-x-0 group-hover/nav:opacity-100 md:group-hover/nav:block">
                          {item.label}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="hidden border-t border-slate-100 p-3 md:block">
          <button
            onClick={onToggleCollapsed}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={clsx(
              "flex w-full items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600",
              collapsed && "justify-center px-0"
            )}
          >
            {collapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
            <span className={clsx(collapsed && "hidden")}>Collapse</span>
          </button>
        </div>
      </nav>
    </>
  );
}
