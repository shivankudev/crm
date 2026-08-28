import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { updateTelecallerStatusesSchema } from "@/lib/validation/settings";
import { updateTelecallerAllowedStatuses } from "@/services/settings.service";
import { errorResponse } from "@/lib/api-response";

export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const body = await req.json();
    const input = updateTelecallerStatusesSchema.parse(body);
    const setting = await updateTelecallerAllowedStatuses(input.statusNames, actor);
    return NextResponse.json({ setting });
  } catch (error) {
    return errorResponse(error);
  }
}
