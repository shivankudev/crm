import { randomBytes, createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { User, Role } from "@prisma/client";

export const SESSION_COOKIE_NAME = "gatti_session";
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const SESSION_RENEW_THRESHOLD_MS = 1000 * 60 * 60 * 24 * 15; // renew once <15 days left

export type SessionUser = User & { role: Role };

function generateSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(
  userId: string,
  meta?: { ipAddress?: string; userAgent?: string }
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      ipAddress: meta?.ipAddress,
      userAgent: meta?.userAgent,
    },
  });

  return { token, expiresAt };
}

/**
 * Validates a raw session token from the client cookie. Renews the
 * expiry (sliding window) once fewer than 15 days remain, so active
 * users are never logged out mid-session.
 */
export async function validateSessionToken(
  token: string
): Promise<{ user: SessionUser; expiresAt: Date; renewed: boolean } | null> {
  const tokenHash = hashToken(token);

  const session = await prisma.session.findUnique({
    where: { tokenHash },
    include: { user: { include: { role: true } } },
  });

  if (!session) return null;

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  if (!session.user.active) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
    return null;
  }

  let expiresAt = session.expiresAt;
  let renewed = false;

  if (expiresAt.getTime() - Date.now() < SESSION_RENEW_THRESHOLD_MS) {
    expiresAt = new Date(Date.now() + SESSION_TTL_MS);
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt },
    });
    renewed = true;
  }

  return { user: session.user, expiresAt, renewed };
}

export async function invalidateSessionToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

export async function invalidateAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } });
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.SESSION_COOKIE_SECURE === "true",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}
