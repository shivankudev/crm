import { prisma } from "@/lib/prisma";

export function createNote(data: { leadId?: string; dealerId?: string; userId: string; body: string }) {
  return prisma.note.create({
    data,
    include: { user: { select: { id: true, name: true } } },
  });
}

export function listNotesForLead(leadId: string) {
  return prisma.note.findMany({
    where: { leadId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export function listNotesForDealer(dealerId: string) {
  return prisma.note.findMany({
    where: { dealerId },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}
