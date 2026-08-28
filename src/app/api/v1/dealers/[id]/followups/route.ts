import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { createFollowUpSchema } from "@/lib/validation/followup";
import { createManualFollowUp } from "@/services/followup.service";
import { errorResponse } from "@/lib/api-response";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const body = await req.json();
    const input = createFollowUpSchema.parse({ ...body, dealerId: id });

    const followUp = await createManualFollowUp(input, actor);
    return NextResponse.json({ followUp }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
