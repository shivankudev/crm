import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { changeDealerStatusSchema } from "@/lib/validation/dealer";
import { changeDealerStatus } from "@/services/dealer.service";
import { errorResponse } from "@/lib/api-response";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const body = await req.json();
    const input = changeDealerStatusSchema.parse(body);

    const dealer = await changeDealerStatus(id, input, actor);
    return NextResponse.json({ dealer });
  } catch (error) {
    return errorResponse(error);
  }
}
