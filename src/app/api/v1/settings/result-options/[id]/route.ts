import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { updateLookupSchema } from "@/lib/validation/settings";
import { updateResultOptionForSettings } from "@/services/settings.service";
import { errorResponse } from "@/lib/api-response";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const body = await req.json();
    const input = updateLookupSchema.parse(body);
    const result = await updateResultOptionForSettings(id, input, actor);
    return NextResponse.json({ result });
  } catch (error) {
    return errorResponse(error);
  }
}
