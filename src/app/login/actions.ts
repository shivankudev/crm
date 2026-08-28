"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { loginSchema } from "@/lib/validation/auth";
import { login, AuthError, RateLimitedError } from "@/services/auth.service";
import { sessionCookieOptions } from "@/lib/auth/session";

export type LoginActionState = { error: string | null };

export async function loginAction(
  _prevState: LoginActionState,
  formData: FormData
): Promise<LoginActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Enter a valid email and password." };
  }

  let token: string;
  let expiresAt: Date;
  try {
    const headerList = await headers();
    const result = await login(parsed.data.email, parsed.data.password, {
      ipAddress: headerList.get("x-forwarded-for") ?? undefined,
      userAgent: headerList.get("user-agent") ?? undefined,
    });
    token = result.token;
    expiresAt = result.expiresAt;
  } catch (error) {
    if (error instanceof AuthError || error instanceof RateLimitedError) {
      return { error: error.message };
    }
    throw error;
  }

  const cookieStore = await cookies();
  const opts = sessionCookieOptions(expiresAt);
  cookieStore.set(opts.name, token, opts);

  redirect("/dashboard");
}
