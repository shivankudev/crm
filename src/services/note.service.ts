import { createNote, listNotesForDealer, listNotesForLead } from "@/repositories/note.repository";
import { writeLeadActivity } from "@/repositories/lead-activity.repository";
import { writeDealerActivity } from "@/repositories/dealer-activity.repository";
import { getLeadForUser } from "@/services/lead.service";
import { getDealerForUser } from "@/services/dealer.service";
import { can, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import type { CurrentUser } from "@/lib/auth/current-user";
import type { CreateNoteInput } from "@/lib/validation/lead";

export async function addNoteToLead(leadId: string, input: CreateNoteInput, actor: CurrentUser) {
  await getLeadForUser(leadId, actor);

  const note = await createNote({ leadId, userId: actor.id, body: input.body });

  await writeLeadActivity({
    leadId,
    type: "NOTE",
    createdById: actor.id,
  });

  return note;
}

export async function listNotesForLeadForUser(leadId: string, actor: CurrentUser) {
  await getLeadForUser(leadId, actor);
  return listNotesForLead(leadId);
}

export async function addNoteToDealer(dealerId: string, input: CreateNoteInput, actor: CurrentUser) {
  // §3: dealer notes are part of "View + follow-up" for Sales Manager, full "Manage" for Admin+ —
  // anyone who can see the dealer at all may log a note against it.
  if (!can(actor, PERMISSIONS.DEALERS_MANAGE) && !can(actor, PERMISSIONS.DEALERS_VIEW_FOLLOWUP)) {
    throw new ForbiddenError();
  }
  await getDealerForUser(dealerId, actor);

  const note = await createNote({ dealerId, userId: actor.id, body: input.body });

  await writeDealerActivity({ dealerId, type: "NOTE", userId: actor.id });

  return note;
}

export async function listNotesForDealerForUser(dealerId: string, actor: CurrentUser) {
  await getDealerForUser(dealerId, actor);
  return listNotesForDealer(dealerId);
}
