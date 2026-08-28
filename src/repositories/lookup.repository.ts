import { prisma } from "@/lib/prisma";

export function listLeadStatuses() {
  return prisma.leadStatus.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
}

export function listAllLeadStatuses() {
  return prisma.leadStatus.findMany({ orderBy: { sortOrder: "asc" } });
}

export function findLeadStatusById(id: string) {
  return prisma.leadStatus.findUnique({ where: { id } });
}

export function findLeadStatusByName(name: string) {
  return prisma.leadStatus.findUnique({ where: { name } });
}

export function createLeadStatus(data: { name: string; sortOrder: number; isTerminal: boolean }) {
  return prisma.leadStatus.create({ data });
}

export function updateLeadStatus(id: string, data: { sortOrder?: number; isTerminal?: boolean; active?: boolean }) {
  return prisma.leadStatus.update({ where: { id }, data });
}

export function listLeadSources() {
  return prisma.leadSource.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export function listAllLeadSources() {
  return prisma.leadSource.findMany({ orderBy: { name: "asc" } });
}

export function createLeadSource(data: { name: string }) {
  return prisma.leadSource.create({ data });
}

export function updateLeadSource(id: string, data: { name?: string; active?: boolean }) {
  return prisma.leadSource.update({ where: { id }, data });
}

export function listResultOptions() {
  return prisma.resultOption.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export function findResultOptionById(id: string) {
  return prisma.resultOption.findUnique({ where: { id } });
}

export function listAllResultOptions() {
  return prisma.resultOption.findMany({ orderBy: { name: "asc" } });
}

export function createResultOption(data: { name: string }) {
  return prisma.resultOption.create({ data });
}

export function updateResultOption(id: string, data: { name?: string; active?: boolean }) {
  return prisma.resultOption.update({ where: { id }, data });
}

export function listLostReasons() {
  return prisma.lostReason.findMany({ where: { active: true }, orderBy: { name: "asc" } });
}

export function listAllLostReasons() {
  return prisma.lostReason.findMany({ orderBy: { name: "asc" } });
}

export function createLostReason(data: { name: string }) {
  return prisma.lostReason.create({ data });
}

export function updateLostReason(id: string, data: { name?: string; active?: boolean }) {
  return prisma.lostReason.update({ where: { id }, data });
}

export function listStates() {
  return prisma.state.findMany({ orderBy: { name: "asc" } });
}

export function listDealerStatuses() {
  return prisma.dealerStatus.findMany({ where: { active: true }, orderBy: { sortOrder: "asc" } });
}

export function listAllDealerStatuses() {
  return prisma.dealerStatus.findMany({ orderBy: { sortOrder: "asc" } });
}

export function findDealerStatusById(id: string) {
  return prisma.dealerStatus.findUnique({ where: { id } });
}

export function findDealerStatusByName(name: string) {
  return prisma.dealerStatus.findUnique({ where: { name } });
}

export function createDealerStatus(data: { name: string; sortOrder: number }) {
  return prisma.dealerStatus.create({ data });
}

export function updateDealerStatus(id: string, data: { sortOrder?: number; active?: boolean }) {
  return prisma.dealerStatus.update({ where: { id }, data });
}

export function listFollowUpRules() {
  return prisma.followUpRule.findMany({ orderBy: [{ appliesTo: "asc" }, { sequenceNumber: "asc" }] });
}

export function findFollowUpRuleById(id: string) {
  return prisma.followUpRule.findUnique({ where: { id } });
}

export function createFollowUpRule(data: {
  sequenceNumber: number;
  daysAfterPrevious: number;
  defaultTime: string;
  appliesTo: string;
}) {
  return prisma.followUpRule.create({ data });
}

export function updateFollowUpRule(
  id: string,
  data: { daysAfterPrevious?: number; defaultTime?: string; enabled?: boolean }
) {
  return prisma.followUpRule.update({ where: { id }, data });
}

export function getSetting<T>(key: string): Promise<T | null> {
  return prisma.setting.findUnique({ where: { key } }).then((row) => (row?.value as T) ?? null);
}

export function upsertSetting(key: string, value: unknown) {
  return prisma.setting.upsert({
    where: { key },
    update: { value: value as never },
    create: { key, value: value as never },
  });
}
