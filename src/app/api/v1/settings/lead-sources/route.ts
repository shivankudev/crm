import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { createLookupSchema } from "@/lib/validation/settings";
import { createLeadSourceForSettings, listLeadSourcesForSettings } from "@/services/settings.service";
import { errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const actor = await requireApiUser();
    const sources = await listLeadSourcesForSettings(actor);
    return NextResponse.json({ sources });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const body = await req.json();
    const input = createLookupSchema.parse(body);
    const source = await createLeadSourceForSettings(input.name, actor);
    return NextResponse.json({ source }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
