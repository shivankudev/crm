import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getPipelineForUser } from "@/services/pipeline.service";
import { listLostReasons } from "@/repositories/lookup.repository";
import { KanbanBoard } from "@/components/pipeline/kanban-board";

export default async function PipelinePage() {
  const user = await requireUser();
  const [columns, lostReasons] = await Promise.all([getPipelineForUser(user), listLostReasons()]);

  const canChangeStatus =
    can(user, PERMISSIONS.LEADS_STATUS_CHANGE_ALL) || can(user, PERMISSIONS.LEADS_STATUS_CHANGE_LIMITED);

  return (
    <div>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-slate-900">Pipeline</h1>
      <p className="mb-4 text-sm text-slate-500">Drag a lead between stages to update its status.</p>
      <KanbanBoard
        initialColumns={columns}
        lostReasons={lostReasons.map((r) => ({ id: r.id, name: r.name }))}
        canChangeStatus={canChangeStatus}
      />
    </div>
  );
}
