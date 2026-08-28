import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { getTelecallerPerformanceReport } from "@/services/reports.service";
import { errorResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const params = req.nextUrl.searchParams;
    const from = params.get("from") ? new Date(params.get("from")!) : undefined;
    const to = params.get("to") ? new Date(params.get("to")!) : undefined;

    const rows = await getTelecallerPerformanceReport(actor, { from, to });
    return NextResponse.json({ rows });
  } catch (error) {
    return errorResponse(error);
  }
}
