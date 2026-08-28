import Link from "next/link";
import { redirect } from "next/navigation";
import { ListChecks, CalendarClock, Building2, Package, ShieldCheck, MessageCircle, Send, type LucideIcon } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";

export default async function SettingsHubPage() {
  const user = await requireUser();
  const canSettings = can(user, PERMISSIONS.SETTINGS_MANAGE) || can(user, PERMISSIONS.SETTINGS_MANAGE_PARTIAL);
  const canUsers = can(user, PERMISSIONS.USERS_MANAGE_SCOPED);
  if (!canSettings && !canUsers) redirect("/dashboard");

  const sections = [
    canSettings && {
      href: "/settings/leads",
      title: "Leads",
      description: "Statuses, sources, result options, lost reasons.",
      icon: ListChecks,
    },
    canSettings && {
      href: "/settings/followups",
      title: "Follow-ups",
      description: "Cadence rules and the telecaller status-change allowlist.",
      icon: CalendarClock,
    },
    canSettings && {
      href: "/settings/whatsapp",
      title: "WhatsApp messages",
      description: "Automated messages per call outcome and cadence step.",
      icon: MessageCircle,
    },
    canSettings && {
      href: "/settings/quick-actions",
      title: "Quick send buttons",
      description: "One-press WhatsApp sends on the calling screen.",
      icon: Send,
    },
    canSettings && {
      href: "/settings/dealers",
      title: "Dealers",
      description: "Dealer onboarding statuses.",
      icon: Building2,
    },
    canSettings && {
      href: "/products",
      title: "Products",
      description: "Product catalog, pricing, and GST rates.",
      icon: Package,
    },
    canUsers && {
      href: "/settings/users",
      title: "Users & Permissions",
      description: "Manage users, roles, and access.",
      icon: ShieldCheck,
    },
  ].filter(Boolean) as { href: string; title: string; description: string; icon: LucideIcon }[];

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Settings</h1>
      <p className="mt-1 text-sm text-slate-500">Configuration that drives the app, not code.</p>

      <div className="mt-6 grid grid-cols-2 gap-4">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group block rounded-lg border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(10,11,16,0.04)] transition hover:border-slate-300 hover:shadow-[0_4px_12px_rgba(10,11,16,0.06)]"
          >
            <div className="bg-brand-50 text-brand-600 flex h-9 w-9 items-center justify-center rounded-lg">
              <s.icon size={17} strokeWidth={2.25} />
            </div>
            <p className="group-hover:text-brand-700 mt-3 font-medium text-slate-900">{s.title}</p>
            <p className="mt-1 text-sm text-slate-500">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
