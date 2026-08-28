import { listLeadsGroupedByStatus } from "@/repositories/lead.repository";
import { listLeadStatuses } from "@/repositories/lookup.repository";
import { getLeadVisibilityWhere } from "@/lib/rbac/scope";
import { PIPELINE_COLUMN_CARD_LIMIT, PIPELINE_EXCLUDED_STATUSES } from "@/lib/pipeline/constants";
import type { CurrentUser } from "@/lib/auth/current-user";

export async function getPipelineForUser(actor: CurrentUser) {
  const [visibility, statuses] = await Promise.all([getLeadVisibilityWhere(actor), listLeadStatuses()]);

  const boardStatuses = statuses.filter((s) => !PIPELINE_EXCLUDED_STATUSES.includes(s.name));

  const columns = await listLeadsGroupedByStatus(
    visibility,
    boardStatuses.map((s) => s.id),
    PIPELINE_COLUMN_CARD_LIMIT
  );

  const columnsByStatusId = new Map(columns.map((c) => [c.statusId, c]));

  return boardStatuses.map((status) => {
    const column = columnsByStatusId.get(status.id);
    return {
      status: { id: status.id, name: status.name, isTerminal: status.isTerminal },
      total: column?.total ?? 0,
      leads: (column?.leads ?? []).map((l) => ({ ...l, updatedAt: l.updatedAt.toISOString() })),
    };
  });
}
