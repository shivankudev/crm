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

  const items = [
    ...overdue
      .filter((f) => f.lead)
      .map((f) => ({
        kind: "OVERDUE_FOLLOWUP" as QueueItemKind,
        followUpId: f.id,
        sequenceNumber: f.sequenceNumber,
        scheduledDate: f.scheduledDate.toISOString(),
        scheduledTime: f.scheduledTime,
        notes: f.notes,
        lead: serializeLead(f.lead!),
      })),
    ...dueToday
      .filter((f) => f.lead)
      .map((f) => ({
        kind: "TODAY_FOLLOWUP" as QueueItemKind,
        followUpId: f.id,
        sequenceNumber: f.sequenceNumber,
        scheduledDate: f.scheduledDate.toISOString(),
        scheduledTime: f.scheduledTime,
        notes: f.notes,
        lead: serializeLead(f.lead!),
      })),
    ...newLeads.map((lead) => ({
      kind: "NEW_LEAD" as QueueItemKind,
      followUpId: null,
      sequenceNumber: null,
      scheduledDate: null,
      scheduledTime: null,
      notes: null,
      lead: serializeLead(lead),
    })),
  ];

  return {
    items,
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
export async function logTelecallingOutcome(
  actor: CurrentUser,
  input: {
    leadId: string;
    followUpId: string | null;
    resultId: string;
    phoneUsed: string;
    notes?: string;
    continueFollowUp: boolean;
  }
) {
  const result = await findResultOptionById(input.resultId);
  if (!result) throw new LeadServiceError("Result option not found");
  const rule = OUTCOME_RULES[result.name] ?? DEFAULT_OUTCOME_RULE;

  await logCall(input.leadId, { phoneUsed: input.phoneUsed, callStatus: rule.callStatus, notes: input.notes }, actor);

  // Best-effort, fire-and-forget — a telecaller's own WhatsApp template for
  // this exact outcome, sent from their own linked number. Never awaited:
  // sendWhatsAppForOutcome swallows its own errors, and a slow/unreachable
  // WhatsApp gateway must not add latency to logging a call.
  void sendWhatsAppForOutcome(actor.id, input.phoneUsed, result.name, input.leadId);

  if (input.followUpId && rule.behavior !== "RETRY_TODAY") {
    await updateFollowUpForUser(
      input.followUpId,
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
