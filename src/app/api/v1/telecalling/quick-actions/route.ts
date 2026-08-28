import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { listQuickActionsForCaller, sendQuickAction } from "@/services/whatsapp-quick-action.service";
import { errorResponse } from "@/lib/api-response";

/** The buttons the telecalling screen renders. */
export async function GET() {
  try {
    await requireApiUser();
    const actions = await listQuickActionsForCaller();
    return NextResponse.json({
      actions: actions.map((a) => ({
        id: a.id,
        label: a.label,
        mediaCount: a.media.length,
        hasText: Boolean(a.text),
        hasLocation: a.latitude !== null,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Presses one button at a lead. */
export async function POST(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const { quickActionId, leadId } = await req.json();
    if (!quickActionId || !leadId) {
      return NextResponse.json({ error: "quickActionId and leadId are required" }, { status: 400 });
    }
    const result = await sendQuickAction(actor, quickActionId, leadId);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
