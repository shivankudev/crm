import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AuthError, RateLimitedError } from "@/services/auth.service";
import { UnauthorizedError } from "@/lib/auth/current-user";
import { ForbiddenError } from "@/lib/rbac/can";
import { UserServiceError } from "@/services/user.service";
import { DuplicateLeadError, LeadNotFoundError, LeadServiceError } from "@/services/lead.service";
import { FollowUpNotFoundError, FollowUpServiceError } from "@/services/followup.service";
import { DealerNotFoundError, DealerServiceError, DuplicateDealerError } from "@/services/dealer.service";
import { DealerDocumentNotFoundError } from "@/services/dealer-document.service";
import { FactoryVisitNotFoundError } from "@/services/factory-visit.service";
import { ProductNotFoundError } from "@/services/product.service";
import { OrderNotFoundError, OrderServiceError } from "@/services/order.service";
import { ImportServiceError } from "@/services/import.service";
import { WhatsAppServiceError } from "@/services/whatsapp.service";
import { QuickActionError } from "@/services/whatsapp-quick-action.service";
import { OpenWAError } from "@/lib/openwa-client";

/** Maps known error types to the right HTTP status + safe message. */
export function errorResponse(error: unknown): NextResponse {
  if (error instanceof ZodError) {
    return NextResponse.json(
      { error: "Validation failed", issues: error.issues },
      { status: 400 }
    );
  }
  if (error instanceof RateLimitedError) {
    return NextResponse.json(
      { error: error.message },
      { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
    );
  }
  if (error instanceof AuthError || error instanceof UnauthorizedError) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
  if (error instanceof ForbiddenError) {
    return NextResponse.json({ error: error.message }, { status: 403 });
  }
  if (
    error instanceof LeadNotFoundError ||
    error instanceof FollowUpNotFoundError ||
    error instanceof DealerNotFoundError ||
    error instanceof DealerDocumentNotFoundError ||
    error instanceof FactoryVisitNotFoundError ||
    error instanceof ProductNotFoundError ||
    error instanceof OrderNotFoundError
  ) {
    return NextResponse.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof DuplicateLeadError || error instanceof DuplicateDealerError) {
    return NextResponse.json({ error: error.message, existing: error.existing }, { status: 409 });
  }
  if (
    error instanceof UserServiceError ||
    error instanceof LeadServiceError ||
    error instanceof FollowUpServiceError ||
    error instanceof DealerServiceError ||
    error instanceof OrderServiceError ||
    error instanceof ImportServiceError ||
    error instanceof WhatsAppServiceError ||
    error instanceof QuickActionError
  ) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof OpenWAError) {
    // The gateway itself is down/misconfigured, or WhatsApp rejected the
    // call — surface its message but as a 502 (this server's dependency
    // failed), not a 400 (the caller's own request wasn't the problem).
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  console.error(error);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
