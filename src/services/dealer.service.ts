import {
  createDealer as createDealerRow,
  findDealerByIdInScope,
  findDealerByPhoneNormalized,
  generateDealerCode,
  listDealers as listDealersRows,
  listOnboardingDealers,
  updateDealer as updateDealerRow,
  type DealerListFilters,
} from "@/repositories/dealer.repository";
import { findDealerStatusById, findDealerStatusByName } from "@/repositories/lookup.repository";
import { writeDealerActivity } from "@/repositories/dealer-activity.repository";
import { cancelActiveFollowUpsForDealer } from "@/repositories/followup.repository";
import { normalizePhone } from "@/lib/phone";
import { can, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getDealerVisibilityWhere } from "@/lib/rbac/scope";
import {
  DEALER_APPROVAL_STATUS_NAME,
  DEALER_CODE_ISSUE_STATUS_NAME,
  DEALER_ONBOARDING_EXCLUDED_STATUSES,
  DEALER_TERMINAL_STATUSES,
} from "@/lib/dealers/constants";
import type { CurrentUser } from "@/lib/auth/current-user";
import type { ChangeDealerStatusInput, CreateDealerInput, UpdateDealerInput } from "@/lib/validation/dealer";

export class DealerServiceError extends Error {}

export class DuplicateDealerError extends Error {
  constructor(public existing: { id: string; dealerCode: string | null; dealerName: string; phone: string }) {
    super("A dealer with this phone number already exists");
    this.name = "DuplicateDealerError";
  }
}

export class DealerNotFoundError extends Error {
  constructor() {
    super("Dealer not found");
    this.name = "DealerNotFoundError";
  }
}

export async function getDealerForUser(id: string, actor: CurrentUser) {
  const visibility = getDealerVisibilityWhere(actor);
  const dealer = await findDealerByIdInScope(id, visibility);
  if (!dealer) throw new DealerNotFoundError();
  return dealer;
}

export async function listDealersForUser(
  actor: CurrentUser,
  filters: { statusId?: string; stateId?: string; search?: string; page?: number; pageSize?: number }
) {
  const visibility = getDealerVisibilityWhere(actor);
  const where: DealerListFilters["where"] = {
    ...visibility,
    ...(filters.statusId ? { statusId: filters.statusId } : {}),
    ...(filters.stateId ? { stateId: filters.stateId } : {}),
  };

  return listDealersRows({
    where,
    search: filters.search,
    page: filters.page ?? 1,
    pageSize: Math.min(filters.pageSize ?? 25, 100),
  });
}

export async function listOnboardingDealersForUser(actor: CurrentUser) {
  const visibility = getDealerVisibilityWhere(actor);
  return listOnboardingDealers(visibility, DEALER_ONBOARDING_EXCLUDED_STATUSES);
}

export async function createDealer(input: CreateDealerInput, actor: CurrentUser) {
  if (!can(actor, PERMISSIONS.DEALERS_MANAGE)) throw new ForbiddenError();

  const phoneNormalized = normalizePhone(input.phone);
  if (!input.allowDuplicate) {
    const existing = await findDealerByPhoneNormalized(phoneNormalized);
    if (existing) throw new DuplicateDealerError(existing);
  }

  const prospectStatus = await findDealerStatusByName("PROSPECT");
  if (!prospectStatus) throw new DealerServiceError("PROSPECT dealer status is not configured");

  const dealer = await createDealerRow({
    dealerName: input.dealerName,
    contactPerson: input.contactPerson,
    phone: input.phone,
    phoneNormalized,
    altPhone: input.altPhone,
    whatsapp: input.whatsapp,
    email: input.email || undefined,
    address: input.address,
    pincode: input.pincode,
    state: input.stateId ? { connect: { id: input.stateId } } : undefined,
    district: input.districtId ? { connect: { id: input.districtId } } : undefined,
    city: input.cityId ? { connect: { id: input.cityId } } : undefined,
    gstin: input.gstin,
    pan: input.pan,
    existingBusiness: input.existingBusiness,
    existingEvBrands: input.existingEvBrands,
    investmentCapacity: input.investmentCapacity,
    status: { connect: { id: prospectStatus.id } },
    createdById: actor.id,
  });

  await writeDealerActivity({
    dealerId: dealer.id,
    type: "CREATED",
    toValue: prospectStatus.name,
    userId: actor.id,
  });

  return dealer;
}

export async function updateDealer(id: string, input: UpdateDealerInput, actor: CurrentUser) {
  if (!can(actor, PERMISSIONS.DEALERS_MANAGE)) throw new ForbiddenError();

  await getDealerForUser(id, actor); // enforces visibility + existence

  const data: Parameters<typeof updateDealerRow>[1] = {
    dealerName: input.dealerName,
    contactPerson: input.contactPerson,
    phone: input.phone,
    altPhone: input.altPhone,
    whatsapp: input.whatsapp,
    email: input.email === "" ? null : input.email,
    address: input.address,
    pincode: input.pincode,
    gstin: input.gstin,
    pan: input.pan,
    existingBusiness: input.existingBusiness,
    existingEvBrands: input.existingEvBrands,
    investmentCapacity: input.investmentCapacity,
  };
  if (input.phone) data.phoneNormalized = normalizePhone(input.phone);
  if (input.stateId !== undefined)
    data.state = input.stateId ? { connect: { id: input.stateId } } : { disconnect: true };
  if (input.districtId !== undefined)
    data.district = input.districtId ? { connect: { id: input.districtId } } : { disconnect: true };
  if (input.cityId !== undefined) data.city = input.cityId ? { connect: { id: input.cityId } } : { disconnect: true };

  return updateDealerRow(id, data);
}

export async function changeDealerStatus(id: string, input: ChangeDealerStatusInput, actor: CurrentUser) {
  const dealer = await getDealerForUser(id, actor);
  const targetStatus = await findDealerStatusById(input.statusId);
  if (!targetStatus) throw new DealerServiceError("Status not found");

  const requiredPermission =
    targetStatus.name === DEALER_APPROVAL_STATUS_NAME
      ? PERMISSIONS.DEALERS_APPROVE_ONBOARDING
      : PERMISSIONS.DEALERS_MANAGE;
  if (!can(actor, requiredPermission)) throw new ForbiddenError();

  const shouldIssueCode = targetStatus.name === DEALER_CODE_ISSUE_STATUS_NAME && !dealer.dealerCode;
  const dealerCode = shouldIssueCode ? await generateDealerCode() : undefined;

  const updated = await updateDealerRow(id, {
    status: { connect: { id: targetStatus.id } },
    dealerCode,
  });

  await writeDealerActivity({
    dealerId: id,
    type: "STATUS_CHANGED",
    fromValue: dealer.status.name,
    toValue: targetStatus.name,
    meta: input.note ? { note: input.note } : undefined,
    userId: actor.id,
  });

  if (shouldIssueCode) {
    await writeDealerActivity({
      dealerId: id,
      type: "DEALER_CODE_ISSUED",
      toValue: dealerCode,
      userId: actor.id,
    });
  }

  if (DEALER_TERMINAL_STATUSES.includes(targetStatus.name)) {
    const cancelled = await cancelActiveFollowUpsForDealer(id);
    if (cancelled.count > 0) {
      await writeDealerActivity({
        dealerId: id,
        type: "FOLLOWUP_AUTO_CANCELLED",
        meta: { count: cancelled.count, reason: `Dealer moved to ${targetStatus.name}` },
        userId: actor.id,
      });
    }
  }

  return updated;
}
