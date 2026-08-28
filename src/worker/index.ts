import { Worker } from "bullmq";
import { redisConnection } from "@/lib/redis";
import {
  QUEUE_NAMES,
  enqueueOverdueDetectorNow,
  enqueueLeadSheetPollNow,
  scheduleOverdueDetectorRepeatable,
  scheduleLeadSheetPollRepeatable,
  type ScheduleNextFollowUpJob,
} from "@/lib/queues";
import { scheduleNextFollowUpForLead } from "@/services/followup.service";
import { flagOverdueFollowUps } from "@/repositories/followup.repository";
import { todayUTC } from "@/lib/date";
import { syncAllLeadSheets } from "@/services/lead-sheet.service";
import { getSystemActor } from "@/lib/system-actor";

/**
 * BullMQ worker process (docker-compose service "worker" / `npm run worker`).
 *
 * Two real queues now (Phase 2 — Leads & Follow-ups):
 *   - "followup-scheduler": creates the next FollowUp row per the configured
 *     rule sequence (§4/§6), enqueued from lead/followup services.
 *   - "overdue-detector": daily repeatable job that flags PENDING follow-ups
 *     past their scheduled date as OVERDUE (§6).
 *
 * "notifications" lands in a later phase.
 */
const followUpWorker = new Worker<ScheduleNextFollowUpJob>(
  QUEUE_NAMES.FOLLOWUP_SCHEDULER,
  async (job) => {
    if (job.name !== "schedule-next" || !job.data.leadId) return;
    const created = await scheduleNextFollowUpForLead(
      job.data.leadId,
      job.data.sequenceNumber,
      job.data.notifyViaWhatsApp
    );
    console.log(
      created
        ? `[worker] scheduled follow-up #${job.data.sequenceNumber} for lead ${job.data.leadId}`
        : `[worker] skipped follow-up #${job.data.sequenceNumber} for lead ${job.data.leadId} (closed, already active, or no rule)`
    );
  },
  { connection: redisConnection }
);

const overdueWorker = new Worker(
  QUEUE_NAMES.OVERDUE_DETECTOR,
  async () => {
    const result = await flagOverdueFollowUps(todayUTC());
    console.log(`[worker] flagged ${result.count} follow-up(s) as OVERDUE`);
  },
  { connection: redisConnection }
);

/**
 * Pulls new rows from every enabled Google Sheet. Runs as a Super Admin
 * (see getSystemActor) because the lead-creation path is written for a real
 * signed-in actor — it stamps createdBy and needs someone whose visibility
 * covers every lead it might touch.
 */
const leadSheetWorker = new Worker(
  QUEUE_NAMES.LEAD_SHEET_POLLER,
  async () => {
    const actor = await getSystemActor();
    if (!actor) {
      console.error("[worker] no active Super Admin to run the sheet import as — skipping");
      return;
    }
    const results = await syncAllLeadSheets(actor);
    for (const r of results) {
      if (r.error) console.error(`[worker] sheet "${r.name}": ${r.error}`);
      else if (r.rowsRead > 0)
        console.log(
          `[worker] sheet "${r.name}": ${r.created} created, ${r.skippedDuplicate} duplicate, ${r.skippedInvalid} unusable, ${r.failed} failed`
        );
    }
  },
  { connection: redisConnection }
);

for (const worker of [followUpWorker, overdueWorker, leadSheetWorker]) {
  worker.on("ready", () => console.log(`[worker] "${worker.name}" connected, listening for jobs…`));
  worker.on("failed", (job, err) => console.error(`[worker] "${worker.name}" job ${job?.id} failed:`, err));
}

scheduleOverdueDetectorRepeatable()
  .then(() => console.log('[worker] registered hourly "flag-overdue" sweep (interval, not wall-clock)'))
  .catch((err) => console.error("[worker] failed to register repeatable job:", err));

// Catch-up sweep on every boot — the other half of the no-fixed-time
// design. The host is powered off overnight, so the first thing that must
// happen each morning is reconciling everything that fell overdue while it
// was off, however long that was: one night, a weekend, or a holiday.
enqueueOverdueDetectorNow()
  .then(() => console.log('[worker] queued startup "flag-overdue" catch-up sweep'))
  .catch((err) => console.error("[worker] failed to queue startup sweep:", err));

scheduleLeadSheetPollRepeatable()
  .then(() => console.log("[worker] registered lead-sheet poll (every 5 min)"))
  .catch((err) => console.error("[worker] failed to register sheet poll:", err));

// Same catch-up reasoning: rows added to a sheet overnight should land as
// soon as the machine is back, not up to ten minutes later.
enqueueLeadSheetPollNow()
  .then(() => console.log("[worker] queued startup lead-sheet catch-up poll"))
  .catch((err) => console.error("[worker] failed to queue startup sheet poll:", err));

process.on("SIGTERM", async () => {
  await Promise.all([followUpWorker.close(), overdueWorker.close(), leadSheetWorker.close()]);
  process.exit(0);
});
