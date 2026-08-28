import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { deleteLeadSheetForAdmin, updateLeadSheetForAdmin } from "@/services/lead-sheet.service";
import { errorResponse } from "@/lib/api-response";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const body = await req.json();
    const sheet = await updateLeadSheetForAdmin(actor, id, {
      name: typeof body.name === "string" ? body.name : undefined,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      accessMode: body.accessMode,
      spreadsheetId: body.spreadsheetId,
      sheetName: body.sheetName,
      csvUrl: body.csvUrl,
      sourceId: body.sourceId,
      assigneeIds: Array.isArray(body.assigneeIds) ? body.assigneeIds.map(String) : undefined,
    });
    return NextResponse.json({ sheet });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    await deleteLeadSheetForAdmin(actor, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
