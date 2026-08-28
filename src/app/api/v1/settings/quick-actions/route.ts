import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import {
  createQuickActionForAdmin,
  listQuickActionsForAdmin,
  moveQuickActionForAdmin,
} from "@/services/whatsapp-quick-action.service";
import { errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const actor = await requireApiUser();
    const actions = await listQuickActionsForAdmin(actor);
    return NextResponse.json({ actions });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const { label } = await req.json();
    const action = await createQuickActionForAdmin(actor, String(label ?? ""));
    return NextResponse.json({ action }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

/** `{ id, direction }` — moves a button along the row callers see. */
export async function PATCH(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const { id, direction } = await req.json();
    if (direction !== "up" && direction !== "down") {
      return NextResponse.json({ error: "direction must be \"up\" or \"down\"" }, { status: 400 });
    }
    await moveQuickActionForAdmin(actor, String(id ?? ""), direction);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
