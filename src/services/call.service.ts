import { createCallActivity, listCallActivity } from "@/repositories/call-activity.repository";
import { writeLeadActivity } from "@/repositories/lead-activity.repository";
import { updateLead } from "@/repositories/lead.repository";
import { getLeadForUser } from "@/services/lead.service";
import type { CurrentUser } from "@/lib/auth/current-user";
import type { LogCallInput } from "@/lib/validation/lead";

export async function logCall(leadId: string, input: LogCallInput, actor: CurrentUser) {
  await getLeadForUser(leadId, actor); // enforces visibility + existence

  const call = await createCallActivity({
    lead: { connect: { id: leadId } },
    user: { connect: { id: actor.id } },
    phoneUsed: input.phoneUsed,
    callStatus: input.callStatus,
    durationSecs: input.durationSecs,
    notes: input.notes,
    nextFollowupAt: input.nextFollowupAt,
  });

  await updateLead(leadId, { lastContactAt: new Date() });

  await writeLeadActivity({
    leadId,
    type: "CALL",
    toValue: input.callStatus,
    meta: { durationSecs: input.durationSecs, notes: input.notes },
    createdById: actor.id,
  });

  return call;
}

export async function listCallsForLead(leadId: string, actor: CurrentUser) {
  await getLeadForUser(leadId, actor);
  return listCallActivity(leadId);
}
