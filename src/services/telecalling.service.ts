import {
  countTodayFollowUpsForUser,
  listOverdueFollowUpsForUser,
  listTodayFollowUpsForUser,
  listUnworkedNewLeadsForUser,
} from "@/repositories/telecalling.repository";
import { getCallStatusCountsForUser } from "@/repositories/call-activity.repository";
import { findLeadStatusByName, findResultOptionById } from "@/repositories/lookup.repository";
import { addDaysUTC, todayUTC } from "@/lib/date";
import { NOT_CONNECTED_CALL_STATUSES } from "@/lib/leads/constants";
import { logCall } from "@/services/call.service";
import { updateFollowUpForUser } from "@/services/followup.service";
import { changeLeadStatus, LeadServiceError } from "@/services/lead.service";
import { sendWhatsAppForOutcome } from "@/services/whatsapp.service";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/auth/current-user";

export type QueueItemKind = "OVERDUE_FOLLOWUP" | "TODAY_FOLLOWUP" | "NEW_LEAD";

type QueueLead = Awaited<ReturnType<typeof listUnworkedNewLeadsForUser>>[number];

function serializeLead(lead: QueueLead) {
  return { ...lead, lastContactAt: lead.lastContactAt ? lead.lastContactAt.toISOString() : null };
}

/**
 * §7/§9 "fast workspace: queue + quick actions". Always scoped to the
 * caller's own assigned work (not the broader view_all/view_team
 * visibility used elsewhere) — this is a personal call queue, not a
 * report. Ordered by urgency: overdue first, then today, then fresh
 * unworked leads so first contact doesn't go cold.
 */
export async function getTelecallingQueueForUser(actor: CurrentUser) {
  const today = todayUTC();

  const [overdue, dueToday, newLeads] = await Promise.all([
    listOverdueFollowUpsForUser(actor.id, today),
    listTodayFollowUpsForUser(actor.id, today),
    listUnworkedNewLeadsForUser(actor.id),
  ]);

  const toFollowUpItem = (kind: QueueItemKind) => (f: (typeof overdue)[number]) => ({
    kind,
    followUpId: f.id,
    sequenceNumber: f.sequenceNumber,
    scheduledDate: f.scheduledDate.toISOString(),
    scheduledTime: f.scheduledTime,
    notes: f.notes,
    lead: serializeLead(f.lead!),
  });

  /**
   * Today's work first, the backlog after it.
   *
   * A fresh enquiry goes cold within hours, and a follow-up promised for
   * today was promised for today — both lose most of their value sitting
   * behind a backlog that can run to hundreds of items. Overdue work is
   * still served, and still counted; it just stops crowding out the calls
   * worth most right now.
   */
  const items = [
    ...newLeads.map((lead) => ({
      kind: "NEW_LEAD" as QueueItemKind,
      followUpId: null,
      sequenceNumber: null,
      scheduledDate: null,
      scheduledTime: null,
      notes: null,
      lead: serializeLead(lead),
    })),
    ...dueToday.filter((f) => f.lead).map(toFollowUpItem("TODAY_FOLLOWUP")),
    ...overdue.filter((f) => f.lead).map(toFollowUpItem("OVERDUE_FOLLOWUP")),
  ];

  // The two follow-up queries can in principle return the same row — the
  // overdue one matches on status alone, today's on date — and a lead could
  // otherwise appear under two kinds. Nothing produces that overlap in the
  // current data, but ringing the same person twice is a bad enough outcome
  // to guard against rather than assume it stays true.
  const seenFollowUps = new Set<string>();
  const seenLeads = new Set<string>();
  const deduped = items.filter((item) => {
    if (item.followUpId && seenFollowUps.has(item.followUpId)) return false;
    if (seenLeads.has(item.lead.id)) return false;
    if (item.followUpId) seenFollowUps.add(item.followUpId);
    seenLeads.add(item.lead.id);
    return true;
  });

  return {
    items: deduped,
    counts: { overdue: overdue.length, today: dueToday.length, newLeads: newLeads.length },
  };
}

/**
 * "Today's calling" summary: how many of today's due leads have been
 * actioned (and how), vs. still pending, vs. carried over from a
 * previous day untouched (overdue).
 *
 * `pending` reads straight off the live queue — listTodayFollowUpsForUser
 * only returns PENDING/OVERDUE rows, so a follow-up drops out of it the
 * moment it's completed, and what's left *is* today's pending count.
 * `dueToday` is a direct count of every follow-up scheduled for today
 * (any status) — a fixed size that must NOT grow as the telecaller works
 * through overdue or brand-new leads later in the same day. It previously
 * was reconstructed as `pending + callsLoggedToday`, which double-counted:
 * calls made against overdue/new-lead queue items (encouraged by this
 * same workspace's own call ordering) got added on top of pending,
 * inflating "Due today" past the leads that were actually due.
 *
 * Calls-by-outcome comes from CallActivity logged *today* by this user —
 * not from follow-up completion, since a telecaller can log a call
 * without completing the follow-up (e.g. a callback request), and the
 * outcome enum (CONNECTED / NOT_CONNECTED / …) lives on CallActivity,
 * not on FollowUp.
 */
export async function getTelecallerDailyStats(actor: CurrentUser) {
  const today = todayUTC();
  const tomorrow = addDaysUTC(today, 1);

  const [{ counts }, callCounts, dueToday] = await Promise.all([
    getTelecallingQueueForUser(actor),
    getCallStatusCountsForUser(actor.id, today, tomorrow),
    countTodayFollowUpsForUser(actor.id, today),
  ]);

  const connected = callCounts.CONNECTED ?? 0;
  const callBack = callCounts.CALL_BACK ?? 0;
  const notConnected = NOT_CONNECTED_CALL_STATUSES.reduce((sum, key) => sum + (callCounts[key] ?? 0), 0);
  const calledToday = connected + callBack + notConnected;

  const pending = counts.today;

  return {
    dueToday,
    connected,
    notConnected,
    callBack,
    pending,
    calledToday,
    overdue: counts.overdue,
    newLeads: counts.newLeads,
  };
}

/**
 * A telecaller's own connect rate over two windows.
 *
 * This is the whole of what a telecaller sees about their performance —
 * they have no Reports access (§ role matrix: REPORTS_VIEW_OWN is not
 * granted to TELECALLER), so this is deliberately scoped to their own
 * calls only and carries no comparison against anyone else.
 *
 * "Connected" counts calls that actually reached the person; the
 * denominator is every call logged in the window, so a day of unanswered
 * numbers correctly drags the rate down. A window with no calls yields a
 * null rate rather than 0% — nothing dialled is not a 0% connect rate.
 */
export async function getOwnConnectRates(actor: CurrentUser) {
  const today = todayUTC();
  const tomorrow = addDaysUTC(today, 1);

  const [todayCounts, monthCounts] = await Promise.all([
    getCallStatusCountsForUser(actor.id, today, tomorrow),
    getCallStatusCountsForUser(actor.id, addDaysUTC(today, -29), tomorrow),
  ]);

  function rate(counts: Record<string, number>) {
    const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
    const connected = counts.CONNECTED ?? 0;
    return { connected, total, percent: total > 0 ? Math.round((connected / total) * 100) : null };
  }

  return { today: rate(todayCounts), last30Days: rate(monthCounts) };
}

export type TelecallingOutcomeBehavior = "SCHEDULE_NEXT" | "STOP" | "RETRY_TODAY";

type OutcomeRule = {
  callStatus: "CONNECTED" | "NOT_CONNECTED" | "BUSY" | "SWITCHED_OFF" | "WRONG_NUMBER" | "CALL_BACK";
  behavior: TelecallingOutcomeBehavior;
  /** Only set for STOP — the terminal LeadStatus.name the lead moves to. */
  leadStatusName?: string;
};

/**
 * What each (Settings-editable) ResultOption name does to the follow-up
 * chain, keyed by name the same best-effort way the CallActivity.callStatus
 * mapping always worked:
 *   - SCHEDULE_NEXT: complete this follow-up and advance the §6 cadence —
 *     the only outcome the telecaller can still override via the
 *     "continue follow-up" checkbox.
 *   - STOP: complete this follow-up with no next one queued, and move the
 *     lead to the paired terminal status so it's closed out everywhere
 *     (Telecalling, Follow-ups, Reports) rather than just this one queue.
 *   - RETRY_TODAY: don't touch the follow-up at all — it's still PENDING
 *     for today, so it resurfaces later in today's queue on its own, and
 *     rolls into OVERDUE tomorrow with zero extra logic if nobody gets
 *     through by end of day.
 * Anything unrecognized (a custom result an Admin adds in Settings) falls
 * back to SCHEDULE_NEXT — the safe, previously-universal behavior.
 */
const OUTCOME_RULES: Record<string, OutcomeRule> = {
  "Connected - Interested": { callStatus: "CONNECTED", behavior: "SCHEDULE_NEXT" },
  "Connected - Not Interested": { callStatus: "CONNECTED", behavior: "STOP", leadStatusName: "NOT_INTERESTED" },
  "Not Reachable": { callStatus: "NOT_CONNECTED", behavior: "RETRY_TODAY" },
  "Wrong Number": { callStatus: "WRONG_NUMBER", behavior: "STOP", leadStatusName: "INVALID" },
  "Call Back Later": { callStatus: "CALL_BACK", behavior: "RETRY_TODAY" },
};
const DEFAULT_OUTCOME_RULE: OutcomeRule = { callStatus: "CONNECTED", behavior: "SCHEDULE_NEXT" };

/**
 * The single write path behind every Telecalling queue-card submission —
 * logs the call, then applies whichever OUTCOME_RULES behavior the chosen
 * result maps to. Centralized server-side (rather than trusting two
 * separate client calls) so a STOP result can't accidentally schedule a
 * next follow-up, and a RETRY_TODAY one can't get completed by mistake.
 */
/**
 * The lead's currently-owed follow-up, if any — whichever is due soonest
 * among those still outstanding, so a lead with a backlog settles the
 * oldest one first rather than an arbitrary row.
 */
async function resolveOpenFollowUpId(leadId: string): Promise<string | null> {
  const open = await prisma.followUp.findFirst({
    where: { leadId, status: { in: ["PENDING", "OVERDUE"] } },
    orderBy: [{ scheduledDate: "asc" }, { scheduledTime: "asc" }],
    select: { id: true },
  });
  return open?.id ?? null;
}

export async function logTelecallingOutcome(
  actor: CurrentUser,
  input: {
    leadId: string;
    /**
     * The queue passes the follow-up it served. A call logged from the lead's
     * own page passes undefined, and the open follow-up is looked up instead
     * — see resolveFollowUpId.
     */
    followUpId?: string | null;
    resultId: string;
    phoneUsed: string;
    notes?: string;
    continueFollowUp: boolean;
    /** INBOUND when the lead rang back rather than being called. */
    direction?: "OUTBOUND" | "INBOUND";
  }
) {
  const result = await findResultOptionById(input.resultId);
  if (!result) throw new LeadServiceError("Result option not found");
  const rule = OUTCOME_RULES[result.name] ?? DEFAULT_OUTCOME_RULE;

  // A lead who was marked unreachable and later rings back is the case this
  // exists for. Recording that conversation has to settle the follow-up that
  // was already owed, or the work is done and the lead still shows as
  // overdue forever — which is how a queue quietly fills with hundreds of
  // items nobody can clear.
  const followUpId = input.followUpId ?? (await resolveOpenFollowUpId(input.leadId));

  await logCall(
    input.leadId,
    {
      phoneUsed: input.phoneUsed,
      callStatus: rule.callStatus,
      notes: input.notes,
      direction: input.direction ?? "OUTBOUND",
    },
    actor
  );

  // Best-effort, fire-and-forget — a telecaller's own WhatsApp template for
  // this exact outcome, sent from their own linked number. Never awaited:
  // sendWhatsAppForOutcome swallows its own errors, and a slow/unreachable
  // WhatsApp gateway must not add latency to logging a call.
  void sendWhatsAppForOutcome(actor.id, input.phoneUsed, result.name, input.leadId);

  if (followUpId && rule.behavior !== "RETRY_TODAY") {
    await updateFollowUpForUser(
      followUpId,
      {
        action: "complete",
        resultId: input.resultId,
        notes: input.notes,
        continueFollowUp: rule.behavior === "SCHEDULE_NEXT" ? input.continueFollowUp : false,
      },
      actor
    );
  }

  if (rule.behavior === "STOP" && rule.leadStatusName) {
    const status = await findLeadStatusByName(rule.leadStatusName);
    if (status) {
      await changeLeadStatus(input.leadId, { statusId: status.id, resultId: input.resultId, note: input.notes }, actor);
    }
  }

  return { behavior: rule.behavior };
}
