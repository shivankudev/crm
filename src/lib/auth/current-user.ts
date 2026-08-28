import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE_NAME, validateSessionToken, type SessionUser } from "@/lib/auth/session";
import { getPermissionsForRole } from "@/lib/rbac/can";

export type CurrentUser = SessionUser & { permissions: Set<string> };

/**
 * Reads and validates the session cookie for the current request.
 * Wrapped in React's `cache()` so repeated calls within one request
 * (layout + page + nested components) only hit the DB once.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const result = await validateSessionToken(token);
  if (!result) return null;

  const permissions = await getPermissionsForRole(result.user.roleId);
  return { ...result.user, permissions };
});

/** For server components/pages: redirects to /login when unauthenticated. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export class UnauthorizedError extends Error {
  constructor(message = "Not authenticated") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** For API route handlers: throws (caught by errorResponse -> 401) instead of redirecting. */
export async function requireApiUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthorizedError();
  return user;
}
