import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { getTelecallingQueueForUser } from "@/services/telecalling.service";
import { errorResponse } from "@/lib/api-response";

export async function GET() {
  try {
    const actor = await requireApiUser();
    const queue = await getTelecallingQueueForUser(actor);
    return NextResponse.json(queue);
  } catch (error) {
    return errorResponse(error);
  }
}
