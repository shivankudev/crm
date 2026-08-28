import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { createFollowUpRuleSchema } from "@/lib/validation/settings";
import { createFollowUpRuleForSettings, listFollowUpRulesForSettings } from "@/services/settings.service";
import { errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const actor = await requireApiUser();
    const rules = await listFollowUpRulesForSettings(actor);
    return NextResponse.json({ rules });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const body = await req.json();
    const input = createFollowUpRuleSchema.parse(body);
    const rule = await createFollowUpRuleForSettings(input, actor);
    return NextResponse.json({ rule }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
