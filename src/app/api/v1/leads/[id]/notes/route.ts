import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { can, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { createNoteSchema } from "@/lib/validation/lead";
import { addNoteToLead, listNotesForLeadForUser } from "@/services/note.service";
import { errorResponse } from "@/lib/api-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const notes = await listNotesForLeadForUser(id, actor);
    return NextResponse.json({ notes });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    if (!can(actor, PERMISSIONS.LEADS_CALL_LOG)) throw new ForbiddenError();

    const { id } = await params;
    const body = await req.json();
    const input = createNoteSchema.parse(body);

    const note = await addNoteToLead(id, input, actor);
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
