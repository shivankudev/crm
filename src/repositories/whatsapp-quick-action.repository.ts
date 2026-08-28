import { prisma } from "@/lib/prisma";

const WITH_MEDIA = { media: { orderBy: { sortOrder: "asc" } } } as const;

/** Buttons the telecalling screen should show — enabled only, in display order. */
export function listEnabledQuickActions() {
  return prisma.whatsAppQuickAction.findMany({
    where: { enabled: true },
    orderBy: { sortOrder: "asc" },
    include: WITH_MEDIA,
  });
}

/** Every button including disabled ones — the admin editor's view. */
export function listAllQuickActions() {
  return prisma.whatsAppQuickAction.findMany({
    orderBy: { sortOrder: "asc" },
    include: WITH_MEDIA,
  });
}

export function findQuickAction(id: string) {
  return prisma.whatsAppQuickAction.findUnique({ where: { id }, include: WITH_MEDIA });
}

export async function createQuickAction(data: { label: string; text?: string | null }) {
  const last = await prisma.whatsAppQuickAction.findFirst({ orderBy: { sortOrder: "desc" } });
  return prisma.whatsAppQuickAction.create({
    data: { ...data, sortOrder: (last?.sortOrder ?? 0) + 1 },
    include: WITH_MEDIA,
  });
}

export function updateQuickAction(
  id: string,
  data: {
    label?: string;
    text?: string | null;
    enabled?: boolean;
    sortOrder?: number;
    latitude?: number | null;
    longitude?: number | null;
    locationName?: string | null;
  }
) {
  return prisma.whatsAppQuickAction.update({ where: { id }, data, include: WITH_MEDIA });
}

/** Cascades to its media rows (schema onDelete: Cascade); files are removed by the service. */
export function deleteQuickAction(id: string) {
  return prisma.whatsAppQuickAction.delete({ where: { id } });
}

export async function addQuickActionMedia(
  quickActionId: string,
  files: { mediaKey: string; fileName: string; mimeType: string }[]
) {
  const last = await prisma.whatsAppQuickActionMedia.findFirst({
    where: { quickActionId },
    orderBy: { sortOrder: "desc" },
  });
  let order = (last?.sortOrder ?? 0) + 1;
  for (const f of files) {
    await prisma.whatsAppQuickActionMedia.create({ data: { quickActionId, ...f, sortOrder: order++ } });
  }
}

/**
 * Rewrites display order for every button in one transaction.
 *
 * Sequential 0..n-1 rather than swapping two rows: repeated swaps on rows
 * that started life sharing a sortOrder (the schema default is 0) leave
 * ties that Postgres is free to break either way, so the list would
 * reshuffle on its own between page loads.
 */
export function reorderQuickActions(ids: string[]) {
  return prisma.$transaction(
    ids.map((id, index) => prisma.whatsAppQuickAction.update({ where: { id }, data: { sortOrder: index } }))
  );
}

/** Same, for one button's attachments — order is the order they're sent in. */
export function reorderQuickActionMedia(ids: string[]) {
  return prisma.$transaction(
    ids.map((id, index) => prisma.whatsAppQuickActionMedia.update({ where: { id }, data: { sortOrder: index } }))
  );
}

export function findQuickActionMedia(id: string) {
  return prisma.whatsAppQuickActionMedia.findUnique({ where: { id } });
}

export function deleteQuickActionMedia(id: string) {
  return prisma.whatsAppQuickActionMedia.delete({ where: { id } });
}
