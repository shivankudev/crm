import Link from "next/link";
import { Car } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { listVisitsForUser } from "@/services/factory-visit.service";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";

const STATUS_STYLES: Record<string, string> = {
  PLANNED: "chip-live",
  CONFIRMED: "chip-live",
  COMPLETED: "chip-pos",
  CANCELLED: "chip-mute",
  RESCHEDULED: "chip-live",
  NO_SHOW: "chip-neg",
};

export default async function FactoryVisitsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const page = sp.page ? Number(sp.page) : 1;

  const { visits, total } = await listVisitsForUser(user, { status: sp.status, page, pageSize: 25 });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Factory Visits</h1>
      <p className="mt-1 text-sm text-slate-500">{total} visit(s) in your view</p>

      <div className="mt-6 space-y-2">
        {visits.length === 0 ? (
          <div className="rounded-lg border border-slate-200/80 bg-white">
            <EmptyState icon={Car} title="No factory visits scheduled" description="Visits scheduled from a lead's profile will show up here." />
          </div>
        ) : (
          visits.map((v) => (
            <Link
              key={v.id}
              href={`/leads/${v.leadId}`}
              className="block rounded-lg border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(10,11,16,0.04)] transition hover:border-slate-300 hover:shadow-[0_4px_12px_rgba(10,11,16,0.06)]"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-slate-900">{v.lead.name}</p>
                  <p className="text-xs text-slate-400">
                    {v.lead.leadCode} · {v.lead.phone} · {formatDate(v.visitDate)}
                  </p>
                </div>
                <span className={`chip ${STATUS_STYLES[v.status] ?? "chip-mute"}`}>{v.status.replaceAll("_", " ")}</span>
              </div>
              {v.productDiscussed && <p className="mt-2 text-sm text-slate-600">{v.productDiscussed}</p>}
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
