import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { updateFollowUpRuleSchema } from "@/lib/validation/settings";
import { updateFollowUpRuleForSettings } from "@/services/settings.service";
import { errorResponse } from "@/lib/api-response";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const body = await req.json();
    const input = updateFollowUpRuleSchema.parse(body);
    const { rule, shiftedCount } = await updateFollowUpRuleForSettings(id, input, actor);
    return NextResponse.json({ rule, shiftedCount });
  } catch (error) {
    return errorResponse(error);
  }
}
