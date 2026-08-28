import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { exportDealersCsv } from "@/services/export.service";
import { errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const actor = await requireApiUser();
    const csv = await exportDealersCsv(actor);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="dealers-export-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}
