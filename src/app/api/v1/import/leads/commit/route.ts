import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { commitLeadImportSchema } from "@/lib/validation/import";
import { commitLeadImport } from "@/services/import.service";
import { errorResponse } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const body = await req.json();
    const input = commitLeadImportSchema.parse(body);

    const result = await commitLeadImport(input.rows, actor);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
