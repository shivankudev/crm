import {
  addQuickActionMedia,
  createQuickAction,
  deleteQuickAction,
  deleteQuickActionMedia,
  findQuickAction,
  findQuickActionMedia,
  listAllQuickActions,
  listEnabledQuickActions,
  reorderQuickActionMedia,
  reorderQuickActions,
  updateQuickAction,
} from "@/repositories/whatsapp-quick-action.repository";
import { findWhatsAppSessionByUserId, createWhatsAppMessageLog } from "@/repositories/whatsapp.repository";
import { getLeadForUser } from "@/services/lead.service";
import { saveFile, deleteFileByKey, readFileByKey } from "@/lib/storage";
import {
  getOpenWASession,
  mediaRouteForMimeType,
  sendOpenWALocation,
  sendOpenWAMedia,
  sendOpenWAText,
  toWhatsAppChatId,
} from "@/lib/openwa-client";
import { isWhatsAppLive } from "@/lib/whatsapp-constants";
import { can, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import type { CurrentUser } from "@/lib/auth/current-user";

export class QuickActionError extends Error {}

/** Pause between the pieces of one press, so a 8-image set isn't a single burst. */
const SEND_GAP_MS = 700;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function requireAdmin(actor: CurrentUser) {
  if (!can(actor, PERMISSIONS.SETTINGS_MANAGE) && !can(actor, PERMISSIONS.SETTINGS_MANAGE_PARTIAL)) {
    throw new ForbiddenError();
  }
}

// --- Reads -----------------------------------------------------------

/** True once a button has something — anything — to actually send. */
export function hasSomethingToSend(a: {
  text: string | null;
  latitude: number | null;
  media: unknown[];
}) {
  return Boolean(a.text) || a.media.length > 0 || a.latitude !== null;
}

/**
 * What the telecalling screen shows — any caller may read these.
 *
 * Empty buttons are withheld even when enabled: `enabled` defaults to true,
 * so a button existed on every caller's screen from the moment an admin
 * typed its label, and pressing it before they finished filling it in threw
 * "nothing configured to send yet" at the caller mid-conversation. The
 * admin editor says a button is hidden until it has content, and this is
 * what makes that true.
 */
export async function listQuickActionsForCaller() {
  const actions = await listEnabledQuickActions();
  return actions.filter(hasSomethingToSend);
}

export function listQuickActionsForAdmin(actor: CurrentUser) {
  requireAdmin(actor);
  return listAllQuickActions();
}

// --- Admin management ------------------------------------------------

export async function createQuickActionForAdmin(actor: CurrentUser, label: string) {
  requireAdmin(actor);
  const trimmed = label.trim();
  if (!trimmed) throw new QuickActionError("Give the button a label");
  return createQuickAction({ label: trimmed });
}

export async function updateQuickActionForAdmin(
  actor: CurrentUser,
  id: string,
  data: {
    label?: string;
    text?: string | null;
    enabled?: boolean;
    latitude?: number | null;
    longitude?: number | null;
    locationName?: string | null;
  }
) {
  requireAdmin(actor);
  const existing = await findQuickAction(id);
  if (!existing) throw new QuickActionError("That button no longer exists");

  // A pin needs both halves or neither — half a coordinate would be sent as
  // a location to nowhere.
  //
  // `!== undefined` rather than `??`: the caller passes an explicit null to
  // CLEAR a coordinate, and `??` treats null as "not supplied" and silently
  // falls back to the stored value — so clearing one half appeared to work
  // while the old number was quietly kept.
  const lat = data.latitude !== undefined ? data.latitude : existing.latitude;
  const lng = data.longitude !== undefined ? data.longitude : existing.longitude;
  if ((lat === null) !== (lng === null)) {
    throw new QuickActionError("A location needs both latitude and longitude");
  }
  if (lat !== null && (lat < -90 || lat > 90)) throw new QuickActionError("Latitude must be between -90 and 90");
  if (lng !== null && (lng < -180 || lng > 180)) throw new QuickActionError("Longitude must be between -180 and 180");

  return updateQuickAction(id, data);
}

export async function deleteQuickActionForAdmin(actor: CurrentUser, id: string) {
  requireAdmin(actor);
  const existing = await findQuickAction(id);
  if (!existing) throw new QuickActionError("That button no longer exists");
  // Remove the files before the rows that point at them, or the keys are lost.
  for (const m of existing.media) await deleteFileByKey(m.mediaKey).catch(() => undefined);
  await deleteQuickAction(id);
}

export async function addQuickActionMediaForAdmin(
  actor: CurrentUser,
  id: string,
  files: { buffer: Buffer; fileName: string; mimeType: string }[]
) {
  requireAdmin(actor);
  const existing = await findQuickAction(id);
  if (!existing) throw new QuickActionError("That button no longer exists");

  const saved: { mediaKey: string; fileName: string; mimeType: string }[] = [];
  for (const f of files) {
    const { key } = await saveFile(`whatsapp-quick-actions/${id}`, f.fileName, f.buffer);
    saved.push({ mediaKey: key, fileName: f.fileName, mimeType: f.mimeType });
  }
  await addQuickActionMedia(id, saved);
  return findQuickAction(id);
}

/**
 * Streams one attachment back to the admin editor so it can show a real
 * thumbnail. Filenames off a phone ("IMG_20250814_112233.jpg") tell an
 * admin nothing about which photo they attached, and attaching the wrong
 * product shot is invisible until a lead receives it.
 */
export async function readQuickActionMediaForAdmin(actor: CurrentUser, mediaId: string) {
  requireAdmin(actor);
  const media = await findQuickActionMedia(mediaId);
  if (!media) throw new QuickActionError("That attachment no longer exists");
  return { data: await readFileByKey(media.mediaKey), fileName: media.fileName, mimeType: media.mimeType };
}

/** Moves a button one place along the row the callers see. */
export async function moveQuickActionForAdmin(actor: CurrentUser, id: string, direction: "up" | "down") {
  requireAdmin(actor);
  const all = await listAllQuickActions();
  const ids = moveWithin(all.map((a) => a.id), id, direction);
  if (!ids) throw new QuickActionError("That button no longer exists");
  await reorderQuickActions(ids);
}

/** Moves an attachment within its button — this is the order it's sent in. */
export async function moveQuickActionMediaForAdmin(
  actor: CurrentUser,
  mediaId: string,
  direction: "up" | "down"
) {
  requireAdmin(actor);
  const media = await findQuickActionMedia(mediaId);
  if (!media) throw new QuickActionError("That attachment no longer exists");
  const action = await findQuickAction(media.quickActionId);
  const ids = moveWithin(action?.media.map((m) => m.id) ?? [], mediaId, direction);
  if (!ids) throw new QuickActionError("That attachment no longer exists");
  await reorderQuickActionMedia(ids);
}

/** Returns the list with `id` shifted one step, or null if it isn't there. */
function moveWithin(ids: string[], id: string, direction: "up" | "down"): string[] | null {
  const from = ids.indexOf(id);
  if (from === -1) return null;
  const to = direction === "up" ? from - 1 : from + 1;
  if (to < 0 || to >= ids.length) return ids; // already at the end — a no-op, not an error
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

export async function removeQuickActionMediaForAdmin(actor: CurrentUser, mediaId: string) {
  requireAdmin(actor);
  const media = await findQuickActionMedia(mediaId);
  if (!media) throw new QuickActionError("That attachment no longer exists");
  await deleteFileByKey(media.mediaKey).catch(() => undefined);
  await deleteQuickActionMedia(mediaId);
}

// --- Sending ---------------------------------------------------------

/**
 * Fires one quick-action button at a lead: caption/text first, then every
 * attachment in order, then the location pin.
 *
 * Unlike the automatic templates this is NOT fire-and-forget — the caller
 * pressed a button and is waiting to know it went, so errors surface to
 * them instead of being swallowed. Each piece is logged separately, so a
 * set that half-fails is visible rather than looking like one atomic send
 * that "worked".
 */
export async function sendQuickAction(actor: CurrentUser, quickActionId: string, leadId: string) {
  if (!can(actor, PERMISSIONS.LEADS_CALL_LOG)) throw new ForbiddenError();

  const lead = await getLeadForUser(leadId, actor); // enforces visibility
  const action = await findQuickAction(quickActionId);
  if (!action || !action.enabled) throw new QuickActionError("That button is no longer available");
  if (!action.text && action.media.length === 0 && action.latitude === null) {
    throw new QuickActionError("This button has nothing configured to send yet");
  }

  const session = await findWhatsAppSessionByUserId(actor.id);
  if (!session) throw new QuickActionError("Connect your WhatsApp first — nothing can be sent yet");

  if (!isWhatsAppLive(session.status)) {
    const live = await getOpenWASession(session.openwaSessionId).catch(() => null);
    if (!isWhatsAppLive(live?.status)) {
      throw new QuickActionError(
        `Your WhatsApp is ${live?.status ?? session.status} — reconnect it before sending`
      );
    }
  }

  const chatId = toWhatsAppChatId(lead.phone);
  const logBase = {
    userId: actor.id,
    leadId,
    triggerType: "QUICK_ACTION",
    triggerKey: action.label,
    phone: lead.phone,
  };

  let sent = 0;
  const failures: string[] = [];

  async function step(messageType: string, run: () => Promise<{ messageId?: string }>) {
    try {
      const res = await run();
      await createWhatsAppMessageLog({ ...logBase, messageType, waMessageId: res?.messageId ?? null, status: "SENT" });
      sent++;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await createWhatsAppMessageLog({ ...logBase, messageType, status: "FAILED", error: message }).catch(
        () => undefined
      );
      failures.push(message);
    }
    await sleep(SEND_GAP_MS);
  }

  // Text goes on its own when there is media, rather than as a caption on
  // the first image — with a set of photos a single leading message reads
  // better than a caption buried on one of them.
  if (action.text) {
    await step("text", () => sendOpenWAText(session.openwaSessionId, chatId, action.text!));
  }

  for (const m of action.media) {
    await step(mediaRouteForMimeType(m.mimeType).replace("send-", ""), async () => {
      const buffer = await readFileByKey(m.mediaKey);
      return sendOpenWAMedia(session.openwaSessionId, mediaRouteForMimeType(m.mimeType), {
        chatId,
        base64: buffer.toString("base64"),
        mimetype: m.mimeType,
        filename: m.fileName,
      });
    });
  }

  if (action.latitude !== null && action.longitude !== null) {
    await step("location", () =>
      sendOpenWALocation(session.openwaSessionId, {
        chatId,
        latitude: action.latitude!,
        longitude: action.longitude!,
        description: action.locationName ?? undefined,
      })
    );
  }

  if (sent === 0) throw new QuickActionError(failures[0] ?? "Nothing could be sent");
  return { sent, failed: failures.length };
}
