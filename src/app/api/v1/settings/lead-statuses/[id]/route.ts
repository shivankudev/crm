import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { updateStatusSchema } from "@/lib/validation/settings";
import { updateLeadStatusForSettings } from "@/services/settings.service";
import { errorResponse } from "@/lib/api-response";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const body = await req.json();
    const input = updateStatusSchema.parse(body);
    const status = await updateLeadStatusForSettings(id, input, actor);
    return NextResponse.json({ status });
  } catch (error) {
    return errorResponse(error);
  }
}
