import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, validateSessionToken, sessionCookieOptions } from "@/lib/auth/session";

// Proxy (formerly "middleware") always runs on the Node.js runtime, which
// is required here since session validation hits Postgres via Prisma.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/v1/auth/login).*)"],
};

// /version.txt is the deployed commit, written by the Windows update scripts.
// Readable without signing in on purpose: the question it answers — "has my
// change reached the office yet?" — is asked from another machine, often
// before anyone has logged in, and a telecaller reading it down the phone
// should not have to authenticate first. It reveals only a short commit hash
// of a private repo, on a LAN-only app.
const PUBLIC_PATHS = ["/login", "/version.txt"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const isApi = pathname.startsWith("/api/");

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = token ? await validateSessionToken(token) : null;

  if (!session) {
    if (isPublic) return NextResponse.next();
    if (isApi) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isPublic) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const res = NextResponse.next();
  if (session.renewed) {
    const opts = sessionCookieOptions(session.expiresAt);
    res.cookies.set(opts.name, token!, opts);
  }
  return res;
}
