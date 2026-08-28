import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { dealerDocTypeSchema } from "@/lib/validation/dealer";
import { listDealerDocumentsForUser, uploadDealerDocument } from "@/services/dealer-document.service";
import { errorResponse } from "@/lib/api-response";

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10MB

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const documents = await listDealerDocumentsForUser(id, actor);
    return NextResponse.json({ documents });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;

    const form = await req.formData();
    const file = form.get("file");
    const docType = dealerDocTypeSchema.parse(form.get("docType"));

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "A file is required" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "The file is empty" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "File exceeds the 10MB limit" }, { status: 400 });
    }

    const data = Buffer.from(await file.arrayBuffer());
    const doc = await uploadDealerDocument(
      id,
      { docType, fileName: file.name, mimeType: file.type || null, data },
      actor
    );

    return NextResponse.json({ document: doc }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
