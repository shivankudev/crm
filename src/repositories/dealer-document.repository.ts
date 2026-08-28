import { prisma } from "@/lib/prisma";

export function createDealerDocument(data: {
  dealerId: string;
  docType: string;
  fileUrl: string;
  fileName: string;
}) {
  return prisma.dealerDocument.create({ data });
}

export function listDealerDocuments(dealerId: string) {
  return prisma.dealerDocument.findMany({
    where: { dealerId },
    orderBy: { uploadedAt: "desc" },
  });
}

export function findDealerDocumentById(id: string) {
  return prisma.dealerDocument.findUnique({ where: { id } });
}

export function deleteDealerDocument(id: string) {
  return prisma.dealerDocument.delete({ where: { id } });
}
