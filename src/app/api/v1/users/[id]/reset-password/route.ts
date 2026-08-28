import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { canAny, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { resetPasswordSchema } from "@/lib/validation/user";
import { resetUserPassword } from "@/services/user.service";
import { errorResponse } from "@/lib/api-response";

const MANAGE_USERS = [PERMISSIONS.USERS_MANAGE_ALL, PERMISSIONS.USERS_MANAGE_SCOPED] as const;

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    if (!canAny(actor, [...MANAGE_USERS])) throw new ForbiddenError();

    const { id } = await params;
    const body = await req.json();
    const { newPassword } = resetPasswordSchema.parse(body);

    // Role-scope check (an Admin can't reset a peer Admin/Super Admin's
    // password, only USERS_MANAGE_ALL can) lives in resetUserPassword() now.
    await resetUserPassword(id, newPassword, actor);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
