import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { can } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getDealerForUser, DealerNotFoundError } from "@/services/dealer.service";
import { listDealerStatuses, listResultOptions, listStates } from "@/repositories/lookup.repository";
import { listDealerActivity } from "@/repositories/dealer-activity.repository";
import { listNotesForDealer } from "@/repositories/note.repository";
import { listFollowUpsForDealer } from "@/repositories/followup.repository";
import { listDealerDocuments } from "@/repositories/dealer-document.repository";
import { findUserById } from "@/repositories/user.repository";
import { listOrdersForDealerForUser } from "@/services/order.service";
import { listProductsForUser } from "@/services/product.service";
import { DEALER_DOC_TYPES } from "@/lib/dealers/constants";
import { DealerProfile } from "@/app/(app)/dealers/[id]/dealer-profile";

export default async function DealerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  let dealer;
  try {
    dealer = await getDealerForUser(id, user);
  } catch (error) {
    if (error instanceof DealerNotFoundError) notFound();
    throw error;
  }

  const canManage = can(user, PERMISSIONS.DEALERS_MANAGE);
  const canApprove = can(user, PERMISSIONS.DEALERS_APPROVE_ONBOARDING);

  const [activity, notes, followUps, documents, statuses, states, results, createdBy, orders, products] =
    await Promise.all([
      listDealerActivity(id),
      listNotesForDealer(id),
      listFollowUpsForDealer(id),
      listDealerDocuments(id),
      listDealerStatuses(),
      listStates(),
      listResultOptions(),
      findUserById(dealer.createdById),
      listOrdersForDealerForUser(id, user),
      listProductsForUser(user),
    ]);

  return (
    <DealerProfile
      canManage={canManage}
      canApprove={canApprove}
      docTypes={DEALER_DOC_TYPES}
      dealer={{
        id: dealer.id,
        dealerCode: dealer.dealerCode,
        dealerName: dealer.dealerName,
        phone: dealer.phone,
        altPhone: dealer.altPhone,
        whatsapp: dealer.whatsapp,
        email: dealer.email,
        address: dealer.address,
        pincode: dealer.pincode,
        contactPerson: dealer.contactPerson,
        gstin: dealer.gstin,
        pan: dealer.pan,
        existingBusiness: dealer.existingBusiness,
        existingEvBrands: dealer.existingEvBrands,
        investmentCapacity: dealer.investmentCapacity,
        status: { id: dealer.status.id, name: dealer.status.name },
        state: dealer.state ? { id: dealer.state.id, name: dealer.state.name } : null,
        createdByName: createdBy?.name ?? "Unknown",
        createdAt: dealer.createdAt.toISOString(),
      }}
      activity={activity.map((a) => ({
        id: a.id,
        type: a.type,
        fromValue: a.fromValue,
        toValue: a.toValue,
        meta: a.meta as Record<string, unknown> | null,
        createdAt: a.createdAt.toISOString(),
      }))}
      notes={notes.map((n) => ({ id: n.id, body: n.body, user: n.user, createdAt: n.createdAt.toISOString() }))}
      followUps={followUps.map((f) => ({
        id: f.id,
        type: f.type,
        sequenceNumber: f.sequenceNumber,
        scheduledDate: f.scheduledDate.toISOString(),
        scheduledTime: f.scheduledTime,
        status: f.status,
        notes: f.notes,
        result: f.result ? { name: f.result.name } : null,
        assignedUser: f.assignedUser,
      }))}
      documents={documents.map((d) => ({
        id: d.id,
        docType: d.docType,
        fileName: d.fileName,
        uploadedAt: d.uploadedAt.toISOString(),
      }))}
      statuses={statuses.map((s) => ({ id: s.id, name: s.name }))}
      states={states.map((s) => ({ id: s.id, name: s.name }))}
      results={results.map((r) => ({ id: r.id, name: r.name }))}
      orders={orders.map((o) => ({
        id: o.id,
        orderCode: o.orderCode,
        paymentStatus: o.paymentStatus,
        deliveryStatus: o.deliveryStatus,
        totalAmount: Number(o.totalAmount),
        orderDate: o.orderDate.toISOString(),
        items: o.items.map((it) => ({
          id: it.id,
          productName: it.product.name,
          quantity: it.quantity,
          unitPrice: Number(it.unitPrice),
          lineTotal: Number(it.lineTotal),
        })),
      }))}
      products={products.map((p) => ({ id: p.id, name: p.name, price: Number(p.price) }))}
    />
  );
}
