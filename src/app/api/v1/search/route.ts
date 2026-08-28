import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { listLeadsForUser } from "@/services/lead.service";
import { listDealersForUser } from "@/services/dealer.service";
import { errorResponse } from "@/lib/api-response";

/**
 * Backs the Cmd+K command palette — a fast, small, combined lookup across
 * leads and dealers, reusing the exact same RBAC-scoped list services as
 * their full pages (so search never surfaces something the user
 * shouldn't be able to see) rather than a separate unscoped search path.
 */
export async function GET(req: NextRequest) {
  try {
    const actor = await requireApiUser();
    const q = req.nextUrl.searchParams.get("q")?.trim();
    if (!q || q.length < 2) {
      return NextResponse.json({ leads: [], dealers: [] });
    }

    const canSeeDealers = can(actor, PERMISSIONS.DEALERS_MANAGE) || can(actor, PERMISSIONS.DEALERS_VIEW_FOLLOWUP);

    const [{ leads }, dealerResult] = await Promise.all([
      listLeadsForUser(actor, { search: q, page: 1, pageSize: 6 }),
      canSeeDealers ? listDealersForUser(actor, { search: q, page: 1, pageSize: 6 }) : Promise.resolve({ dealers: [] }),
    ]);

    return NextResponse.json({
      leads: leads.map((l) => ({ id: l.id, name: l.name, leadCode: l.leadCode, phone: l.phone, statusName: l.status.name })),
      dealers: dealerResult.dealers.map((d) => ({
        id: d.id,
        name: d.dealerName,
        dealerCode: d.dealerCode,
        phone: d.phone,
        statusName: d.status.name,
      })),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
