import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { updateDealerSchema } from "@/lib/validation/dealer";
import { getDealerForUser, updateDealer } from "@/services/dealer.service";
import { errorResponse } from "@/lib/api-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const dealer = await getDealerForUser(id, actor);
    return NextResponse.json({ dealer });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const body = await req.json();
    const input = updateDealerSchema.parse(body);

    const dealer = await updateDealer(id, input, actor);
    return NextResponse.json({ dealer });
  } catch (error) {
    return errorResponse(error);
  }
}
