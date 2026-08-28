import { NextResponse } from "next/server";
import { requireApiUser } from "@/lib/auth/current-user";
import {
  listLeadSources,
  listLeadStatuses,
  listLostReasons,
  listResultOptions,
  listStates,
} from "@/repositories/lookup.repository";
import { errorResponse } from "@/lib/api-response";

/** Small, rarely-changing reference data the Leads UI needs for dropdowns. */
export async function GET() {
  try {
    await requireApiUser();

    const [statuses, sources, results, lostReasons, states] = await Promise.all([
      listLeadStatuses(),
      listLeadSources(),
      listResultOptions(),
      listLostReasons(),
      listStates(),
    ]);

    return NextResponse.json({ statuses, sources, results, lostReasons, states });
  } catch (error) {
    return errorResponse(error);
  }
}
