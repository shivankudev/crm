import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { createLeadSchema } from "@/lib/validation/lead";
import { createLead, listLeadsForUser } from "@/services/lead.service";
import { errorResponse } from "@/lib/api-response";
import { parsePagination } from "@/lib/pagination";

export async function GET(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const params = req.nextUrl.searchParams;

    const { leads, total } = await listLeadsForUser(actor, {
      statusId: params.get("status") ?? undefined,
      sourceId: params.get("source") ?? undefined,
      stateId: params.get("state") ?? undefined,
      assignedUserId: params.get("owner") ?? undefined,
      temperature: params.get("temperature") ?? undefined,
      search: params.get("q") ?? undefined,
      ...parsePagination(params),
    });

    return NextResponse.json({ leads, total });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const body = await req.json();
    const input = createLeadSchema.parse(body);

    const lead = await createLead(input, actor);
    return NextResponse.json({ lead }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
