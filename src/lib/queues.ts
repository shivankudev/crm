import { Queue } from "bullmq";
import { redisConnection } from "@/lib/redis";

export const QUEUE_NAMES = {
  FOLLOWUP_SCHEDULER: "followup-scheduler",
  OVERDUE_DETECTOR: "overdue-detector",
  LEAD_SHEET_POLLER: "lead-sheet-poller",
} as const;

export type ScheduleNextFollowUpJob = {
  leadId?: string;
  dealerId?: string;
  sequenceNumber: number;
  /**
   * True only when this job exists because a telecaller's call action
   * just advanced the lead onto this step (see updateFollowUpForUser's
   * "complete" action) — never set from lead creation or a status-change
   * reactivation, both of which also schedule a first/next follow-up but
   * without any telecaller having just acted on this specific lead. Gates
   * the cadence-step WhatsApp send in scheduleNextFollowUpForLead().
   */
  notifyViaWhatsApp?: boolean;
};

const globalForQueues = globalThis as unknown as {
  followUpQueue: Queue<ScheduleNextFollowUpJob> | undefined;
  overdueQueue: Queue | undefined;
  leadSheetQueue: Queue | undefined;
};

export const followUpQueue =
  globalForQueues.followUpQueue ??
  new Queue<ScheduleNextFollowUpJob>(QUEUE_NAMES.FOLLOWUP_SCHEDULER, {
    connection: redisConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: { age: 60 * 60 * 24 }, // 1 day
      removeOnFail: { age: 60 * 60 * 24 * 7 }, // 1 week
    },
  });

export const overdueQueue =
  globalForQueues.overdueQueue ?? new Queue(QUEUE_NAMES.OVERDUE_DETECTOR, { connection: redisConnection });

export const leadSheetQueue =
  globalForQueues.leadSheetQueue ?? new Queue(QUEUE_NAMES.LEAD_SHEET_POLLER, { connection: redisConnection });

if (process.env.NODE_ENV !== "production") {
  globalForQueues.followUpQueue = followUpQueue;
  globalForQueues.overdueQueue = overdueQueue;
  globalForQueues.leadSheetQueue = leadSheetQueue;
}

/**
 * §4/§6: a status change (or lead creation) that leaves the lead active
 * enqueues creation of the next follow-up in the rule sequence, processed
 * by the worker so the request path stays fast and DB-light.
 */
export function enqueueScheduleNextFollowUp(job: ScheduleNextFollowUpJob) {
  return followUpQueue.add("schedule-next", job);
}

/**
 * §6: "flags scheduled_date < today AND status=PENDING -> status=OVERDUE".
 *
 * Deliberately an INTERVAL, not a wall-clock cron. This deployment runs on
 * an office PC that is switched off every evening and back on each
 * morning, so any fixed daily time is a gamble: the original 00:05 UTC
 * (05:35 IST) slot fell squarely inside the hours the machine is always
 * powered down, meaning the sweep would never once have fired and
 * follow-ups would have sat at PENDING forever. Pinning it to a different
 * fixed hour just moves the gamble — it breaks again the day office hours
 * shift, someone works late, or the PC boots after the chosen time.
 *
 * An interval has no opinion about what time it is. It runs whenever the
 * machine happens to be on, and combined with the boot sweep below the
 * behaviour is simply: catch up the moment we start, then keep current
 * while we're running. Nothing to re-tune if the schedule changes.
 *
 * Hourly is well inside the resolution that matters here — the only event
 * being tracked is the UTC date rolling over — and the job itself is one
 * indexed UPDATE.
 */
export const OVERDUE_SWEEP_INTERVAL_MS = 60 * 60 * 1000;

export async function scheduleOverdueDetectorRepeatable() {
  // Drop the old wall-clock scheduler if this Redis still carries one from
  // a previous deploy; leaving it would keep firing on the dead 00:05
  // schedule alongside the interval.
  await overdueQueue.removeJobScheduler("flag-overdue-daily").catch(() => undefined);

  return overdueQueue.upsertJobScheduler(
    "flag-overdue-recurring",
    { every: OVERDUE_SWEEP_INTERVAL_MS },
    { name: "flag-overdue" }
  );
}

export function enqueueOverdueDetectorNow() {
  return overdueQueue.add("flag-overdue", {});
}

/**
 * How often to look at the linked Google Sheets.
 *
 * An interval rather than a wall-clock schedule, for the same reason as the
 * overdue sweep: the office PC is switched off overnight, so anything tied
 * to a clock time would simply be missed. Ten minutes is well inside what
 * "picks up new rows automatically" needs to mean, and each poll is one
 * cheap read per sheet.
 */
export const LEAD_SHEET_POLL_INTERVAL_MS = 10 * 60 * 1000;

export async function scheduleLeadSheetPollRepeatable() {
  return leadSheetQueue.upsertJobScheduler(
    "poll-lead-sheets-recurring",
    { every: LEAD_SHEET_POLL_INTERVAL_MS },
    { name: "poll-lead-sheets" }
  );
}

/** Catch-up on boot — rows added while the machine was off are picked up at once. */
export function enqueueLeadSheetPollNow() {
  return leadSheetQueue.add("poll-lead-sheets", {});
}
