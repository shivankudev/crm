import { prisma } from "@/lib/prisma";
import { getLeadVisibilityWhere, getDealerVisibilityWhere } from "@/lib/rbac/scope";
import { can, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { toCsv } from "@/lib/csv";
import type { CurrentUser } from "@/lib/auth/current-user";

/** Bounds a single export request — larger datasets should be filtered (by date/status) into multiple exports. */
const EXPORT_ROW_LIMIT = 50_000;

function requireImportExport(actor: CurrentUser) {
  if (!can(actor, PERMISSIONS.IMPORT_EXPORT)) throw new ForbiddenError();
}

export async function exportLeadsCsv(actor: CurrentUser): Promise<string> {
  requireImportExport(actor);
  const where = await getLeadVisibilityWhere(actor);

  const leads = await prisma.lead.findMany({
    where: { ...where, deletedAt: null },
    include: {
      status: true,
      source: true,
      state: true,
      assignedUser: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: EXPORT_ROW_LIMIT,
  });

  return toCsv(
    [
      "leadCode",
      "name",
      "phone",
      "email",
      "status",
      "source",
      "state",
      "temperature",
      "priority",
      "assignedTo",
      "interestedProduct",
      "createdAt",
    ],
    leads.map((l) => [
      l.leadCode,
      l.name,
      l.phone,
      l.email,
      l.status.name,
      l.source?.name,
      l.state?.name,
      l.temperature,
      l.priority,
      l.assignedUser?.name,
      l.interestedProduct,
      l.createdAt.toISOString(),
    ])
  );
}

export async function exportDealersCsv(actor: CurrentUser): Promise<string> {
  requireImportExport(actor);
  const where = getDealerVisibilityWhere(actor);

  const dealers = await prisma.dealer.findMany({
    where: { ...where, deletedAt: null },
    include: { status: true, state: true },
    orderBy: { createdAt: "desc" },
    take: EXPORT_ROW_LIMIT,
  });

  return toCsv(
    ["dealerCode", "dealerName", "contactPerson", "phone", "email", "status", "state", "gstin", "createdAt"],
    dealers.map((d) => [
      d.dealerCode,
      d.dealerName,
      d.contactPerson,
      d.phone,
      d.email,
      d.status.name,
      d.state?.name,
      d.gstin,
      d.createdAt.toISOString(),
    ])
  );
}
