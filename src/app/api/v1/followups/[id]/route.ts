import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { can, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { updateFollowUpSchema } from "@/lib/validation/followup";
import { updateFollowUpForUser } from "@/services/followup.service";
import { errorResponse } from "@/lib/api-response";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    if (!can(actor, PERMISSIONS.LEADS_FOLLOWUPS_MANAGE)) throw new ForbiddenError();

    const { id } = await params;
    const body = await req.json();
    const input = updateFollowUpSchema.parse(body);

    const result = await updateFollowUpForUser(id, input, actor);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
