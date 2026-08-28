import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { updateFactoryVisitSchema } from "@/lib/validation/factory-visit";
import { updateFactoryVisitForUser } from "@/services/factory-visit.service";
import { errorResponse } from "@/lib/api-response";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const body = await req.json();
    const input = updateFactoryVisitSchema.parse(body);

    const visit = await updateFactoryVisitForUser(id, input, actor);
    return NextResponse.json({ visit });
  } catch (error) {
    return errorResponse(error);
  }
}
