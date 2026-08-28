import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { syncLeadSheetForAdmin } from "@/services/lead-sheet.service";
import { errorResponse } from "@/lib/api-response";

/** "Sync now" — the same import the background poll runs, on demand. */
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const result = await syncLeadSheetForAdmin(actor, id);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
