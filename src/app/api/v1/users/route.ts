import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { canAny, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { createUserSchema } from "@/lib/validation/user";
import { createUser, listUsers } from "@/services/user.service";
import { errorResponse } from "@/lib/api-response";

const MANAGE_USERS = [PERMISSIONS.USERS_MANAGE_ALL, PERMISSIONS.USERS_MANAGE_SCOPED] as const;

export async function GET() {
  try {
    const actor = await requireApiUser();
    if (!canAny(actor, [...MANAGE_USERS])) throw new ForbiddenError();

    const users = await listUsers();
    return NextResponse.json({
      users: users.map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        active: u.active,
        role: { id: u.role.id, name: u.role.name },
        team: u.team ? { id: u.team.id, name: u.team.name } : null,
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    if (!canAny(actor, [...MANAGE_USERS])) throw new ForbiddenError();

    const body = await req.json();
    const input = createUserSchema.parse(body);

    // Role-scope check (Admins can't create a peer Admin or a Super Admin)
    // lives in createUser() itself now — single source of truth.
    const user = await createUser(input, actor);
    return NextResponse.json(
      { user: { id: user.id, name: user.name, email: user.email, roleId: user.roleId } },
      { status: 201 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
