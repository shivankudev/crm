import { Users2, Building2, Download } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { redirect } from "next/navigation";

const EXPORTS = [
  { href: "/api/v1/export/leads", title: "Leads", description: "Name, phone, status, source, owner, and more.", icon: Users2 },
  { href: "/api/v1/export/dealers", title: "Dealers", description: "Dealer name, contact, status, GSTIN, and more.", icon: Building2 },
];

export default async function ExportPage() {
  const user = await requireUser();
  if (!can(user, PERMISSIONS.IMPORT_EXPORT)) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Export</h1>
      <p className="mt-1 text-sm text-slate-500">
        Downloads a CSV of everything currently in your view (up to 50,000 rows).
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4">
        {EXPORTS.map((e) => (
          <a
            key={e.href}
            href={e.href}
            className="group block rounded-lg border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(10,11,16,0.04)] transition hover:border-slate-300 hover:shadow-[0_4px_12px_rgba(10,11,16,0.06)]"
          >
            <div className="flex items-center justify-between">
              <div className="bg-brand-50 text-brand-600 flex h-9 w-9 items-center justify-center rounded-lg">
                <e.icon size={17} strokeWidth={2.25} />
              </div>
              <Download size={15} className="text-slate-300 group-hover:text-slate-400" />
            </div>
            <p className="group-hover:text-brand-700 mt-3 font-medium text-slate-900">{e.title}</p>
            <p className="mt-1 text-sm text-slate-500">{e.description}</p>
          </a>
        ))}
      </div>
    </div>
  );
}
