import {
  createFollowUp,
  findFollowUpById,
  findLatestFollowUpForDealer,
  findLatestFollowUpForLead,
  listActiveFollowUpsBySequence,
  listOverdueFollowUps,
  listTodayFollowUps,
  updateFollowUp,
} from "@/repositories/followup.repository";
import { writeLeadActivity } from "@/repositories/lead-activity.repository";
import { writeDealerActivity } from "@/repositories/dealer-activity.repository";
import { getLeadForUser } from "@/services/lead.service";
import { getDealerForUser } from "@/services/dealer.service";
import { can, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getFollowUpVisibilityWhere } from "@/lib/rbac/scope";
import { addDaysUTC, dateOnlyUTC, todayUTC } from "@/lib/date";
import { enqueueScheduleNextFollowUp } from "@/lib/queues";
import { sendWhatsAppForCadenceStep } from "@/services/whatsapp.service";
import type { CurrentUser } from "@/lib/auth/current-user";
import type { CreateFollowUpInput, UpdateFollowUpInput } from "@/lib/validation/followup";
import { prisma } from "@/lib/prisma";

export class FollowUpServiceError extends Error {}

export class FollowUpNotFoundError extends Error {
  constructor() {
    super("Follow-up not found");
    this.name = "FollowUpNotFoundError";
  }
}

async function getFollowUpForUser(id: string, user: CurrentUser) {
  const followUp = await findFollowUpById(id);
  if (!followUp) throw new FollowUpNotFoundError();

  const visibility = await getFollowUpVisibilityWhere(user);
  // AND, not spread: visibility's sentinel `{ id: "__no_access__" }` would
  // otherwise be silently overwritten by the `id` key below — see the
  // matching fix in lead.repository.ts / dealer.repository.ts.
  const found = await prisma.followUp.findFirst({
    where: { AND: [visibility, { id }] },
    select: { id: true },
  });
  if (!found) throw new FollowUpNotFoundError();

  return followUp;
}

export async function createManualFollowUp(input: CreateFollowUpInput, actor: CurrentUser) {
  if (!input.leadId && !input.dealerId) {
    throw new FollowUpServiceError("A follow-up must be linked to a lead or a dealer");
  }
  if (input.leadId) {
    await getLeadForUser(input.leadId, actor); // enforces visibility + existence
  }
  if (input.dealerId) {
    if (!can(actor, PERMISSIONS.DEALERS_MANAGE) && !can(actor, PERMISSIONS.DEALERS_VIEW_FOLLOWUP)) {
      throw new ForbiddenError();
    }
    await getDealerForUser(input.dealerId, actor); // enforces visibility + existence
  }

  const latest = input.leadId
    ? await findLatestFollowUpForLead(input.leadId)
    : input.dealerId
      ? await findLatestFollowUpForDealer(input.dealerId)
      : null;

  const followUp = await createFollowUp({
    lead: input.leadId ? { connect: { id: input.leadId } } : undefined,
    dealer: input.dealerId ? { connect: { id: input.dealerId } } : undefined,
    assignedUser: { connect: { id: input.assignedUserId ?? actor.id } },
    type: input.type,
    sequenceNumber: (latest?.sequenceNumber ?? 0) + 1,
    scheduledDate: dateOnlyUTC(input.scheduledDate),
    scheduledTime: input.scheduledTime,
    notes: input.notes,
  });

  const scheduledLabel = `${input.scheduledDate.toISOString().slice(0, 10)} ${input.scheduledTime}`;

  if (input.leadId) {
    await writeLeadActivity({
      leadId: input.leadId,
      type: "FOLLOWUP_CREATED",
      toValue: scheduledLabel,
      createdById: actor.id,
    });
  }
  if (input.dealerId) {
    await writeDealerActivity({
      dealerId: input.dealerId,
      type: "FOLLOWUP_CREATED",
      toValue: scheduledLabel,
      userId: actor.id,
    });
  }

  return followUp;
}

export async function listTodayForUser(actor: CurrentUser, pagination: { page: number; pageSize: number }) {
  const where = await getFollowUpVisibilityWhere(actor);
  return listTodayFollowUps(where, todayUTC(), pagination);
}

export async function listOverdueForUser(actor: CurrentUser, pagination: { page: number; pageSize: number }) {
  const where = await getFollowUpVisibilityWhere(actor);
  return listOverdueFollowUps(where, todayUTC(), pagination);
}

export async function updateFollowUpForUser(id: string, input: UpdateFollowUpInput, actor: CurrentUser) {
  const followUp = await getFollowUpForUser(id, actor);

  if (followUp.status !== "PENDING" && followUp.status !== "OVERDUE") {
    throw new FollowUpServiceError(`Follow-up is already ${followUp.status.toLowerCase()}`);
  }

  if (input.action === "complete") {
    const updated = await updateFollowUp(id, {
      status: "COMPLETED",
      result: { connect: { id: input.resultId } },
      notes: input.notes,
      completedAt: new Date(),
      completedById: actor.id,
    });

    if (followUp.leadId) {
      await writeLeadActivity({
        leadId: followUp.leadId,
        type: "FOLLOWUP_COMPLETED",
        meta: { resultId: input.resultId, continueFollowUp: input.continueFollowUp },
        createdById: actor.id,
      });

      if (input.continueFollowUp) {
        await enqueueScheduleNextFollowUp({
          leadId: followUp.leadId,
          sequenceNumber: followUp.sequenceNumber + 1,
          // This step is only ever reached by a telecaller completing a
          // call — unlike lead creation or a status-change reactivation,
          // which also call enqueueScheduleNextFollowUp without this flag.
          notifyViaWhatsApp: true,
        });
      }
    }
    if (followUp.dealerId) {
      // Dealers don't have an auto-cadence worker job yet (only leads do —
      // see scheduleNextFollowUpForLead) — "continue" is recorded but the
      // next one has to be scheduled manually via "Schedule follow-up".
      await writeDealerActivity({
        dealerId: followUp.dealerId,
        type: "FOLLOWUP_COMPLETED",
        meta: { resultId: input.resultId, continueFollowUp: input.continueFollowUp },
        userId: actor.id,
      });
    }

    return { followUp: updated };
  }

  if (input.action === "reschedule") {
    const updated = await updateFollowUp(id, { status: "RESCHEDULED", notes: input.notes });

    const next = await createFollowUp({
      lead: followUp.leadId ? { connect: { id: followUp.leadId } } : undefined,
      dealer: followUp.dealerId ? { connect: { id: followUp.dealerId } } : undefined,
      assignedUser: { connect: { id: followUp.assignedUserId } },
      type: followUp.type,
      sequenceNumber: followUp.sequenceNumber,
      scheduledDate: dateOnlyUTC(input.scheduledDate),
      scheduledTime: input.scheduledTime,
      notes: input.notes,
    });

    const rescheduledLabel = `${input.scheduledDate.toISOString().slice(0, 10)} ${input.scheduledTime}`;
    if (followUp.leadId) {
      await writeLeadActivity({
        leadId: followUp.leadId,
        type: "FOLLOWUP_RESCHEDULED",
        toValue: rescheduledLabel,
        createdById: actor.id,
      });
    }
    if (followUp.dealerId) {
      await writeDealerActivity({
        dealerId: followUp.dealerId,
        type: "FOLLOWUP_RESCHEDULED",
        toValue: rescheduledLabel,
        userId: actor.id,
      });
    }

    return { followUp: updated, next };
  }

  // cancel
  const updated = await updateFollowUp(id, { status: "CANCELLED", notes: input.notes });
  if (followUp.leadId) {
    await writeLeadActivity({
      leadId: followUp.leadId,
      type: "FOLLOWUP_CANCELLED",
      createdById: actor.id,
    });
  }
  if (followUp.dealerId) {
    await writeDealerActivity({
      dealerId: followUp.dealerId,
      type: "FOLLOWUP_CANCELLED",
      userId: actor.id,
    });
  }
  return { followUp: updated };
}

/**
 * Worker-side: processes a "schedule-next" job. Looks up the configured
 * rule for this sequence number and creates the FollowUp row — kept out
 * of the request path per §46/§52 (background jobs, not inline writes).
 */
export async function scheduleNextFollowUpForLead(
  leadId: string,
  sequenceNumber: number,
  notifyViaWhatsApp = false
) {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, deletedAt: null },
    include: { status: true },
  });
  if (!lead || lead.status.isTerminal) return null; // lead closed/deleted since the job was enqueued

  const existingActive = await prisma.followUp.findFirst({
    where: { leadId, status: { in: ["PENDING", "OVERDUE"] } },
  });
  if (existingActive) return null; // already has one scheduled — don't double up

  const rule = await prisma.followUpRule.findFirst({
    where: { sequenceNumber, enabled: true, appliesTo: { in: ["LEAD", "BOTH"] } },
  });
  if (!rule) return null; // sequence exhausted or not configured

  const scheduledDate = addDaysUTC(todayUTC(), rule.daysAfterPrevious);

  const followUp = await createFollowUp({
    lead: { connect: { id: leadId } },
    assignedUser: { connect: { id: lead.assignedUserId ?? lead.createdById } },
    type: "CALL",
    sequenceNumber,
    scheduledDate,
    scheduledTime: rule.defaultTime,
  });

  await writeLeadActivity({
    leadId,
    type: "FOLLOWUP_SCHEDULED",
    toValue: `${scheduledDate.toISOString().slice(0, 10)} ${rule.defaultTime}`,
  });

  // Best-effort, from the telecaller who owns the lead's own WhatsApp —
  // only when this creation traces back to a live call (see
  // ScheduleNextFollowUpJob.notifyViaWhatsApp), never for a first
  // follow-up seeded at lead creation or a status-change reactivation.
  if (notifyViaWhatsApp && lead.assignedUserId && lead.phone) {
    void sendWhatsAppForCadenceStep(lead.assignedUserId, lead.phone, sequenceNumber, leadId);
  }

  return followUp;
}

/**
 * §6 cadence edit, retroactive option: when Admin changes a step's gap
 * (or its default time) in Settings and opts to apply it to already-
 * scheduled work — not just leads/dealers that haven't reached this step
 * yet — every still-active (PENDING/OVERDUE) follow-up sitting on that
 * exact sequence number shifts by the same number of days the rule
 * changed by. A shrunk gap can legitimately push a date into the past;
 * that's intended (it now reads as due/overdue immediately, the same as
 * any other past-dated PENDING row) rather than something to guard against.
 * Never touches COMPLETED/CANCELLED/RESCHEDULED rows — this is about
 * currently-pending work, not history.
 */
export async function reshiftFollowUpsForRuleChange(
  sequenceNumber: number,
  appliesTo: "LEAD" | "DEALER" | "BOTH",
  deltaDays: number,
  newDefaultTime: string | undefined,
  actor: CurrentUser
) {
  if (deltaDays === 0 && !newDefaultTime) return { shiftedCount: 0 };

  const affected = await listActiveFollowUpsBySequence(sequenceNumber, appliesTo);

  for (const followUp of affected) {
    const scheduledDate = deltaDays !== 0 ? addDaysUTC(followUp.scheduledDate, deltaDays) : followUp.scheduledDate;
    const scheduledTime = newDefaultTime ?? followUp.scheduledTime;

    await updateFollowUp(followUp.id, { scheduledDate, scheduledTime });

    const toValue = `${scheduledDate.toISOString().slice(0, 10)} ${scheduledTime} (cadence rule for step #${sequenceNumber} changed)`;
    if (followUp.leadId) {
      await writeLeadActivity({ leadId: followUp.leadId, type: "FOLLOWUP_RESCHEDULED", toValue, createdById: actor.id });
    }
    if (followUp.dealerId) {
      await writeDealerActivity({ dealerId: followUp.dealerId, type: "FOLLOWUP_RESCHEDULED", toValue, userId: actor.id });
    }
  }

  return { shiftedCount: affected.length };
}
