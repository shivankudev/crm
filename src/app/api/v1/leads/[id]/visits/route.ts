import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { createFactoryVisitSchema } from "@/lib/validation/factory-visit";
import { createFactoryVisitForLead, listVisitsForLeadForUser } from "@/services/factory-visit.service";
import { errorResponse } from "@/lib/api-response";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const visits = await listVisitsForLeadForUser(id, actor);
    return NextResponse.json({ visits });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const body = await req.json();
    const input = createFactoryVisitSchema.parse(body);

    const visit = await createFactoryVisitForLead(id, input, actor);
    return NextResponse.json({ visit }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
