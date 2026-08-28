import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import {
  getWhatsAppDeliverySummary,
  getWhatsAppMessageHistory,
  refreshWhatsAppDeliveryStatuses,
} from "@/services/whatsapp.service";
import { errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const actor = await requireApiUser();

    // Pull the latest acks before reading — WhatsApp reports delivery
    // asynchronously, so without this the panel would show every message
    // frozen at SENT. Best-effort: a gateway that's down just leaves the
    // stored statuses as-is rather than failing the request.
    await refreshWhatsAppDeliveryStatuses(actor);

    const [messages, summary] = await Promise.all([
      getWhatsAppMessageHistory(actor, 15),
      getWhatsAppDeliverySummary(actor),
    ]);

    return NextResponse.json({ messages, summary });
  } catch (error) {
    return errorResponse(error);
  }
}
