import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { listOverdueForUser } from "@/services/followup.service";
import { errorResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const params = req.nextUrl.searchParams;
    const page = params.get("page") ? Number(params.get("page")) : 1;
    const pageSize = Math.min(params.get("pageSize") ? Number(params.get("pageSize")) : 25, 100);

    const { followUps, total } = await listOverdueForUser(actor, { page, pageSize });
    return NextResponse.json({ followUps, total });
  } catch (error) {
    return errorResponse(error);
  }
}
