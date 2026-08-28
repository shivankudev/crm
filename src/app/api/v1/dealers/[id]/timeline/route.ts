import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { getDealerForUser } from "@/services/dealer.service";
import { listDealerActivity } from "@/repositories/dealer-activity.repository";
import { errorResponse } from "@/lib/api-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    await getDealerForUser(id, actor); // enforces visibility + existence
    const activity = await listDealerActivity(id);
    return NextResponse.json({ activity });
  } catch (error) {
    return errorResponse(error);
  }
}
