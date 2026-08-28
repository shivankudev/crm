import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { createStatusSchema } from "@/lib/validation/settings";
import { createLeadStatusForSettings, listLeadStatusesForSettings } from "@/services/settings.service";
import { errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const actor = await requireApiUser();
    const statuses = await listLeadStatusesForSettings(actor);
    return NextResponse.json({ statuses });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const body = await req.json();
    const input = createStatusSchema.parse(body);
    const status = await createLeadStatusForSettings(input, actor);
    return NextResponse.json({ status }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
