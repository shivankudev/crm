import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getLeadForUser, LeadNotFoundError } from "@/services/lead.service";
import { listUsers } from "@/services/user.service";
import {
  listLeadSources,
  listLeadStatuses,
  listLostReasons,
  listResultOptions,
  listStates,
} from "@/repositories/lookup.repository";
import { listLeadActivity } from "@/repositories/lead-activity.repository";
import { listCallActivity } from "@/repositories/call-activity.repository";
import { listNotesForLead } from "@/repositories/note.repository";
import { listFollowUpsForLead } from "@/repositories/followup.repository";
import { listFactoryVisitsForLead } from "@/repositories/factory-visit.repository";
import { listWhatsAppMessagesForLead } from "@/repositories/whatsapp.repository";
import { WA_TRIGGER_CADENCE_STEP } from "@/lib/whatsapp-constants";
import { LeadProfile } from "@/app/(app)/leads/[id]/lead-profile";

/** Human-readable source of an automated message, for the lead timeline. */
function describeWhatsAppTrigger(triggerType: string, triggerKey: string) {
  if (triggerType !== WA_TRIGGER_CADENCE_STEP) return triggerKey;
  return triggerKey === "1" ? "Welcome message" : `Follow-up #${triggerKey}`;
}

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  let lead;
  try {
    lead = await getLeadForUser(id, user);
  } catch (error) {
    if (error instanceof LeadNotFoundError) notFound();
    throw error;
  }

  const canAssign = can(user, PERMISSIONS.LEADS_ASSIGN);

  const [activity, whatsappMessages, calls, notes, followUps, visits, statuses, sources, states, results, lostReasons, allUsers] =
    await Promise.all([
      listLeadActivity(id),
      listWhatsAppMessagesForLead(id),
      listCallActivity(id),
      listNotesForLead(id),
      listFollowUpsForLead(id),
      listFactoryVisitsForLead(id),
      listLeadStatuses(),
      listLeadSources(),
      listStates(),
      listResultOptions(),
      listLostReasons(),
      canAssign ? listUsers() : Promise.resolve([]),
    ]);

  return (
    <LeadProfile
      canChangeStatus={can(user, PERMISSIONS.LEADS_STATUS_CHANGE_ALL) || can(user, PERMISSIONS.LEADS_STATUS_CHANGE_LIMITED)}
      canAssign={canAssign}
      canLogCall={can(user, PERMISSIONS.LEADS_CALL_LOG)}
      canManageFollowUps={can(user, PERMISSIONS.LEADS_FOLLOWUPS_MANAGE)}
      canManageVisits={can(user, PERMISSIONS.FACTORY_VISITS_MANAGE)}
      canCreateVisits={can(user, PERMISSIONS.FACTORY_VISITS_MANAGE) || can(user, PERMISSIONS.FACTORY_VISITS_CREATE)}
      lead={{
        id: lead.id,
        leadCode: lead.leadCode,
        name: lead.name,
        phone: lead.phone,
        phone2: lead.phone2,
        whatsapp: lead.whatsapp,
        email: lead.email,
        address: lead.address,
        pincode: lead.pincode,
        temperature: lead.temperature,
        priority: lead.priority,
        closedStatus: lead.closedStatus,
        interestedProduct: lead.interestedProduct,
        expectedQuantity: lead.expectedQuantity,
        investmentCapacity: lead.investmentCapacity,
        financingRequired: lead.financingRequired,
        status: { id: lead.status.id, name: lead.status.name, isTerminal: lead.status.isTerminal },
        source: lead.source ? { id: lead.source.id, name: lead.source.name } : null,
        state: lead.state ? { id: lead.state.id, name: lead.state.name } : null,
        assignedUser: lead.assignedUser,
        createdBy: lead.createdBy,
        lostReason: lead.lostReason ? { name: lead.lostReason.name } : null,
        createdAt: lead.createdAt.toISOString(),
      }}
      activity={[
        ...activity.map((a) => ({
          id: a.id,
          type: a.type,
          fromValue: a.fromValue,
          toValue: a.toValue,
          meta: a.meta as Record<string, unknown> | null,
          createdAt: a.createdAt.toISOString(),
        })),
        // WhatsApp sends are merged in at read time rather than written as
        // LeadActivity rows: their delivery state keeps advancing
        // (SENT -> DELIVERED -> READ) after the fact, so a frozen activity
        // row would permanently show "sent" for a message that was read.
        ...whatsappMessages.map((m) => ({
          id: `wa-${m.id}`,
          type: `WHATSAPP_${m.status}`,
          fromValue: null,
          toValue: [describeWhatsAppTrigger(m.triggerType, m.triggerKey), m.error].filter(Boolean).join(" — "),
          meta: null,
          createdAt: m.createdAt.toISOString(),
        })),
      ].sort((a, b) => b.createdAt.localeCompare(a.createdAt))}
      calls={calls.map((c) => ({
        id: c.id,
        phoneUsed: c.phoneUsed,
        callStatus: c.callStatus,
          direction: c.direction,
        durationSecs: c.durationSecs,
        notes: c.notes,
        user: c.user,
        createdAt: c.createdAt.toISOString(),
      }))}
      notes={notes.map((n) => ({
        id: n.id,
        body: n.body,
        user: n.user,
        createdAt: n.createdAt.toISOString(),
      }))}
      followUps={followUps.map((f) => ({
        id: f.id,
        type: f.type,
        sequenceNumber: f.sequenceNumber,
        scheduledDate: f.scheduledDate.toISOString(),
        scheduledTime: f.scheduledTime,
        status: f.status,
        notes: f.notes,
        result: f.result ? { name: f.result.name } : null,
        assignedUser: f.assignedUser,
      }))}
      visits={visits.map((v) => ({
        id: v.id,
        visitDate: v.visitDate.toISOString(),
        contactPerson: v.contactPerson,
        numberOfVisitors: v.numberOfVisitors,
        status: v.status,
        productDiscussed: v.productDiscussed,
        notes: v.notes,
        result: v.result,
      }))}
      statuses={statuses.map((s) => ({ id: s.id, name: s.name, isTerminal: s.isTerminal }))}
      sources={sources.map((s) => ({ id: s.id, name: s.name }))}
      states={states.map((s) => ({ id: s.id, name: s.name }))}
      results={results.map((r) => ({ id: r.id, name: r.name }))}
      lostReasons={lostReasons.map((r) => ({ id: r.id, name: r.name }))}
      assignableUsers={allUsers.filter((u) => u.active).map((u) => ({ id: u.id, name: u.name }))}
    />
  );
}
