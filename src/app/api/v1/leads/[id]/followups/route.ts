import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { can, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { createFollowUpSchema } from "@/lib/validation/followup";
import { createManualFollowUp } from "@/services/followup.service";
import { errorResponse } from "@/lib/api-response";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    if (!can(actor, PERMISSIONS.LEADS_FOLLOWUPS_MANAGE)) throw new ForbiddenError();

    const { id } = await params;
    const body = await req.json();
    const input = createFollowUpSchema.parse({ ...body, leadId: id });

    const followUp = await createManualFollowUp(input, actor);
    return NextResponse.json({ followUp }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
