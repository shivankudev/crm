import {
  createLead as createLeadRow,
  createLeadCheckingDuplicate as createLeadWithDuplicateCheck,
  findLeadByIdInScope,
  generateLeadCode,
  listLeads as listLeadsRows,
  updateLead as updateLeadRow,
  type LeadListFilters,
} from "@/repositories/lead.repository";
import { findLeadStatusByName, findLeadStatusById, getSetting } from "@/repositories/lookup.repository";
import { writeLeadActivity } from "@/repositories/lead-activity.repository";
import {
  cancelActiveFollowUpsForLead,
  findActiveFollowUpForLead,
  reassignActiveFollowUpsForLead,
} from "@/repositories/followup.repository";
import { writeAuditLog } from "@/services/audit.service";
import { normalizePhone } from "@/lib/phone";
import { enqueueScheduleNextFollowUp } from "@/lib/queues";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getLeadVisibilityWhere } from "@/lib/rbac/scope";
import {
  DEFAULT_TELECALLER_ALLOWED_STATUSES,
  LOST_STATUS_NAME,
  TELECALLER_ALLOWED_STATUSES_SETTING_KEY,
  WON_STATUS_NAME,
} from "@/lib/leads/constants";
import type { CurrentUser } from "@/lib/auth/current-user";
import type { CreateLeadInput, UpdateLeadInput, ChangeLeadStatusInput } from "@/lib/validation/lead";

export class LeadServiceError extends Error {}

export class DuplicateLeadError extends Error {
  constructor(public existing: { id: string; leadCode: string; name: string; phone: string }) {
    super("A lead with this phone number already exists");
    this.name = "DuplicateLeadError";
  }
}

export class LeadNotFoundError extends Error {
  constructor() {
    super("Lead not found");
    this.name = "LeadNotFoundError";
  }
}

export async function getLeadForUser(id: string, user: CurrentUser) {
  const visibility = await getLeadVisibilityWhere(user);
  const lead = await findLeadByIdInScope(id, visibility);
  if (!lead) throw new LeadNotFoundError();
  return lead;
}

export async function listLeadsForUser(
  user: CurrentUser,
  filters: {
    statusId?: string;
    sourceId?: string;
    stateId?: string;
    assignedUserId?: string;
    temperature?: string;
    search?: string;
    page?: number;
    pageSize?: number;
  }
) {
  const visibility = await getLeadVisibilityWhere(user);
  const where: LeadListFilters["where"] = {
    ...visibility,
    ...(filters.statusId ? { statusId: filters.statusId } : {}),
    ...(filters.sourceId ? { sourceId: filters.sourceId } : {}),
    ...(filters.stateId ? { stateId: filters.stateId } : {}),
    ...(filters.assignedUserId ? { assignedUserId: filters.assignedUserId } : {}),
    ...(filters.temperature ? { temperature: filters.temperature } : {}),
  };

  return listLeadsRows({
    where,
    search: filters.search,
    page: filters.page ?? 1,
    pageSize: Math.min(filters.pageSize ?? 25, 100),
  });
}

/**
 * `initialStatusId`/`createdAt` are deliberately not part of
 * CreateLeadInput/the public `/api/v1/leads` schema — a telecaller
 * creating "a new lead" can't skip straight to WON or backdate it that
 * way. They only exist for bulk-migration paths (CSV import, one-off
 * data-migration scripts) that are bringing in leads which already have
 * a real stage and history in the source system, and already require
 * IMPORT_EXPORT permission or direct script access — so setting them
 * directly there isn't a workflow bypass.
 */
export async function createLead(
  input: CreateLeadInput,
  actor: CurrentUser,
  options?: { initialStatusId?: string; createdAt?: Date; sendWelcomeMessage?: boolean }
) {
  const phoneNormalized = normalizePhone(input.phone);

  const newStatus = options?.initialStatusId
    ? await findLeadStatusById(options.initialStatusId)
    : await findLeadStatusByName("NEW");
  if (!newStatus) throw new LeadServiceError("NEW lead status is not configured");

  // Mirrors changeLeadStatus's derivation — an import that lands a lead
  // directly on WON/LOST still needs closedStatus set, since that's the
  // field reports actually key off (win-rate, outcome breakdowns), not
  // status.name.
  const closedStatus =
    newStatus.name === WON_STATUS_NAME ? "CLOSED_WON" : newStatus.isTerminal ? "CLOSED_LOST" : "OPEN";

  const leadCode = await generateLeadCode();
  const assignedUserId = input.assignedUserId ?? actor.id;

  const leadData = {
    leadCode,
    name: input.name,
    phone: input.phone,
    phoneNormalized,
    phone2: input.phone2,
    whatsapp: input.whatsapp,
    email: input.email || undefined,
    address: input.address,
    pincode: input.pincode,
    state: input.stateId ? { connect: { id: input.stateId } } : undefined,
    district: input.districtId ? { connect: { id: input.districtId } } : undefined,
    city: input.cityId ? { connect: { id: input.cityId } } : undefined,
    source: input.sourceId ? { connect: { id: input.sourceId } } : undefined,
    status: { connect: { id: newStatus.id } },
    closedStatus,
    ...(options?.createdAt ? { createdAt: options.createdAt } : {}),
    temperature: input.temperature,
    priority: input.priority,
    existingBusiness: input.existingBusiness,
    existingVehicleBrand: input.existingVehicleBrand,
    interestedProduct: input.interestedProduct,
    expectedQuantity: input.expectedQuantity,
    investmentCapacity: input.investmentCapacity,
    financingRequired: input.financingRequired,
    competitor: input.competitor,
    assignedUser: { connect: { id: assignedUserId } },
    createdBy: { connect: { id: actor.id } },
  };

  // Duplicates are checked inside the insert's transaction rather than
  // before it — see createLeadCheckingDuplicate for why a plain read-then-
  // write let concurrent submissions through.
  let lead;
  if (input.allowDuplicate) {
    lead = await createLeadRow(leadData);
  } else {
    const result = await createLeadWithDuplicateCheck(leadData, phoneNormalized);
    if (result.existing) throw new DuplicateLeadError(result.existing);
    lead = result.lead!;
  }

  await writeLeadActivity({
    leadId: lead.id,
    type: "CREATED",
    toValue: newStatus.name,
    createdById: actor.id,
  });

  // The lead's first follow-up doubles as the "welcome touch": its
  // WhatsApp template (cadence step #1) goes out as soon as the lead
  // exists, before anyone has called them.
  //
  // Defaults ON for a single lead created by hand, and is turned OFF by
  // the CSV import path — createLead() is called once per imported row,
  // so an unconditional welcome would fire one WhatsApp per row (up to
  // 2,000 in a burst). That is precisely the mass-messaging pattern
  // WhatsApp bans numbers for, and a ban takes out calling as well as
  // messaging for that telecaller.
  await enqueueScheduleNextFollowUp({
    leadId: lead.id,
    sequenceNumber: 1,
    notifyViaWhatsApp: options?.sendWelcomeMessage !== false,
  });

  return lead;
}

export async function updateLead(id: string, input: UpdateLeadInput, actor: CurrentUser) {
  const before = await getLeadForUser(id, actor);

  if (input.assignedUserId !== undefined && input.assignedUserId !== before.assignedUserId) {
    if (!can(actor, PERMISSIONS.LEADS_ASSIGN)) {
      throw new LeadServiceError("Not permitted to assign/reassign leads");
    }
  }

  const data: Parameters<typeof updateLeadRow>[1] = {
    name: input.name,
    phone: input.phone,
    phone2: input.phone2,
    whatsapp: input.whatsapp,
    email: input.email === "" ? null : input.email,
    address: input.address,
    pincode: input.pincode,
    temperature: input.temperature,
    priority: input.priority,
    existingBusiness: input.existingBusiness,
    existingVehicleBrand: input.existingVehicleBrand,
    interestedProduct: input.interestedProduct,
    expectedQuantity: input.expectedQuantity,
    investmentCapacity: input.investmentCapacity,
    financingRequired: input.financingRequired,
    competitor: input.competitor,
  };
  if (input.phone) data.phoneNormalized = normalizePhone(input.phone);
  if (input.stateId !== undefined)
    data.state = input.stateId ? { connect: { id: input.stateId } } : { disconnect: true };
  if (input.districtId !== undefined)
    data.district = input.districtId ? { connect: { id: input.districtId } } : { disconnect: true };
  if (input.cityId !== undefined)
    data.city = input.cityId ? { connect: { id: input.cityId } } : { disconnect: true };
  if (input.sourceId !== undefined)
    data.source = input.sourceId ? { connect: { id: input.sourceId } } : { disconnect: true };
  if (input.assignedUserId !== undefined && input.assignedUserId)
    data.assignedUser = { connect: { id: input.assignedUserId } };

  const lead = await updateLeadRow(id, data);

  if (input.assignedUserId !== undefined && input.assignedUserId !== before.assignedUserId) {
    // A reassign should carry the lead's open work with it — otherwise the
    // new owner's Telecalling dashboard shows nothing for a lead they now
    // own, while the follow-up silently sits on the previous owner's list.
    // (Unassigning to null leaves existing follow-ups where they are — this
    // path doesn't currently support clearing the owner outright, see the
    // `data.assignedUser` guard above.)
    if (input.assignedUserId) {
      await reassignActiveFollowUpsForLead(id, input.assignedUserId);
    }

    await writeLeadActivity({
      leadId: id,
      type: "ASSIGNED",
      fromValue: before.assignedUserId,
      toValue: input.assignedUserId,
      createdById: actor.id,
    });
  }

  await writeAuditLog({
    userId: actor.id,
    action: "LEAD_UPDATED",
    entityType: "Lead",
    entityId: id,
    previousValue: { assignedUserId: before.assignedUserId },
    newValue: { assignedUserId: lead.assignedUserId },
  });

  return lead;
}

export async function changeLeadStatus(id: string, input: ChangeLeadStatusInput, actor: CurrentUser) {
  const lead = await getLeadForUser(id, actor);
  const targetStatus = await findLeadStatusById(input.statusId);
  if (!targetStatus) throw new LeadServiceError("Status not found");

  if (!can(actor, PERMISSIONS.LEADS_STATUS_CHANGE_ALL)) {
    if (!can(actor, PERMISSIONS.LEADS_STATUS_CHANGE_LIMITED)) {
      throw new LeadServiceError("Not permitted to change lead status");
    }
    const allowed =
      (await getSetting<string[]>(TELECALLER_ALLOWED_STATUSES_SETTING_KEY)) ??
      DEFAULT_TELECALLER_ALLOWED_STATUSES;
    if (!allowed.includes(targetStatus.name)) {
      throw new LeadServiceError(`Not permitted to set status to ${targetStatus.name}`);
    }
  }

  if (targetStatus.name === LOST_STATUS_NAME && !input.lostReasonId) {
    throw new LeadServiceError("A lost reason is required when marking a lead LOST");
  }

  const closedStatus =
    targetStatus.name === WON_STATUS_NAME
      ? "CLOSED_WON"
      : targetStatus.isTerminal
        ? "CLOSED_LOST"
        : "OPEN";

  const updated = await updateLeadRow(id, {
    status: { connect: { id: targetStatus.id } },
    closedStatus,
    result: input.resultId ? { connect: { id: input.resultId } } : undefined,
    lostReason:
      targetStatus.name === LOST_STATUS_NAME && input.lostReasonId
        ? { connect: { id: input.lostReasonId } }
        : undefined,
    lastContactAt: new Date(),
  });

  await writeLeadActivity({
    leadId: id,
    type: "STATUS_CHANGED",
    fromValue: lead.status.name,
    toValue: targetStatus.name,
    meta: input.note ? { note: input.note } : undefined,
    createdById: actor.id,
  });

  if (targetStatus.isTerminal) {
    const cancelled = await cancelActiveFollowUpsForLead(id);
    if (cancelled.count > 0) {
      await writeLeadActivity({
        leadId: id,
        type: "FOLLOWUP_AUTO_CANCELLED",
        meta: { count: cancelled.count, reason: `Lead moved to terminal status ${targetStatus.name}` },
        createdById: actor.id,
      });
    }
  } else {
    const active = await findActiveFollowUpForLead(id);
    if (!active) {
      await enqueueScheduleNextFollowUp({ leadId: id, sequenceNumber: 1 });
    }
  }

  return updated;
}
