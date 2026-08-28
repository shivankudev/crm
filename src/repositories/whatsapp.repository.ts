import { prisma } from "@/lib/prisma";

export function findWhatsAppSessionByUserId(userId: string) {
  return prisma.whatsAppSession.findUnique({ where: { userId } });
}

export function upsertWhatsAppSession(
  userId: string,
  data: { openwaSessionId: string; status: string; phone?: string | null }
) {
  return prisma.whatsAppSession.upsert({
    where: { userId },
    update: { status: data.status, phone: data.phone, lastSyncedAt: new Date() },
    create: { userId, openwaSessionId: data.openwaSessionId, status: data.status, phone: data.phone },
  });
}

export function listWhatsAppTemplatesForUser(userId: string) {
  return prisma.whatsAppTemplate.findMany({ where: { userId } });
}

export function findWhatsAppTemplate(userId: string, triggerType: string, triggerKey: string) {
  return prisma.whatsAppTemplate.findUnique({
    where: { userId_triggerType_triggerKey: { userId, triggerType, triggerKey } },
  });
}

export function createWhatsAppMessageLog(data: {
  userId: string;
  leadId?: string | null;
  triggerType: string;
  triggerKey: string;
  phone: string;
  messageType: string;
  waMessageId?: string | null;
  status: string;
  error?: string | null;
}) {
  return prisma.whatsAppMessageLog.create({ data });
}

/** Every automated message sent to one lead — merged into its Timeline tab. */
export function listWhatsAppMessagesForLead(leadId: string) {
  return prisma.whatsAppMessageLog.findMany({
    where: { leadId },
    orderBy: { createdAt: "desc" },
  });
}

/** Newest-first send history for one telecaller — powers the dashboard panel. */
export function listWhatsAppMessageLogs(userId: string, limit = 20) {
  return prisma.whatsAppMessageLog.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { lead: { select: { id: true, name: true, leadCode: true } } },
  });
}

/** Rows still awaiting a WhatsApp ack — the only ones worth re-checking. */
export function listPendingWhatsAppMessageLogs(userId: string, limit = 50) {
  return prisma.whatsAppMessageLog.findMany({
    where: { userId, waMessageId: { not: null }, status: { in: ["SENT", "DELIVERED"] } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export function updateWhatsAppMessageLogStatus(id: string, status: string) {
  return prisma.whatsAppMessageLog.update({ where: { id }, data: { status } });
}

/** Counts by status over a window — the dashboard's at-a-glance summary. */
export async function countWhatsAppMessagesByStatus(userId: string, since: Date) {
  const rows = await prisma.whatsAppMessageLog.groupBy({
    by: ["status"],
    where: { userId, createdAt: { gte: since } },
    _count: { _all: true },
  });
  return Object.fromEntries(rows.map((r) => [r.status, r._count._all])) as Record<string, number>;
}

export function upsertWhatsAppTemplate(
  userId: string,
  triggerType: string,
  triggerKey: string,
  data: {
    text?: string | null;
    mediaKey?: string | null;
    mediaFileName?: string | null;
    mediaMimeType?: string | null;
    enabled?: boolean;
  }
) {
  return prisma.whatsAppTemplate.upsert({
    where: { userId_triggerType_triggerKey: { userId, triggerType, triggerKey } },
    update: data,
    create: { userId, triggerType, triggerKey, ...data },
  });
}

/**
 * Drops a user's WhatsApp config (session + templates) in one transaction.
 * Message logs are deliberately NOT touched — those are business record and
 * are counted by getUserActivityCounts() to block deletion instead.
 */
export function deleteWhatsAppConfigForUser(userId: string) {
  return prisma.$transaction([
    prisma.whatsAppTemplate.deleteMany({ where: { userId } }),
    prisma.whatsAppSession.deleteMany({ where: { userId } }),
  ]);
}
