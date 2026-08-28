import Link from "next/link";
import { ClipboardCheck } from "lucide-react";
import { requireUser } from "@/lib/auth/current-user";
import { listOnboardingDealersForUser } from "@/services/dealer.service";
import { DealerStatusBadge } from "@/components/dealers/dealer-status-badge";
import { OnboardingStepper } from "@/components/dealers/onboarding-stepper";
import { EmptyState } from "@/components/ui/empty-state";
import { formatDate } from "@/lib/format";

export default async function DealerOnboardingPage() {
  const user = await requireUser();
  const dealers = await listOnboardingDealersForUser(user);

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Dealer Onboarding</h1>
      <p className="mt-1 text-sm text-slate-500">
        {dealers.length} dealer(s) mid-pipeline — contacted but not yet active or exited.
      </p>

      <div className="mt-6 space-y-2">
        {dealers.length === 0 ? (
          <div className="rounded-lg border border-slate-200/80 bg-white">
            <EmptyState icon={ClipboardCheck} title="Nothing in progress right now" description="Dealers move here once they're past first contact." />
          </div>
        ) : (
          dealers.map((d) => (
            <Link
              key={d.id}
              href={`/dealers/${d.id}`}
              className="block rounded-lg border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(10,11,16,0.04)] transition hover:border-slate-300 hover:shadow-[0_4px_12px_rgba(10,11,16,0.06)]"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-slate-900">{d.dealerName}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    <span className="font-mono">{d.dealerCode ?? "No code yet"}</span> ·{" "}
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-600">{d.phone}</span> · Updated{" "}
                    {formatDate(d.updatedAt.toISOString())}
                  </p>
                </div>
                <DealerStatusBadge name={d.status.name} />
              </div>
              <div className="mt-3">
                <OnboardingStepper currentStatusName={d.status.name} />
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
