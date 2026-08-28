import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { createLookupSchema } from "@/lib/validation/settings";
import { createLostReasonForSettings, listLostReasonsForSettings } from "@/services/settings.service";
import { errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const actor = await requireApiUser();
    const reasons = await listLostReasonsForSettings(actor);
    return NextResponse.json({ reasons });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const body = await req.json();
    const input = createLookupSchema.parse(body);
    const reason = await createLostReasonForSettings(input.name, actor);
    return NextResponse.json({ reason }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
