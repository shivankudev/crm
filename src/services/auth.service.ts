import { findUserByEmail } from "@/repositories/user.repository";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, invalidateSessionToken } from "@/lib/auth/session";
import { checkAndRecordAttempt, resetAttempts } from "@/lib/rate-limit";

export class AuthError extends Error {
  constructor(message = "Invalid email or password") {
    super(message);
    this.name = "AuthError";
  }
}

export class RateLimitedError extends Error {
  retryAfterSeconds: number;
  constructor(retryAfterSeconds: number) {
    super("Too many login attempts. Try again in a few minutes.");
    this.name = "RateLimitedError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// Generous enough that a few mistyped passwords never lock a real user out
// (the per-email window resets on any successful login), tight enough to
// make scripted credential stuffing impractical. Per-IP is a coarser net
// on top, since an attacker sprays many emails from one place.
const EMAIL_LIMIT = { limit: 10, windowSeconds: 15 * 60 };
const IP_LIMIT = { limit: 30, windowSeconds: 15 * 60 };

export async function login(
  email: string,
  password: string,
  meta?: { ipAddress?: string; userAgent?: string }
) {
  const emailKey = `login:email:${email.trim().toLowerCase()}`;
  const ipKey = meta?.ipAddress ? `login:ip:${meta.ipAddress}` : null;

  const emailCheck = await checkAndRecordAttempt(emailKey, EMAIL_LIMIT);
  if (!emailCheck.allowed) throw new RateLimitedError(emailCheck.retryAfterSeconds);

  if (ipKey) {
    const ipCheck = await checkAndRecordAttempt(ipKey, IP_LIMIT);
    if (!ipCheck.allowed) throw new RateLimitedError(ipCheck.retryAfterSeconds);
  }

  const user = await findUserByEmail(email);

  // Verify against a dummy hash when the user doesn't exist so response
  // timing doesn't reveal whether the email is registered.
  const passwordHash =
    user?.passwordHash ??
    "$argon2id$v=19$m=19456,t=2,p=1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
  const valid = await verifyPassword(passwordHash, password);

  if (!user || !valid || !user.active) {
    throw new AuthError();
  }

  // Successful login clears both counters — a real user who fat-fingered
  // their password a couple of times isn't left carrying that toward a
  // future lockout.
  await resetAttempts(emailKey);
  if (ipKey) await resetAttempts(ipKey);

  const session = await createSession(user.id, meta);
  return { user, ...session };
}

/**
 * Ends the CRM browser session only.
 *
 * Deliberately does NOT touch the user's linked WhatsApp device. The two
 * are independent by design: WhatsApp lives in the OpenWA gateway (its own
 * process, its own credentials on disk) and is mirrored by WhatsAppSession
 * — nothing here is keyed to a CRM login. A telecaller signing out at the
 * end of a shift, or being signed out by a session expiry, must keep their
 * device linked so scheduled/cadence messages keep going out and they
 * don't have to re-scan a QR every morning.
 *
 * The ONLY path that unlinks WhatsApp is the explicit Logout button on the
 * WhatsApp panel (DELETE /api/v1/whatsapp/session → logoutWhatsAppForUser).
 * Never add a WhatsApp call here.
 */
export function logout(token: string) {
  return invalidateSessionToken(token);
}
