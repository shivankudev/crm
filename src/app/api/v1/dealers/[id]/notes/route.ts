import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { createNoteSchema } from "@/lib/validation/lead";
import { addNoteToDealer, listNotesForDealerForUser } from "@/services/note.service";
import { errorResponse } from "@/lib/api-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const notes = await listNotesForDealerForUser(id, actor);
    return NextResponse.json({ notes });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const body = await req.json();
    const input = createNoteSchema.parse(body);

    const note = await addNoteToDealer(id, input, actor);
    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
