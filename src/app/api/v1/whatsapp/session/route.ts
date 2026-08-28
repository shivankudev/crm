import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { connectWhatsAppForUser, getWhatsAppStatusForUser, logoutWhatsAppForUser } from "@/services/whatsapp.service";
import { errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const actor = await requireApiUser();
    const session = await getWhatsAppStatusForUser(actor);
    return NextResponse.json({ session });
  } catch (error) {
    return errorResponse(error);
  }
}

/** Connects (creating the OpenWA session on first use) and returns a QR to scan. */
export async function POST() {
  try {
    const actor = await requireApiUser();
    const qr = await connectWhatsAppForUser(actor);
    return NextResponse.json(qr);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE() {
  try {
    const actor = await requireApiUser();
    const session = await logoutWhatsAppForUser(actor);
    return NextResponse.json({ session });
  } catch (error) {
    return errorResponse(error);
  }
}
