/**
 * Thin HTTP client for the OpenWA gateway (/Users/shivankusehgal/Downloads/OpenWA
 * — a separate, self-hosted WhatsApp API service, not part of this repo).
 * One OpenWA "session" per telecaller — see WhatsAppSession in schema.prisma.
 *
 * OpenWA runs on unofficial WhatsApp Web automation (whatsapp-web.js /
 * Baileys), not Meta's Business API — sending is not guaranteed and a
 * number can be rate-limited or banned by WhatsApp if it looks automated.
 * Callers should treat every send as best-effort (log and move on, never
 * block or fail the caller's own action on a WhatsApp error).
 */

import { readFileSync } from "node:fs";

const BASE_URL = process.env.OPENWA_BASE_URL ?? "http://localhost:2785";

/**
 * Where OpenWA writes the API key it generates on first boot. In
 * docker-compose the same `openwa_data` volume is mounted read-only into
 * web/worker at this path, so the CRM can just read the key rather than
 * making someone copy it between two services by hand — a setup step that
 * is easy to skip and silently breaks every WhatsApp send until noticed.
 */
const KEY_FILE = process.env.OPENWA_API_KEY_FILE ?? "/openwa-data/.api-key";

/**
 * Resolved lazily and cached: an explicit OPENWA_API_KEY always wins (so a
 * hosted gateway or a hand-issued scoped key still works), otherwise fall
 * back to the shared key file.
 *
 * A miss is deliberately NOT cached — on a cold start the CRM can easily
 * come up before OpenWA has written the file, and caching "" there would
 * leave this process permanently unable to authenticate until it was
 * restarted. Re-reading on the next call lets it heal on its own.
 */
let cachedKey: string | null = null;

function resolveApiKey(): string {
  if (cachedKey) return cachedKey;

  const fromEnv = process.env.OPENWA_API_KEY?.trim();
  if (fromEnv) {
    cachedKey = fromEnv;
    return cachedKey;
  }

  try {
    // Sync read: it happens at most once per process, on the cold path.
    //
    // turbopackIgnore keeps the build from statically tracing this read —
    // without it Turbopack assumes the path could be anything and pulls the
    // WHOLE project (including public/) into the server bundle, bloating the
    // standalone output that ships to the mini PC. KEY_FILE is a deploy-time
    // path inside a mounted volume, never a source file.
    const fromFile = readFileSync(/*turbopackIgnore: true*/ KEY_FILE, "utf8").trim();
    if (fromFile) {
      cachedKey = fromFile;
      return cachedKey;
    }
  } catch {
    // Not mounted, not written yet, or not readable — fall through.
  }
  return "";
}

export class OpenWAError extends Error {
  constructor(
    message: string,
    public status?: number
  ) {
    super(message);
    this.name = "OpenWAError";
  }
}

/**
 * A wedged engine is the dangerous failure mode, not a down one: OpenWA can
 * report `status: "ready"` with `engineLoaded: true` while its underlying
 * browser session can no longer send, and a send to it then never answers
 * at all. Without a deadline these calls hang forever — and because sends
 * are fire-and-forget (`void sendWhatsApp…`), each one would leak a pending
 * promise, hold its media buffer in memory, and never write a log row, so
 * the failure stays invisible. Media uploads get a longer budget than
 * control calls since they actually carry bytes.
 */
const REQUEST_TIMEOUT_MS = 20_000;
const MEDIA_TIMEOUT_MS = 60_000;

async function request<T>(path: string, init?: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const apiKey = resolveApiKey();
  if (!apiKey) {
    throw new OpenWAError(
      "WhatsApp gateway key not available yet — set OPENWA_API_KEY, or wait for the gateway to finish starting"
    );
  }

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey, ...init?.headers },
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new OpenWAError(
        `WhatsApp gateway did not respond within ${Math.round(timeoutMs / 1000)}s — the session may be stuck; restart it from the WhatsApp page`
      );
    }
    throw new OpenWAError(error instanceof Error ? error.message : "WhatsApp gateway is unreachable");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new OpenWAError(body.message ?? `OpenWA request failed (${res.status})`, res.status);
  }
  return res.json();
}

export type OpenWASession = {
  id: string;
  name: string;
  status: string;
  phone: string | null;
};

export function createOpenWASession(name: string) {
  return request<OpenWASession>("/api/sessions", { method: "POST", body: JSON.stringify({ name }) });
}

export function startOpenWASession(sessionId: string) {
  return request<OpenWASession>(`/api/sessions/${sessionId}/start`, { method: "POST" });
}

export function stopOpenWASession(sessionId: string) {
  return request<OpenWASession>(`/api/sessions/${sessionId}/stop`, { method: "POST" });
}

export function logoutOpenWASession(sessionId: string) {
  return request<OpenWASession>(`/api/sessions/${sessionId}/logout`, { method: "POST" });
}

export function getOpenWASession(sessionId: string) {
  return request<OpenWASession>(`/api/sessions/${sessionId}`);
}

export function getOpenWAQr(sessionId: string) {
  return request<{ qrCode: string; status: string }>(`/api/sessions/${sessionId}/qr`);
}

/** Every send route answers with the engine's own message id (plus a timestamp). */
export type OpenWASendResult = { messageId?: string; timestamp?: number };

/** `chatId` is `<digits>@c.us` — see toWhatsAppChatId() below. */
export function sendOpenWAText(sessionId: string, chatId: string, text: string) {
  return request<OpenWASendResult>(`/api/sessions/${sessionId}/messages/send-text`, {
    method: "POST",
    body: JSON.stringify({ chatId, text }),
  });
}

export type OpenWAStoredMessage = {
  waMessageId: string;
  /** sent | delivered | read | failed — advances asynchronously via WhatsApp acks. */
  status: string;
};

/**
 * Recent messages for a session, used to resolve delivery state. OpenWA's
 * send response (201) is explicitly NOT a delivery confirmation — neither
 * engine has one — so the only real signal is this stored row's `status`,
 * which advances as WhatsApp acks arrive.
 */
export function listOpenWAMessages(sessionId: string, limit = 100) {
  return request<{ messages: OpenWAStoredMessage[] }>(
    `/api/sessions/${sessionId}/messages?limit=${limit}`
  );
}

export function sendOpenWAMedia(
  sessionId: string,
  route: "send-image" | "send-video" | "send-document",
  input: { chatId: string; base64: string; mimetype: string; filename: string; caption?: string }
) {
  return request<OpenWASendResult>(
    `/api/sessions/${sessionId}/messages/${route}`,
    { method: "POST", body: JSON.stringify(input) },
    MEDIA_TIMEOUT_MS
  );
}

export function sendOpenWALocation(
  sessionId: string,
  input: { chatId: string; latitude: number; longitude: number; description?: string }
) {
  return request<OpenWASendResult>(`/api/sessions/${sessionId}/messages/send-location`, {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/** Maps a stored media mimetype to the OpenWA send route for it. */
export function mediaRouteForMimeType(mimeType: string): "send-image" | "send-video" | "send-document" {
  if (mimeType.startsWith("image/")) return "send-image";
  if (mimeType.startsWith("video/")) return "send-video";
  return "send-document";
}

/**
 * CRM phone numbers are stored as bare digits, typically a 10-digit
 * Indian local number with no country code (§ INDIAN_STATES — this is an
 * India-only CRM). WhatsApp chat IDs need the full number with country
 * code. A number already longer than 10 digits is assumed to already
 * carry one and is used as-is.
 */
export function toWhatsAppChatId(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const withCountryCode = digits.length === 10 ? `91${digits}` : digits;
  return `${withCountryCode}@c.us`;
}
