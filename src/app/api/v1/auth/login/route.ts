import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { loginSchema } from "@/lib/validation/auth";
import { login } from "@/services/auth.service";
import { sessionCookieOptions } from "@/lib/auth/session";
import { errorResponse } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = loginSchema.parse(body);

    const { user, token, expiresAt } = await login(email, password, {
      ipAddress: req.headers.get("x-forwarded-for") ?? undefined,
      userAgent: req.headers.get("user-agent") ?? undefined,
    });

    const cookieStore = await cookies();
    cookieStore.set(sessionCookieOptions(expiresAt).name, token, sessionCookieOptions(expiresAt));

    return NextResponse.json({
      user: { id: user.id, name: user.name, email: user.email, roleId: user.roleId },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
