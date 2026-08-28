import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

const LEAD_INCLUDE = {
  status: true,
  source: true,
  state: true,
  district: true,
  city: true,
  result: true,
  lostReason: true,
  assignedUser: { select: { id: true, name: true, email: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.LeadInclude;

export async function generateLeadCode(): Promise<string> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`SELECT nextval('lead_code_seq') as n`;
  const n = rows[0].n;
  return `GATTI-${n.toString().padStart(6, "0")}`;
}

export function findLeadByPhoneNormalized(phoneNormalized: string) {
  return prisma.lead.findFirst({
    where: { phoneNormalized, deletedAt: null },
    select: { id: true, leadCode: true, name: true, phone: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export function findLeadByIdInScope(id: string, scopeWhere: Prisma.LeadWhereInput) {
  // AND, not spread: scopeWhere's sentinel `{ id: "__no_access__" }` (see
  // getLeadVisibilityWhere) would otherwise be silently overwritten by the
  // `id` key below when both objects are flattened into one, quietly
  // turning "deny" into an unscoped lookup.
  return prisma.lead.findFirst({
    where: { AND: [scopeWhere, { id, deletedAt: null }] },
    include: LEAD_INCLUDE,
  });
}

export function createLead(data: Prisma.LeadCreateInput) {
  return prisma.lead.create({ data, include: LEAD_INCLUDE });
}

export function updateLead(id: string, data: Prisma.LeadUpdateInput) {
  return prisma.lead.update({ where: { id }, data, include: LEAD_INCLUDE });
}

export type LeadListFilters = {
  where: Prisma.LeadWhereInput;
  search?: string;
  page: number;
  pageSize: number;
};

export async function listLeads({ where, search, page, pageSize }: LeadListFilters) {
  // AND, not spread: `where` can itself carry an `OR` (team-scope
  // visibility, see getLeadVisibilityWhere) that a second `OR` key from
  // the search clause would silently overwrite instead of narrow —
  // quietly turning "my team's leads matching X" into "any lead matching X".
  const searchDigits = search?.replace(/\D/g, "");
  const finalWhere: Prisma.LeadWhereInput = {
    AND: [
      where,
      { deletedAt: null },
      search
        ? {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              // An empty digit string would otherwise `contains`-match every row.
              ...(searchDigits ? [{ phoneNormalized: { contains: searchDigits } }] : []),
              { leadCode: { contains: search, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };

  const [total, leads] = await Promise.all([
    prisma.lead.count({ where: finalWhere }),
    prisma.lead.findMany({
      where: finalWhere,
      include: LEAD_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { leads, total };
}

const KANBAN_CARD_SELECT = {
  id: true,
  leadCode: true,
  name: true,
  phone: true,
  temperature: true,
  priority: true,
  interestedProduct: true,
  updatedAt: true,
  assignedUser: { select: { id: true, name: true } },
} satisfies Prisma.LeadSelect;

/**
 * One count+take query pair per status. Each is a fast indexed lookup
 * (`@@index([statusId])`), and the per-column cap keeps the board light
 * even with 100k+ leads — see PIPELINE_COLUMN_CARD_LIMIT.
 */
export async function listLeadsGroupedByStatus(
  where: Prisma.LeadWhereInput,
  statusIds: string[],
  perColumnLimit: number
) {
  return Promise.all(
    statusIds.map(async (statusId) => {
      const columnWhere: Prisma.LeadWhereInput = { ...where, statusId, deletedAt: null };
      const [total, leads] = await Promise.all([
        prisma.lead.count({ where: columnWhere }),
        prisma.lead.findMany({
          where: columnWhere,
          select: KANBAN_CARD_SELECT,
          orderBy: { updatedAt: "desc" },
          take: perColumnLimit,
        }),
      ]);
      return { statusId, total, leads };
    })
  );
}
