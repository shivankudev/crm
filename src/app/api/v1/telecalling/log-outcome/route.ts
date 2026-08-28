import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { can, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { logTelecallingOutcomeSchema } from "@/lib/validation/telecalling";
import { logTelecallingOutcome } from "@/services/telecalling.service";
import { errorResponse } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    // Mirrors the two permissions this single write replaces (call log +
    // follow-up completion) — a STOP/terminal outcome's own status change
    // is gated separately, inside changeLeadStatus() itself.
    if (!can(actor, PERMISSIONS.LEADS_CALL_LOG) || !can(actor, PERMISSIONS.LEADS_FOLLOWUPS_MANAGE)) {
      throw new ForbiddenError();
    }

    const body = await req.json();
    const input = logTelecallingOutcomeSchema.parse(body);

    const outcome = await logTelecallingOutcome(actor, input);
    return NextResponse.json(outcome);
  } catch (error) {
    return errorResponse(error);
  }
}
