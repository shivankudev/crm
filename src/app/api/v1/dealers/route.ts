import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { createDealerSchema } from "@/lib/validation/dealer";
import { createDealer, listDealersForUser } from "@/services/dealer.service";
import { errorResponse } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const params = req.nextUrl.searchParams;

    const { dealers, total } = await listDealersForUser(actor, {
      statusId: params.get("status") ?? undefined,
      stateId: params.get("state") ?? undefined,
      search: params.get("q") ?? undefined,
      page: params.get("page") ? Number(params.get("page")) : undefined,
      pageSize: params.get("pageSize") ? Number(params.get("pageSize")) : undefined,
    });

    return NextResponse.json({ dealers, total });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const body = await req.json();
    const input = createDealerSchema.parse(body);

    const dealer = await createDealer(input, actor);
    return NextResponse.json({ dealer }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
