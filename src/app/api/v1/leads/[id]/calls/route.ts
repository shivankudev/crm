import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { ForbiddenError } from "@/lib/rbac/can";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { logCallSchema } from "@/lib/validation/lead";
import { listCallsForLead, logCall } from "@/services/call.service";
import { errorResponse } from "@/lib/api-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const calls = await listCallsForLead(id, actor);
    return NextResponse.json({ calls });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    if (!can(actor, PERMISSIONS.LEADS_CALL_LOG)) throw new ForbiddenError();

    const { id } = await params;
    const body = await req.json();
    const input = logCallSchema.parse(body);

    const call = await logCall(id, input, actor);
    return NextResponse.json({ call }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
