import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { createLookupSchema } from "@/lib/validation/settings";
import { createResultOptionForSettings, listResultOptionsForSettings } from "@/services/settings.service";
import { errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const actor = await requireApiUser();
    const results = await listResultOptionsForSettings(actor);
    return NextResponse.json({ results });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const body = await req.json();
    const input = createLookupSchema.parse(body);
    const result = await createResultOptionForSettings(input.name, actor);
    return NextResponse.json({ result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
