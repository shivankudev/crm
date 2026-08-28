import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { updateLeadSchema } from "@/lib/validation/lead";
import { getLeadForUser, updateLead } from "@/services/lead.service";
import { errorResponse } from "@/lib/api-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const lead = await getLeadForUser(id, actor);
    return NextResponse.json({ lead });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const body = await req.json();
    const input = updateLeadSchema.parse(body);

    const lead = await updateLead(id, input, actor);
    return NextResponse.json({ lead });
  } catch (error) {
    return errorResponse(error);
  }
}
