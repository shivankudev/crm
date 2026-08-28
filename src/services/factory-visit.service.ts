import {
  createFactoryVisit,
  findFactoryVisitById,
  listFactoryVisits,
  listFactoryVisitsForLead,
  updateFactoryVisit as updateFactoryVisitRow,
} from "@/repositories/factory-visit.repository";
import { writeLeadActivity } from "@/repositories/lead-activity.repository";
import { updateLead } from "@/repositories/lead.repository";
import { getLeadForUser } from "@/services/lead.service";
import { getLeadVisibilityWhere } from "@/lib/rbac/scope";
import { can, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import type { CurrentUser } from "@/lib/auth/current-user";
import type { CreateFactoryVisitInput, UpdateFactoryVisitInput } from "@/lib/validation/factory-visit";

export class FactoryVisitNotFoundError extends Error {
  constructor() {
    super("Factory visit not found");
    this.name = "FactoryVisitNotFoundError";
  }
}

async function getVisitForUser(id: string, actor: CurrentUser) {
  const visit = await findFactoryVisitById(id);
  if (!visit) throw new FactoryVisitNotFoundError();
  await getLeadForUser(visit.leadId, actor); // enforces lead visibility + existence, 404s otherwise
  return visit;
}

export async function createFactoryVisitForLead(
  leadId: string,
  input: CreateFactoryVisitInput,
  actor: CurrentUser
) {
  if (!can(actor, PERMISSIONS.FACTORY_VISITS_MANAGE) && !can(actor, PERMISSIONS.FACTORY_VISITS_CREATE)) {
    throw new ForbiddenError();
  }
  await getLeadForUser(leadId, actor); // enforces visibility + existence

  const visit = await createFactoryVisit({
    lead: { connect: { id: leadId } },
    visitDate: input.visitDate,
    contactPerson: input.contactPerson,
    numberOfVisitors: input.numberOfVisitors,
    productDiscussed: input.productDiscussed,
    notes: input.notes,
    status: "PLANNED",
  });

  await updateLead(leadId, { factoryVisitStatus: "PLANNED" });

  await writeLeadActivity({
    leadId,
    type: "VISIT_SCHEDULED",
    toValue: input.visitDate.toISOString().slice(0, 10),
    createdById: actor.id,
  });

  return visit;
}

export async function updateFactoryVisitForUser(id: string, input: UpdateFactoryVisitInput, actor: CurrentUser) {
  if (!can(actor, PERMISSIONS.FACTORY_VISITS_MANAGE)) throw new ForbiddenError();

  const visit = await getVisitForUser(id, actor);

  const updated = await updateFactoryVisitRow(id, {
    status: input.status,
    visitDate: input.visitDate,
    contactPerson: input.contactPerson,
    numberOfVisitors: input.numberOfVisitors,
    productDiscussed: input.productDiscussed,
    notes: input.notes,
    result: input.result,
    nextFollowupAt: input.nextFollowupAt,
  });

  if (input.status && input.status !== visit.status) {
    await updateLead(visit.leadId, { factoryVisitStatus: input.status });
    await writeLeadActivity({
      leadId: visit.leadId,
      type: "VISIT_STATUS_CHANGED",
      fromValue: visit.status,
      toValue: input.status,
      createdById: actor.id,
    });
  }

  return updated;
}

export async function listVisitsForLeadForUser(leadId: string, actor: CurrentUser) {
  await getLeadForUser(leadId, actor);
  return listFactoryVisitsForLead(leadId);
}

export async function listVisitsForUser(
  actor: CurrentUser,
  filters: { status?: string; page?: number; pageSize?: number }
) {
  const leadVisibilityWhere = await getLeadVisibilityWhere(actor);
  return listFactoryVisits({
    leadVisibilityWhere,
    status: filters.status,
    page: filters.page ?? 1,
    pageSize: Math.min(filters.pageSize ?? 25, 100),
  });
}
