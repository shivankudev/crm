import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listLeadsForUser } from "@/services/lead.service";
import { listLeadSources, listLeadStatuses, listStates } from "@/repositories/lookup.repository";
import { listUsers } from "@/services/user.service";
import { LeadsTable } from "@/app/(app)/leads/leads-table";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const page = sp.page ? Number(sp.page) : 1;

  const [{ leads, total }, statuses, sources, states, allUsers] = await Promise.all([
    listLeadsForUser(user, {
      statusId: sp.status,
      sourceId: sp.source,
      stateId: sp.state,
      assignedUserId: sp.owner,
      temperature: sp.temperature,
      search: sp.q,
      page,
      pageSize: 25,
    }),
    listLeadStatuses(),
    listLeadSources(),
    listStates(),
    can(user, PERMISSIONS.LEADS_ASSIGN) ? listUsers() : Promise.resolve([]),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Leads</h1>
        <p className="mt-1 text-sm text-slate-500">{total} lead(s) in your view</p>
      </div>

      <LeadsTable
        initialLeads={leads.map((l) => ({
          id: l.id,
          leadCode: l.leadCode,
          name: l.name,
          phone: l.phone,
          temperature: l.temperature,
          priority: l.priority,
          status: { id: l.status.id, name: l.status.name, isTerminal: l.status.isTerminal },
          source: l.source ? { name: l.source.name } : null,
          state: l.state ? { name: l.state.name } : null,
          assignedUser: l.assignedUser ? { id: l.assignedUser.id, name: l.assignedUser.name } : null,
          nextFollowupAt: l.nextFollowupAt ? l.nextFollowupAt.toISOString() : null,
          createdAt: l.createdAt.toISOString(),
        }))}
        total={total}
        page={page}
        pageSize={25}
        statuses={statuses.map((s) => ({ id: s.id, name: s.name }))}
        sources={sources.map((s) => ({ id: s.id, name: s.name }))}
        states={states.map((s) => ({ id: s.id, name: s.name }))}
        assignableUsers={allUsers.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name }))}
        canAssign={can(user, PERMISSIONS.LEADS_ASSIGN)}
        currentFilters={{
          status: sp.status,
          source: sp.source,
          state: sp.state,
          owner: sp.owner,
          temperature: sp.temperature,
          q: sp.q,
        }}
      />
    </div>
  );
}
