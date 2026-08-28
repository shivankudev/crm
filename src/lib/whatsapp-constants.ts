// Dependency-free — safe to import from Client Components. The real
// trigger logic lives in whatsapp.service.ts (which imports node:fs,
// Prisma, etc.), so these keys are pulled out on their own here rather
// than importing that server-only module into client code.
export const WA_TRIGGER_OUTCOME = "OUTCOME";
export const WA_TRIGGER_CADENCE_STEP = "CADENCE_STEP";

/**
 * OpenWA's SessionStatus enum, mirrored (session.entity.ts):
 *   created | initializing | qr_ready | authenticating | ready
 *   | disconnected | action_required | failed
 *
 * Note the linked-and-usable state is **"ready"**, NOT "connected" —
 * OpenWA has no "connected" status. Comparing against "connected" silently
 * matches nothing, which means a fully linked device looks offline and
 * every message is skipped.
 */
export const WA_STATUS_READY = "ready";

/** Statuses that mean the device is linked and can actually send. */
export function isWhatsAppLive(status: string | null | undefined): boolean {
  return status === WA_STATUS_READY;
}

/**
 * Still working toward a link — worth polling for a QR / status change.
 * Anything else is either done (ready) or stuck in a way another poll
 * won't fix (disconnected / failed / action_required).
 */
export function isWhatsAppPending(status: string | null | undefined): boolean {
  return status === "created" || status === "initializing" || status === "qr_ready" || status === "authenticating";
}
