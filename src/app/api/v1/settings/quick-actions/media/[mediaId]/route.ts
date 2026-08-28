import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import {
  moveQuickActionMediaForAdmin,
  readQuickActionMediaForAdmin,
  removeQuickActionMediaForAdmin,
} from "@/services/whatsapp-quick-action.service";
import { errorResponse } from "@/lib/api-response";

/** The bytes themselves, so the admin editor can show a real thumbnail. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ mediaId: string }> }) {
  try {
    const actor = await requireApiUser();
    const { mediaId } = await params;
    const { data, fileName, mimeType } = await readQuickActionMediaForAdmin(actor, mediaId);

    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": mimeType,
        // Inline so <img> can render it; the filename still applies if an
        // admin opens it in its own tab.
        "Content-Disposition": `inline; filename="${encodeURIComponent(fileName)}"`,
        // Attachments are immutable once uploaded — replacing one means
        // deleting and re-adding, which changes the id in this URL.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    return errorResponse(error);
  }
}

/** `{ direction: "up" | "down" }` — reorders within its button. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ mediaId: string }> }) {
  try {
    const actor = await requireApiUser();
    const { mediaId } = await params;
    const { direction } = await req.json();
    if (direction !== "up" && direction !== "down") {
      return NextResponse.json({ error: "direction must be \"up\" or \"down\"" }, { status: 400 });
    }
    await moveQuickActionMediaForAdmin(actor, mediaId, direction);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ mediaId: string }> }) {
  try {
    const actor = await requireApiUser();
    const { mediaId } = await params;
    await removeQuickActionMediaForAdmin(actor, mediaId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
