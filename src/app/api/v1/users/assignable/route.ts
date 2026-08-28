import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { can, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listUsers } from "@/services/user.service";
import { errorResponse } from "@/lib/api-response";

/** Lightweight active-user list for the lead-assignment dropdown (not the full admin listing). */
export async function GET() {
  try {
    const actor = await requireApiUser();
    if (!can(actor, PERMISSIONS.LEADS_ASSIGN)) throw new ForbiddenError();

    const users = await listUsers();
    return NextResponse.json({
      users: users
        .filter((u) => u.active)
        .map((u) => ({ id: u.id, name: u.name, roleName: u.role.name })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
