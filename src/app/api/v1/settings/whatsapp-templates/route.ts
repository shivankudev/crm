import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import {
  WA_TRIGGER_OUTCOME,
  WA_TRIGGER_CADENCE_STEP,
  listTemplatesForTarget,
  upsertTemplateForTargets,
} from "@/services/whatsapp.service";
import { listResultOptions } from "@/repositories/lookup.repository";
import { errorResponse } from "@/lib/api-response";

const MAX_FILE_BYTES = 15 * 1024 * 1024;

/** Admin read of one telecaller's templates: /settings/whatsapp-templates?userId=… */
export async function GET(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

    const templates = await listTemplatesForTarget(actor, userId);
    return NextResponse.json({ templates });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * multipart/form-data — same template fields as the per-user route, plus the
 * targeting the admin screen adds: `applyToAll` ("true") or `targetUserId`.
 */
export async function PUT(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const form = await req.formData();

    const triggerType = form.get("triggerType");
    const triggerKey = form.get("triggerKey");
    if (triggerType !== WA_TRIGGER_OUTCOME && triggerType !== WA_TRIGGER_CADENCE_STEP) {
      return NextResponse.json({ error: "Invalid triggerType" }, { status: 400 });
    }
    if (typeof triggerKey !== "string" || !triggerKey) {
      return NextResponse.json({ error: "triggerKey is required" }, { status: 400 });
    }
    if (triggerType === WA_TRIGGER_CADENCE_STEP && !/^\d{1,3}$/.test(triggerKey)) {
      return NextResponse.json({ error: "Cadence triggerKey must be a step number" }, { status: 400 });
    }
    if (triggerType === WA_TRIGGER_OUTCOME) {
      const known = await listResultOptions();
      if (!known.some((r) => r.name === triggerKey)) {
        return NextResponse.json({ error: "Unknown call outcome" }, { status: 400 });
      }
    }

    const text = form.get("text");
    const enabled = form.get("enabled");
    const removeMedia = form.get("removeMedia") === "true";
    const file = form.get("file");
    const applyToAll = form.get("applyToAll") === "true";
    const targetUserId = form.get("targetUserId");

    let media: { buffer: Buffer; fileName: string; mimeType: string } | null | undefined;
    if (removeMedia) {
      media = null;
    } else if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "File exceeds the 15MB limit" }, { status: 400 });
      }
      media = {
        buffer: Buffer.from(await file.arrayBuffer()),
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
      };
    }

    // WhatsApp's own caps: 4096 for a text message, 1024 for a media caption.
    const limit = media ? 1024 : 4096;
    if (typeof text === "string" && text.length > limit) {
      return NextResponse.json(
        { error: `Message is too long — WhatsApp allows ${limit} characters ${media ? "for a media caption" : "for a text message"}.` },
        { status: 400 }
      );
    }

    const result = await upsertTemplateForTargets(actor, {
      triggerType,
      triggerKey,
      text: typeof text === "string" ? text : undefined,
      enabled: enabled === null ? undefined : enabled === "true",
      media,
      applyToAll,
      targetUserId: typeof targetUserId === "string" && targetUserId ? targetUserId : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return errorResponse(error);
  }
}
