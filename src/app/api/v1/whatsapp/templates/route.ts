import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import {
  WA_TRIGGER_OUTCOME,
  WA_TRIGGER_CADENCE_STEP,
  findWhatsAppTemplateFor,
  listWhatsAppTemplatesFor,
  upsertWhatsAppTemplateFor,
} from "@/services/whatsapp.service";
import { listResultOptions } from "@/repositories/lookup.repository";
import { errorResponse } from "@/lib/api-response";

const MAX_FILE_BYTES = 15 * 1024 * 1024; // 15MB — matches typical WhatsApp media limits

export async function GET() {
  try {
    const actor = await requireApiUser();
    const templates = await listWhatsAppTemplatesFor(actor);
    return NextResponse.json({ templates });
  } catch (error) {
    return errorResponse(error);
  }
}

/** multipart/form-data: triggerType, triggerKey, text?, enabled, file? (image/video/document), removeMedia? */
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
    // Bound the key to what the two trigger axes can actually mean. Rows
    // are self-scoped so a junk key is not a security issue, but an
    // unvalidated key writes a template that no trigger will ever match
    // and that the settings page won't render — invisible dead config.
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

    let media: { buffer: Buffer; fileName: string; mimeType: string } | null | undefined;
    if (removeMedia) {
      media = null;
    } else if (file instanceof File && file.size > 0) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "File exceeds the 15MB limit" }, { status: 400 });
      }
      media = { buffer: Buffer.from(await file.arrayBuffer()), fileName: file.name, mimeType: file.type || "application/octet-stream" };
    }

    // WhatsApp's own limits: 4096 chars for a plain text message, 1024 for
    // a media caption. Enforced here so an over-long template is rejected
    // while the telecaller is editing it, rather than silently failing at
    // the gateway on every future send — where the only trace would be a
    // FAILED row long after the fact.
    //
    // Which limit applies depends on whether the SAVED template ends up
    // carrying media: a new upload does, an explicit removal doesn't, and
    // an untouched one keeps whatever it already had.
    const existing = await findWhatsAppTemplateFor(actor, triggerType, triggerKey);
    const willHaveMedia = media ? true : media === null ? false : Boolean(existing?.mediaKey);
    const limit = willHaveMedia ? 1024 : 4096;
    if (typeof text === "string" && text.length > limit) {
      return NextResponse.json(
        {
          error: `Message is too long — WhatsApp allows ${limit} characters ${
            willHaveMedia ? "for a media caption" : "for a text message"
          }.`,
        },
        { status: 400 }
      );
    }

    const template = await upsertWhatsAppTemplateFor(actor, {
      triggerType,
      triggerKey,
      text: typeof text === "string" ? text : undefined,
      enabled: enabled === null ? undefined : enabled === "true",
      media,
    });

    return NextResponse.json({ template });
  } catch (error) {
    return errorResponse(error);
  }
}
