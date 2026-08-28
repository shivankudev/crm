import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import {
  addQuickActionMediaForAdmin,
  deleteQuickActionForAdmin,
  updateQuickActionForAdmin,
} from "@/services/whatsapp-quick-action.service";
import { errorResponse } from "@/lib/api-response";

const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_FILES_PER_PRESS = 10;

/** JSON body: label / text / enabled / latitude / longitude / locationName. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const body = await req.json();

    const num = (v: unknown) => (v === null || v === "" || v === undefined ? null : Number(v));
    const action = await updateQuickActionForAdmin(actor, id, {
      label: typeof body.label === "string" ? body.label : undefined,
      text: body.text === undefined ? undefined : body.text || null,
      enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
      latitude: body.latitude === undefined ? undefined : num(body.latitude),
      longitude: body.longitude === undefined ? undefined : num(body.longitude),
      locationName: body.locationName === undefined ? undefined : body.locationName || null,
    });
    return NextResponse.json({ action });
  } catch (error) {
    return errorResponse(error);
  }
}

/** multipart/form-data with one or more `files` — appends attachments. */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    const form = await req.formData();
    const entries = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

    if (entries.length === 0) return NextResponse.json({ error: "Choose at least one file" }, { status: 400 });
    if (entries.length > MAX_FILES_PER_PRESS) {
      return NextResponse.json({ error: `Add at most ${MAX_FILES_PER_PRESS} files at a time` }, { status: 400 });
    }
    for (const f of entries) {
      if (f.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: `"${f.name}" is over the 15MB limit` }, { status: 400 });
      }
    }

    const files = await Promise.all(
      entries.map(async (f) => ({
        buffer: Buffer.from(await f.arrayBuffer()),
        fileName: f.name,
        mimeType: f.type || "application/octet-stream",
      }))
    );
    const action = await addQuickActionMediaForAdmin(actor, id, files);
    return NextResponse.json({ action });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const actor = await requireApiUser();
    const { id } = await params;
    await deleteQuickActionForAdmin(actor, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
