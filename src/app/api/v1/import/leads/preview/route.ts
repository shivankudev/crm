import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { previewLeadImport } from "@/services/import.service";
import { errorResponse } from "@/lib/api-response";

const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const form = await req.formData();
    const file = form.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A CSV file is required" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File exceeds the 5MB limit" }, { status: 400 });
    }

    const text = await file.text();
    const result = await previewLeadImport(text, actor);
    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
