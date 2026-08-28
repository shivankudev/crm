import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listDealersForUser } from "@/services/dealer.service";
import { listDealerStatuses, listStates } from "@/repositories/lookup.repository";
import { DealersTable } from "@/app/(app)/dealers/dealers-table";

export default async function DealersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const page = sp.page ? Number(sp.page) : 1;

  const [{ dealers, total }, statuses, states] = await Promise.all([
    listDealersForUser(user, {
      statusId: sp.status,
      stateId: sp.state,
      search: sp.q,
      page,
      pageSize: 25,
    }),
    listDealerStatuses(),
    listStates(),
  ]);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Dealers</h1>
          <p className="mt-1 text-sm text-slate-500">{total} dealer(s) in your view</p>
        </div>
      </div>

      <DealersTable
        initialDealers={dealers.map((d) => ({
          id: d.id,
          dealerCode: d.dealerCode,
          dealerName: d.dealerName,
          phone: d.phone,
          contactPerson: d.contactPerson,
          status: { id: d.status.id, name: d.status.name },
          state: d.state ? { name: d.state.name } : null,
          createdAt: d.createdAt.toISOString(),
        }))}
        total={total}
        page={page}
        pageSize={25}
        statuses={statuses.map((s) => ({ id: s.id, name: s.name }))}
        states={states.map((s) => ({ id: s.id, name: s.name }))}
        canCreate={can(user, PERMISSIONS.DEALERS_MANAGE)}
        currentFilters={{ status: sp.status, state: sp.state, q: sp.q }}
      />
    </div>
  );
}
