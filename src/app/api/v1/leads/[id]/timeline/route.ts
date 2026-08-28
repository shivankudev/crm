import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { getLeadForUser } from "@/services/lead.service";
import { listLeadActivity } from "@/repositories/lead-activity.repository";
import { errorResponse } from "@/lib/api-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    await getLeadForUser(id, actor); // enforces visibility + existence
    const activity = await listLeadActivity(id);
    return NextResponse.json({ activity });
  } catch (error) {
    return errorResponse(error);
  }
}
