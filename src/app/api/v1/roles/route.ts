import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { canAny, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listRoles } from "@/repositories/role.repository";
import { errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const actor = await requireApiUser();
    if (!canAny(actor, [PERMISSIONS.USERS_MANAGE_ALL, PERMISSIONS.USERS_MANAGE_SCOPED])) {
      throw new ForbiddenError();
    }

    const roles = await listRoles();
    return NextResponse.json({ roles: roles.map((r) => ({ id: r.id, name: r.name })) });
  } catch (error) {
    return errorResponse(error);
  }
}
