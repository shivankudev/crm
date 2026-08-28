import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import {
  createLeadSheetForAdmin,
  listLeadSheetsForAdmin,
  type AccessMode,
} from "@/services/lead-sheet.service";
import { getServiceAccountEmail } from "@/lib/google-sheets";
import { errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const actor = await requireApiUser();
    const sheets = await listLeadSheetsForAdmin(actor);
    // Surfaced so the admin can see who to share a private sheet with.
    return NextResponse.json({ sheets, serviceAccountEmail: getServiceAccountEmail() });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const { name, accessMode } = await req.json();
    const sheet = await createLeadSheetForAdmin(actor, {
      name: String(name ?? ""),
      accessMode: (accessMode ?? "SERVICE_ACCOUNT") as AccessMode,
    });
    return NextResponse.json({ sheet }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
