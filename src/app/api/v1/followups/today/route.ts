import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { listTodayForUser } from "@/services/followup.service";
import { errorResponse } from "@/lib/api-response";
import { parsePagination } from "@/lib/pagination";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const params = req.nextUrl.searchParams;
    const { page, pageSize } = parsePagination(params, { pageSize: 25, maxPageSize: 100 });

    const { followUps, total } = await listTodayForUser(actor, { page, pageSize });
    return NextResponse.json({ followUps, total });
  } catch (error) {
    return errorResponse(error);
  }
}
