import {
  createDealerDocument,
  deleteDealerDocument as deleteDealerDocumentRow,
  findDealerDocumentById,
  listDealerDocuments,
} from "@/repositories/dealer-document.repository";
import { writeDealerActivity } from "@/repositories/dealer-activity.repository";
import { getDealerForUser } from "@/services/dealer.service";
import { deleteFileByKey, readFileByKey, saveFile } from "@/lib/storage";
import { can, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import type { CurrentUser } from "@/lib/auth/current-user";

export class DealerDocumentNotFoundError extends Error {
  constructor() {
    super("Document not found");
    this.name = "DealerDocumentNotFoundError";
  }
}

export async function uploadDealerDocument(
  dealerId: string,
  input: { docType: string; fileName: string; mimeType: string | null; data: Buffer },
  actor: CurrentUser
) {
  if (!can(actor, PERMISSIONS.DEALERS_MANAGE)) throw new ForbiddenError();
  await getDealerForUser(dealerId, actor); // enforces visibility + existence

  const { key } = await saveFile(`dealers/${dealerId}`, input.fileName, input.data);
  const doc = await createDealerDocument({
    dealerId,
    docType: input.docType,
    fileUrl: key,
    fileName: input.fileName,
  });

  await writeDealerActivity({
    dealerId,
    type: "DOCUMENT_UPLOADED",
    toValue: input.docType,
    meta: { fileName: input.fileName },
    userId: actor.id,
  });

  return doc;
}

export async function listDealerDocumentsForUser(dealerId: string, actor: CurrentUser) {
  await getDealerForUser(dealerId, actor);
  return listDealerDocuments(dealerId);
}

export async function downloadDealerDocument(documentId: string, actor: CurrentUser) {
  const doc = await findDealerDocumentById(documentId);
  if (!doc) throw new DealerDocumentNotFoundError();

  await getDealerForUser(doc.dealerId, actor); // enforces visibility + existence, 404s otherwise

  const data = await readFileByKey(doc.fileUrl);
  return { data, fileName: doc.fileName };
}

export async function deleteDealerDocument(documentId: string, actor: CurrentUser) {
  if (!can(actor, PERMISSIONS.DEALERS_MANAGE)) throw new ForbiddenError();

  const doc = await findDealerDocumentById(documentId);
  if (!doc) throw new DealerDocumentNotFoundError();
  await getDealerForUser(doc.dealerId, actor);

  await deleteDealerDocumentRow(documentId);
  await deleteFileByKey(doc.fileUrl);

  await writeDealerActivity({
    dealerId: doc.dealerId,
    type: "DOCUMENT_DELETED",
    toValue: doc.docType,
    meta: { fileName: doc.fileName },
    userId: actor.id,
  });
}
