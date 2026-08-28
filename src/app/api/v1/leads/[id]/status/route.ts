import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { changeLeadStatusSchema } from "@/lib/validation/lead";
import { changeLeadStatus } from "@/services/lead.service";
import { errorResponse } from "@/lib/api-response";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const body = await req.json();
    const input = changeLeadStatusSchema.parse(body);

    const lead = await changeLeadStatus(id, input, actor);
    return NextResponse.json({ lead });
  } catch (error) {
    return errorResponse(error);
  }
}
