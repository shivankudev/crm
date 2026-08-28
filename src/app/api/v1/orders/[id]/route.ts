import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { updateOrderSchema } from "@/lib/validation/order";
import { updateOrderForUser } from "@/services/order.service";
import { errorResponse } from "@/lib/api-response";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const body = await req.json();
    const input = updateOrderSchema.parse(body);

    const order = await updateOrderForUser(id, input, actor);
    return NextResponse.json({ order });
  } catch (error) {
    return errorResponse(error);
  }
}
