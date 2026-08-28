import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { createOrderSchema } from "@/lib/validation/order";
import { createOrderForDealer, listOrdersForDealerForUser } from "@/services/order.service";
import { errorResponse } from "@/lib/api-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const orders = await listOrdersForDealerForUser(id, actor);
    return NextResponse.json({ orders });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const body = await req.json();
    const input = createOrderSchema.parse(body);

    const order = await createOrderForDealer(id, input, actor);
    return NextResponse.json({ order }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
