import {
  createDealerStatus,
  createFollowUpRule,
  createLeadSource,
  createLeadStatus,
  createLostReason,
  createResultOption,
  findFollowUpRuleById,
  listAllDealerStatuses,
  listAllLeadSources,
  listAllLeadStatuses,
  listAllLostReasons,
  listAllResultOptions,
  listFollowUpRules,
  updateDealerStatus,
  updateFollowUpRule,
  updateLeadSource,
  updateLeadStatus,
  updateLostReason,
  updateResultOption,
  upsertSetting,
} from "@/repositories/lookup.repository";
import { reshiftFollowUpsForRuleChange } from "@/services/followup.service";
import { can, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { TELECALLER_ALLOWED_STATUSES_SETTING_KEY } from "@/lib/leads/constants";
import type { CurrentUser } from "@/lib/auth/current-user";

function requireSettingsAccess(actor: CurrentUser) {
  if (!can(actor, PERMISSIONS.SETTINGS_MANAGE) && !can(actor, PERMISSIONS.SETTINGS_MANAGE_PARTIAL)) {
    throw new ForbiddenError();
  }
}

// --- Lead statuses ---------------------------------------------------

export async function listLeadStatusesForSettings(actor: CurrentUser) {
  requireSettingsAccess(actor);
  return listAllLeadStatuses();
}

export async function createLeadStatusForSettings(
  input: { name: string; sortOrder: number; isTerminal: boolean },
  actor: CurrentUser
) {
  requireSettingsAccess(actor);
  return createLeadStatus(input);
}

export async function updateLeadStatusForSettings(
  id: string,
  input: { sortOrder?: number; isTerminal?: boolean; active?: boolean },
  actor: CurrentUser
) {
  requireSettingsAccess(actor);
  return updateLeadStatus(id, input);
}

// --- Lead sources / results / lost reasons (simple name+active lookups) ---

export async function listLeadSourcesForSettings(actor: CurrentUser) {
  requireSettingsAccess(actor);
  return listAllLeadSources();
}
export async function createLeadSourceForSettings(name: string, actor: CurrentUser) {
  requireSettingsAccess(actor);
  return createLeadSource({ name });
}
export async function updateLeadSourceForSettings(
  id: string,
  input: { name?: string; active?: boolean },
  actor: CurrentUser
) {
  requireSettingsAccess(actor);
  return updateLeadSource(id, input);
}

export async function listResultOptionsForSettings(actor: CurrentUser) {
  requireSettingsAccess(actor);
  return listAllResultOptions();
}
export async function createResultOptionForSettings(name: string, actor: CurrentUser) {
  requireSettingsAccess(actor);
  return createResultOption({ name });
}
export async function updateResultOptionForSettings(
  id: string,
  input: { name?: string; active?: boolean },
  actor: CurrentUser
) {
  requireSettingsAccess(actor);
  return updateResultOption(id, input);
}

export async function listLostReasonsForSettings(actor: CurrentUser) {
  requireSettingsAccess(actor);
  return listAllLostReasons();
}
export async function createLostReasonForSettings(name: string, actor: CurrentUser) {
  requireSettingsAccess(actor);
  return createLostReason({ name });
}
export async function updateLostReasonForSettings(
  id: string,
  input: { name?: string; active?: boolean },
  actor: CurrentUser
) {
  requireSettingsAccess(actor);
  return updateLostReason(id, input);
}

// --- Dealer statuses ---------------------------------------------------

export async function listDealerStatusesForSettings(actor: CurrentUser) {
  requireSettingsAccess(actor);
  return listAllDealerStatuses();
}
export async function createDealerStatusForSettings(
  input: { name: string; sortOrder: number },
  actor: CurrentUser
) {
  requireSettingsAccess(actor);
  return createDealerStatus(input);
}
export async function updateDealerStatusForSettings(
  id: string,
  input: { sortOrder?: number; active?: boolean },
  actor: CurrentUser
) {
  requireSettingsAccess(actor);
  return updateDealerStatus(id, input);
}

// --- Follow-up rules + telecaller status limit --------------------------

export async function listFollowUpRulesForSettings(actor: CurrentUser) {
  requireSettingsAccess(actor);
  return listFollowUpRules();
}
export async function createFollowUpRuleForSettings(
  input: { sequenceNumber: number; daysAfterPrevious: number; defaultTime: string; appliesTo: string },
  actor: CurrentUser
) {
  requireSettingsAccess(actor);
  return createFollowUpRule(input);
}
export async function updateFollowUpRuleForSettings(
  id: string,
  input: { daysAfterPrevious?: number; defaultTime?: string; enabled?: boolean; applyToExisting?: boolean },
  actor: CurrentUser
) {
  requireSettingsAccess(actor);

  const before = await findFollowUpRuleById(id);
  const rule = await updateFollowUpRule(id, {
    daysAfterPrevious: input.daysAfterPrevious,
    defaultTime: input.defaultTime,
    enabled: input.enabled,
  });

  // Only touches already-scheduled work when explicitly asked — silently
  // leaving old leads on their original dates is the safe default;
  // reshifting them is an opt-in per §6.
  let shiftedCount = 0;
  if (input.applyToExisting && before) {
    const deltaDays =
      input.daysAfterPrevious !== undefined ? input.daysAfterPrevious - before.daysAfterPrevious : 0;
    const newDefaultTime =
      input.defaultTime !== undefined && input.defaultTime !== before.defaultTime ? input.defaultTime : undefined;

    if (deltaDays !== 0 || newDefaultTime) {
      const result = await reshiftFollowUpsForRuleChange(
        before.sequenceNumber,
        before.appliesTo as "LEAD" | "DEALER" | "BOTH",
        deltaDays,
        newDefaultTime,
        actor
      );
      shiftedCount = result.shiftedCount;
    }
  }

  return { rule, shiftedCount };
}

export async function updateTelecallerAllowedStatuses(statusNames: string[], actor: CurrentUser) {
  requireSettingsAccess(actor);
  return upsertSetting(TELECALLER_ALLOWED_STATUSES_SETTING_KEY, statusNames);
}
