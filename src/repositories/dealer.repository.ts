import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

// Dealer has a plain `createdById` scalar, no `createdBy` relation field
// in the schema (unlike Lead) — resolve the creator's name separately
// where needed (see dealer.service.ts) rather than including it here.
const DEALER_INCLUDE = {
  status: true,
  state: true,
  district: true,
  city: true,
} satisfies Prisma.DealerInclude;

export async function generateDealerCode(): Promise<string> {
  const rows = await prisma.$queryRaw<{ n: bigint }[]>`SELECT nextval('dealer_code_seq') as n`;
  const n = rows[0].n;
  return `GATTI-DLR-${n.toString().padStart(6, "0")}`;
}

export function findDealerByPhoneNormalized(phoneNormalized: string) {
  return prisma.dealer.findFirst({
    where: { phoneNormalized, deletedAt: null },
    select: { id: true, dealerCode: true, dealerName: true, phone: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });
}

export function findDealerByIdInScope(id: string, scopeWhere: Prisma.DealerWhereInput) {
  // AND, not spread: scopeWhere's sentinel `{ id: "__no_access__" }` (see
  // getDealerVisibilityWhere) would otherwise be silently overwritten by
  // the `id` key below when both objects are flattened into one, quietly
  // turning "deny" into an unscoped lookup.
  return prisma.dealer.findFirst({
    where: { AND: [scopeWhere, { id, deletedAt: null }] },
    include: DEALER_INCLUDE,
  });
}

export function createDealer(data: Prisma.DealerCreateInput) {
  return prisma.dealer.create({ data, include: DEALER_INCLUDE });
}

/**
 * Duplicate-checked insert, atomic against concurrent creates of the same
 * number — the dealer-side twin of createLeadCheckingDuplicate, and racy
 * in exactly the same way before this: six simultaneous submissions of one
 * phone number produced six dealers. See that function for why an advisory
 * lock is used rather than a unique constraint.
 */
export function createDealerCheckingDuplicate(
  data: Prisma.DealerCreateInput,
  phoneNormalized: string
): Promise<{
  dealer: Prisma.DealerGetPayload<{ include: typeof DEALER_INCLUDE }> | null;
  existing: DuplicateDealerCandidate | null;
}> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${phoneNormalized}))`;

    const existing = await tx.dealer.findFirst({
      where: { phoneNormalized, deletedAt: null },
      select: { id: true, dealerCode: true, dealerName: true, phone: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return { dealer: null, existing };

    const dealer = await tx.dealer.create({ data, include: DEALER_INCLUDE });
    return { dealer, existing: null };
  });
}

type DuplicateDealerCandidate = {
  id: string;
  dealerCode: string | null;
  dealerName: string;
  phone: string;
  createdAt: Date;
};

export function updateDealer(id: string, data: Prisma.DealerUpdateInput) {
  return prisma.dealer.update({ where: { id }, data, include: DEALER_INCLUDE });
}

export type DealerListFilters = {
  where: Prisma.DealerWhereInput;
  search?: string;
  page: number;
  pageSize: number;
};

export async function listDealers({ where, search, page, pageSize }: DealerListFilters) {
  // AND, not spread — same reasoning as listLeads: `where` may carry an
  // `OR` (or the `id: "__no_access__"` sentinel) that a second key from
  // the search clause could otherwise silently overwrite.
  const searchDigits = search?.replace(/\D/g, "");
  const finalWhere: Prisma.DealerWhereInput = {
    AND: [
      where,
      { deletedAt: null },
      search
        ? {
            OR: [
              { dealerName: { contains: search, mode: "insensitive" } },
              // An empty digit string would otherwise `contains`-match every row.
              ...(searchDigits ? [{ phoneNormalized: { contains: searchDigits } }] : []),
              { dealerCode: { contains: search, mode: "insensitive" } },
            ],
          }
        : {},
    ],
  };

  const [total, dealers] = await Promise.all([
    prisma.dealer.count({ where: finalWhere }),
    prisma.dealer.findMany({
      where: finalWhere,
      include: DEALER_INCLUDE,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  return { dealers, total };
}

/** Dealers mid-onboarding (past PROSPECT, not yet at a terminal state) — feeds /dealers/onboarding. */
export function listOnboardingDealers(where: Prisma.DealerWhereInput, excludeStatusNames: string[]) {
  return prisma.dealer.findMany({
    where: { ...where, deletedAt: null, status: { name: { notIn: excludeStatusNames } } },
    include: DEALER_INCLUDE,
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
}
