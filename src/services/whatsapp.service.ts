import {
  countWhatsAppMessagesByStatus,
  createWhatsAppMessageLog,
  deleteWhatsAppConfigForUser,
  findWhatsAppSessionByUserId,
  findWhatsAppTemplate,
  listPendingWhatsAppMessageLogs,
  listWhatsAppMessageLogs,
  listWhatsAppTemplatesForUser,
  updateWhatsAppMessageLogStatus,
  upsertWhatsAppSession,
  upsertWhatsAppTemplate,
} from "@/repositories/whatsapp.repository";
import { saveFile, deleteFileByKey, readFileByKey } from "@/lib/storage";
import {
  createOpenWASession,
  getOpenWAQr,
  getOpenWASession,
  listOpenWAMessages,
  logoutOpenWASession,
  mediaRouteForMimeType,
  OpenWAError,
  sendOpenWAMedia,
  sendOpenWAText,
  startOpenWASession,
  stopOpenWASession,
  toWhatsAppChatId,
} from "@/lib/openwa-client";
import { WA_TRIGGER_OUTCOME, WA_TRIGGER_CADENCE_STEP, isWhatsAppLive } from "@/lib/whatsapp-constants";
import { listCallers } from "@/repositories/user.repository";
import { can, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import type { CurrentUser } from "@/lib/auth/current-user";

export { WA_TRIGGER_OUTCOME, WA_TRIGGER_CADENCE_STEP };

export class WhatsAppServiceError extends Error {}

/**
 * §"every telecaller gets its own QR code" — one OpenWA session per user,
 * named deterministically so a re-connect after a browser refresh finds
 * the same session instead of minting a new one every time.
 */
function sessionNameForUser(userId: string) {
  return `gatti-telecaller-${userId}`;
}

/**
 * Reads the live status from OpenWA and re-syncs our mirror row, rather
 * than trusting the cached one. This is what makes a restart honest: after
 * OpenWA reboots and auto-starts an already-authenticated session, our row
 * still holds whatever was true before the restart. Re-reading picks the
 * device back up (status + phone) with no user action, and equally avoids
 * showing a confident "Connected" for a session that did NOT come back.
 *
 * Falls back to the cached row when OpenWA itself is unreachable — the
 * dashboard should degrade to slightly-stale, never to a hard error.
 */
export async function getWhatsAppStatusForUser(actor: CurrentUser) {
  const session = await findWhatsAppSessionByUserId(actor.id);
  if (!session) return null;

  const live = await getOpenWASession(session.openwaSessionId).catch(() => null);
  if (!live) return session;

  return upsertWhatsAppSession(actor.id, {
    openwaSessionId: session.openwaSessionId,
    status: live.status,
    phone: live.phone,
  });
}

/**
 * Creates (if needed) and starts this user's OpenWA session, returning its QR.
 *
 * Starting is treated as idempotent. The gateway rejects a start on a
 * session whose engine is already running — including one sitting in
 * `disconnected` while it retries — and that rejection used to surface as
 * a 502 "Session is already started", leaving a telecaller unable to get
 * back to a QR from the Connect button. Wanting a started session and
 * finding it already started is success, not failure.
 */
export async function connectWhatsAppForUser(actor: CurrentUser) {
  let session = await findWhatsAppSessionByUserId(actor.id);

  if (!session) {
    const created = await createOpenWASession(sessionNameForUser(actor.id));
    session = await upsertWhatsAppSession(actor.id, { openwaSessionId: created.id, status: created.status });
  }

  try {
    const started = await startOpenWASession(session.openwaSessionId);
    await upsertWhatsAppSession(actor.id, { openwaSessionId: session.openwaSessionId, status: started.status });
  } catch (error) {
    if (!isAlreadyStartedError(error)) throw error;
    // Already running — fall through and read its live status/QR below.
  }

  return getQrForUser(actor);
}

/** The gateway's "you asked me to start something already running" refusal. */
function isAlreadyStartedError(error: unknown) {
  return error instanceof OpenWAError && /already\s+started/i.test(error.message);
}

/** Polls the current QR — a fresh scan target while status is "qr_ready", or a status-only read otherwise. */
export async function getQrForUser(actor: CurrentUser) {
  const session = await findWhatsAppSessionByUserId(actor.id);
  if (!session) throw new WhatsAppServiceError("WhatsApp isn't connected for this account yet");

  try {
    const qr = await getOpenWAQr(session.openwaSessionId);
    await upsertWhatsAppSession(actor.id, { openwaSessionId: session.openwaSessionId, status: qr.status });
    return { qrCode: qr.qrCode, status: qr.status, gatewayReachable: true };
  } catch (error) {
    // No QR to hand back — either already authenticated, or the engine is
    // still booting after a start/refresh. Not an error the settings page
    // should have to special-case, but the *live* status has to be read
    // from OpenWA rather than echoing our cached row: a stop+start leaves
    // the cached value at "qr_ready" while the engine is really back at
    // "initializing", which would tell the user to scan a QR that doesn't
    // exist yet and never resolve.
    if (error instanceof OpenWAError) {
      const live = await getOpenWASession(session.openwaSessionId).catch(() => null);
      const status = live?.status ?? session.status;
      if (live) {
        await upsertWhatsAppSession(actor.id, {
          openwaSessionId: session.openwaSessionId,
          status,
          phone: live.phone,
        });
        return { qrCode: null, status, gatewayReachable: true };
      }
      // Neither call reached the gateway. Saying nothing here left the
      // screen showing a stale "Scan to connect" above an empty space, with
      // no hint that the problem was the gateway rather than the code — so
      // the telecaller waits for a QR that is never coming.
      return { qrCode: null, status, gatewayReachable: false };
    }
    throw error;
  }
}

/** Full session restart — the reliable way to force a brand-new QR rather than trust the old one is still valid. */
export async function refreshQrForUser(actor: CurrentUser) {
  const session = await findWhatsAppSessionByUserId(actor.id);
  if (!session) throw new WhatsAppServiceError("WhatsApp isn't connected for this account yet");

  await stopOpenWASession(session.openwaSessionId).catch(() => undefined); // already stopped is fine
  const started = await startOpenWASession(session.openwaSessionId);
  await upsertWhatsAppSession(actor.id, { openwaSessionId: session.openwaSessionId, status: started.status });

  return getQrForUser(actor);
}

export async function logoutWhatsAppForUser(actor: CurrentUser) {
  const session = await findWhatsAppSessionByUserId(actor.id);
  if (!session) throw new WhatsAppServiceError("WhatsApp isn't connected for this account yet");

  const result = await logoutOpenWASession(session.openwaSessionId);
  return upsertWhatsAppSession(actor.id, {
    openwaSessionId: session.openwaSessionId,
    status: result.status,
    phone: null,
  });
}

/**
 * Removes a user's WhatsApp *configuration* — the linked session and their
 * templates (plus the media those templates own) — when the account itself
 * is deleted.
 *
 * Config, unlike sent-message history, must never block deleting a user:
 * without this, deleting someone who linked WhatsApp but hadn't sent
 * anything yet failed on a raw foreign-key violation that surfaced as a
 * 500 instead of the friendly "deactivate them instead" guard.
 *
 * The OpenWA-side unlink is best-effort on purpose: it's a network call to
 * a separate service, and a gateway that's down must not make it
 * impossible to remove a departing employee from the CRM. It is attempted
 * first, though, so a leaver's device doesn't stay linked to a session
 * nobody owns.
 */
export async function purgeWhatsAppDataForUser(userId: string) {
  const session = await findWhatsAppSessionByUserId(userId);
  if (session) {
    await logoutOpenWASession(session.openwaSessionId).catch(() => undefined);
  }

  const templates = await listWhatsAppTemplatesForUser(userId);
  for (const t of templates) {
    if (t.mediaKey) await deleteFileByKey(t.mediaKey).catch(() => undefined);
  }

  await deleteWhatsAppConfigForUser(userId);
}

// --- Templates ------------------------------------------------------

/** One template for the acting user — scoped read used by the save-time validation. */
export async function findWhatsAppTemplateFor(actor: CurrentUser, triggerType: string, triggerKey: string) {
  return findWhatsAppTemplate(actor.id, triggerType, triggerKey);
}

export async function listWhatsAppTemplatesFor(actor: CurrentUser) {
  return listWhatsAppTemplatesForUser(actor.id);
}

export async function upsertWhatsAppTemplateFor(
  actor: CurrentUser,
  input: {
    triggerType: string;
    triggerKey: string;
    text?: string;
    enabled?: boolean;
    media?: { buffer: Buffer; fileName: string; mimeType: string } | null; // null = remove existing media, undefined = leave as-is
  }
) {
  const existing = await findWhatsAppTemplate(actor.id, input.triggerType, input.triggerKey);

  let mediaFields: { mediaKey?: string | null; mediaFileName?: string | null; mediaMimeType?: string | null } = {};
  if (input.media === null) {
    if (existing?.mediaKey) await deleteFileByKey(existing.mediaKey);
    mediaFields = { mediaKey: null, mediaFileName: null, mediaMimeType: null };
  } else if (input.media) {
    if (existing?.mediaKey) await deleteFileByKey(existing.mediaKey);
    const { key } = await saveFile(`whatsapp-templates/${actor.id}`, input.media.fileName, input.media.buffer);
    mediaFields = { mediaKey: key, mediaFileName: input.media.fileName, mediaMimeType: input.media.mimeType };
  }

  return upsertWhatsAppTemplate(actor.id, input.triggerType, input.triggerKey, {
    text: input.text,
    enabled: input.enabled,
    ...mediaFields,
  });
}

/**
 * Everyone the admin can push templates to: active telecallers.
 *
 * Scoped by ROLE rather than by "has a WhatsApp session", so an admin can
 * write a new hire's templates before that person has ever scanned a QR —
 * the rows are waiting the moment they link.
 */
export async function listTemplateTargets(actor: CurrentUser) {
  requireTemplateAdmin(actor);
  return listCallers();
}

function requireTemplateAdmin(actor: CurrentUser) {
  if (!can(actor, PERMISSIONS.SETTINGS_MANAGE) && !can(actor, PERMISSIONS.SETTINGS_MANAGE_PARTIAL)) {
    throw new ForbiddenError();
  }
}

/**
 * Admin-side template write. Templates are configured centrally rather than
 * by each telecaller, so the business controls exactly what goes out under
 * its name — a telecaller only links their device.
 *
 * `applyToAll` fans the same template out to every active telecaller,
 * overwriting whatever each of them had for that trigger. Media is saved
 * once per user (each row owns its own copy of the file) so that deleting
 * one person's template can never pull the attachment out from under
 * everyone else's.
 */
export async function upsertTemplateForTargets(
  actor: CurrentUser,
  input: {
    triggerType: string;
    triggerKey: string;
    text?: string;
    enabled?: boolean;
    media?: { buffer: Buffer; fileName: string; mimeType: string } | null;
    applyToAll: boolean;
    targetUserId?: string;
  }
) {
  requireTemplateAdmin(actor);

  const callers = await listCallers();

  let targetIds: string[];
  if (input.applyToAll) {
    targetIds = callers.map((u) => u.id);
  } else {
    if (!input.targetUserId) throw new WhatsAppServiceError("Pick a telecaller, or choose all telecallers");
    // Check the target is a real, active telecaller before writing. Without
    // this an unknown id fell straight through to a foreign-key violation
    // that surfaced as a 500, and a valid-but-non-telecaller id would have
    // quietly given someone templates they can never use.
    if (!callers.some((u) => u.id === input.targetUserId)) {
      throw new WhatsAppServiceError("That telecaller no longer exists or is inactive");
    }
    targetIds = [input.targetUserId];
  }
  if (targetIds.length === 0) throw new WhatsAppServiceError("There are no active telecallers to apply this to");

  for (const userId of targetIds) {
    const existing = await findWhatsAppTemplate(userId, input.triggerType, input.triggerKey);

    let mediaFields: { mediaKey?: string | null; mediaFileName?: string | null; mediaMimeType?: string | null } = {};
    if (input.media === null) {
      if (existing?.mediaKey) await deleteFileByKey(existing.mediaKey).catch(() => undefined);
      mediaFields = { mediaKey: null, mediaFileName: null, mediaMimeType: null };
    } else if (input.media) {
      if (existing?.mediaKey) await deleteFileByKey(existing.mediaKey).catch(() => undefined);
      const { key } = await saveFile(`whatsapp-templates/${userId}`, input.media.fileName, input.media.buffer);
      mediaFields = { mediaKey: key, mediaFileName: input.media.fileName, mediaMimeType: input.media.mimeType };
    }

    await upsertWhatsAppTemplate(userId, input.triggerType, input.triggerKey, {
      text: input.text,
      enabled: input.enabled,
      ...mediaFields,
    });
  }

  return { appliedTo: targetIds.length };
}

/** Admin view of one telecaller's configured templates. */
export async function listTemplatesForTarget(actor: CurrentUser, targetUserId: string) {
  requireTemplateAdmin(actor);
  const callers = await listCallers();
  if (!callers.some((u) => u.id === targetUserId)) {
    throw new WhatsAppServiceError("That telecaller no longer exists or is inactive");
  }
  return listWhatsAppTemplatesForUser(targetUserId);
}

// --- Delivery status -------------------------------------------------

const OPENWA_STATUS_TO_LOG: Record<string, string> = {
  sent: "SENT",
  delivered: "DELIVERED",
  read: "READ",
  failed: "FAILED",
};

/**
 * Resolves DELIVERED/READ for messages still sitting at SENT. WhatsApp acks
 * arrive asynchronously well after the send returns, so this is pulled on
 * read (dashboard load) rather than pushed — no inbound webhook endpoint to
 * expose, register, or keep healthy, at the cost of the status being as
 * fresh as the last dashboard visit.
 *
 * Best-effort like the sends themselves: a gateway that's down leaves the
 * statuses untouched rather than failing the page.
 */
export async function refreshWhatsAppDeliveryStatuses(actor: CurrentUser) {
  const session = await findWhatsAppSessionByUserId(actor.id);
  if (!session) return;

  const pending = await listPendingWhatsAppMessageLogs(actor.id);
  if (pending.length === 0) return;

  const stored = await listOpenWAMessages(session.openwaSessionId, 200).catch(() => null);
  if (!stored) return;

  const byId = new Map(stored.messages.map((m) => [m.waMessageId, m.status]));
  for (const row of pending) {
    const live = row.waMessageId ? byId.get(row.waMessageId) : undefined;
    const mapped = live ? OPENWA_STATUS_TO_LOG[live] : undefined;
    if (mapped && mapped !== row.status) {
      await updateWhatsAppMessageLogStatus(row.id, mapped);
    }
  }
}

export async function getWhatsAppMessageHistory(actor: CurrentUser, limit = 20) {
  return listWhatsAppMessageLogs(actor.id, limit);
}

/** Rolling 24h counts by status, for the dashboard's summary line. */
export async function getWhatsAppDeliverySummary(actor: CurrentUser) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return countWhatsAppMessagesByStatus(actor.id, since);
}

// --- Sending (best-effort, never throws to the caller) --------------

async function sendTemplate(
  userId: string,
  phone: string,
  triggerType: string,
  triggerKey: string,
  leadId?: string | null
) {
  const template = await findWhatsAppTemplate(userId, triggerType, triggerKey);
  // Nothing configured for this trigger is a normal, silent no-op — not a
  // failure, and not worth a log row (it would drown the real ones).
  if (!template || !template.enabled) return;
  if (!template.text && !template.mediaKey) return;

  const messageType =
    template.mediaKey && template.mediaMimeType
      ? mediaRouteForMimeType(template.mediaMimeType).replace("send-", "")
      : "text";
  const logBase = { userId, leadId, triggerType, triggerKey, phone, messageType };

  try {
    const session = await findWhatsAppSessionByUserId(userId);
    if (!session) {
      // Recorded, not silent: a telecaller who never linked WhatsApp needs
      // to see WHY their messages aren't going out.
      await createWhatsAppMessageLog({
        ...logBase,
        status: "SKIPPED_NOT_CONNECTED",
        error: "WhatsApp is not connected for this account",
      });
      return;
    }

    // Trust a cached live status (the overwhelmingly common case — no
    // extra round-trip on the hot path), but re-check anything else
    // against OpenWA before giving up: after a gateway restart the
    // session auto-starts and reconnects on its own, and our mirror row
    // stays stale until something reads it. Skipping on that stale value
    // would silently drop every message until a human happened to open
    // the dashboard.
    if (!isWhatsAppLive(session.status)) {
      const live = await getOpenWASession(session.openwaSessionId).catch(() => null);
      if (!isWhatsAppLive(live?.status)) {
        await createWhatsAppMessageLog({
          ...logBase,
          status: "SKIPPED_NOT_CONNECTED",
          error: `WhatsApp device is ${live?.status ?? session.status} — reconnect it to resume sending`,
        });
        return;
      }
      await upsertWhatsAppSession(userId, {
        openwaSessionId: session.openwaSessionId,
        status: live!.status,
        phone: live!.phone,
      });
    }

    const chatId = toWhatsAppChatId(phone);

    let result;
    if (template.mediaKey && template.mediaMimeType) {
      const buffer = await readFileByKey(template.mediaKey);
      result = await sendOpenWAMedia(session.openwaSessionId, mediaRouteForMimeType(template.mediaMimeType), {
        chatId,
        base64: buffer.toString("base64"),
        mimetype: template.mediaMimeType,
        filename: template.mediaFileName ?? "attachment",
        caption: template.text ?? undefined,
      });
    } else {
      result = await sendOpenWAText(session.openwaSessionId, chatId, template.text!);
    }

    // SENT, not DELIVERED: OpenWA's 201 means WhatsApp accepted the
    // message, never that it arrived. DELIVERED/READ land later as acks
    // and are picked up by refreshWhatsAppDeliveryStatuses().
    await createWhatsAppMessageLog({
      ...logBase,
      waMessageId: result?.messageId ?? null,
      status: "SENT",
    });
  } catch (error) {
    // Best-effort only — WhatsApp delivery must never block or fail the
    // telecalling action that triggered it (call logging, cadence
    // advance). Errors are swallowed here by design; visible failure
    // would mean a flaky WhatsApp link breaks core CRM workflows. The log
    // row below is what makes that swallowed failure visible to the
    // telecaller instead of vanishing into the server console.
    console.error(`[whatsapp] send failed (user=${userId}, ${triggerType}/${triggerKey}):`, error);
    await createWhatsAppMessageLog({
      ...logBase,
      status: "FAILED",
      error: error instanceof Error ? error.message : String(error),
    }).catch(() => undefined);
  }
}

/** Fires the instant a call outcome is logged — see logTelecallingOutcome(). */
export function sendWhatsAppForOutcome(userId: string, phone: string, resultName: string, leadId?: string) {
  return sendTemplate(userId, phone, WA_TRIGGER_OUTCOME, resultName, leadId);
}

/** Fires when a telecaller's call advances a lead onto a new cadence step — see scheduleNextFollowUpForLead(). */
export function sendWhatsAppForCadenceStep(
  userId: string,
  phone: string,
  sequenceNumber: number,
  leadId?: string
) {
  return sendTemplate(userId, phone, WA_TRIGGER_CADENCE_STEP, String(sequenceNumber), leadId);
}
