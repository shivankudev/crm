import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { canAny, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { updateUserSchema } from "@/lib/validation/user";
import { updateUser, deleteUser } from "@/services/user.service";
import { errorResponse } from "@/lib/api-response";

const MANAGE_USERS = [PERMISSIONS.USERS_MANAGE_ALL, PERMISSIONS.USERS_MANAGE_SCOPED] as const;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    if (!canAny(actor, [...MANAGE_USERS])) throw new ForbiddenError();

    const { id } = await params;
    const body = await req.json();
    const input = updateUserSchema.parse(body);

    // Role-scope check (an Admin can't touch a peer Admin/Super Admin, or
    // hand out a role at or above their own) lives in updateUser() now.
    const user = await updateUser(id, input, actor);
    return NextResponse.json({
      user: { id: user.id, name: user.name, roleId: user.roleId, active: user.active },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    if (!canAny(actor, [...MANAGE_USERS])) throw new ForbiddenError();

    const { id } = await params;

    // Role-scope check lives in deleteUser() now.
    await deleteUser(id, actor);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
