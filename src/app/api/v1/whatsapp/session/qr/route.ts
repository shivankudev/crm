import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { getQrForUser } from "@/services/whatsapp.service";
import { errorResponse } from "@/lib/api-response";

/** Polled by the dashboard/settings widget while status is "qr_ready". */
export async function GET() {
  try {
    const actor = await requireApiUser();
    const qr = await getQrForUser(actor);
    return NextResponse.json(qr);
  } catch (error) {
    return errorResponse(error);
  }
}
