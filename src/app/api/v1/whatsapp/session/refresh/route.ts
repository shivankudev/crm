import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { refreshQrForUser } from "@/services/whatsapp.service";
import { errorResponse } from "@/lib/api-response";

/** Full stop+start restart — the reliable way to force a brand-new QR. */
export async function POST() {
  try {
    const actor = await requireApiUser();
    const qr = await refreshQrForUser(actor);
    return NextResponse.json(qr);
  } catch (error) {
    return errorResponse(error);
  }
}
