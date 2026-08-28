import {
  createLeadSheet,
  deleteLeadSheet,
  findLeadSheet,
  listLeadSheets,
  listPollableLeadSheets,
  setLeadSheetAssignees,
  updateLeadSheet,
} from "@/repositories/lead-sheet.repository";
import { createLead, DuplicateLeadError } from "@/services/lead.service";
import { findExistingPhoneSet } from "@/repositories/lead.repository";
import { fetchSheetGrid, extractSpreadsheetId, GoogleSheetsError } from "@/lib/google-sheets";
import { canonicalizePhone } from "@/lib/phone";
import { can, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { prisma } from "@/lib/prisma";
import type { CurrentUser } from "@/lib/auth/current-user";

export class LeadSheetError extends Error {}

/**
 * New leads created per run.
 *
 * A first sync against an established intake sheet can face thousands of
 * rows at once — each one a transaction, a duplicate check and an activity
 * write. Capping means a big sheet drains over successive polls rather than
 * tying the worker up in one long batch.
 */
const MAX_ROWS_PER_SYNC = 300;

export const ACCESS_MODES = ["SERVICE_ACCOUNT", "PUBLISHED_CSV"] as const;
export type AccessMode = (typeof ACCESS_MODES)[number];

/** Guards every entry point here: sheet wiring is an admin-only setting. */
function requireAdmin(actor: CurrentUser) {
  if (!can(actor, PERMISSIONS.SETTINGS_MANAGE) && !can(actor, PERMISSIONS.SETTINGS_MANAGE_PARTIAL)) {
    throw new ForbiddenError();
  }
}

// --- Reads / config ---------------------------------------------------

export function listLeadSheetsForAdmin(actor: CurrentUser) {
  requireAdmin(actor);
  return listLeadSheets();
}

export async function createLeadSheetForAdmin(
  actor: CurrentUser,
  input: { name: string; accessMode: AccessMode }
) {
  requireAdmin(actor);
  const name = input.name.trim();
  if (!name) throw new LeadSheetError("Give the sheet a name");
  if (!ACCESS_MODES.includes(input.accessMode)) throw new LeadSheetError("Unknown access mode");
  // Created switched off: a sheet with no location and no telecaller yet
  // would only produce errors on the next poll.
  return createLeadSheet({ name, accessMode: input.accessMode, enabled: false });
}

export async function updateLeadSheetForAdmin(
  actor: CurrentUser,
  id: string,
  input: {
    name?: string;
    enabled?: boolean;
    accessMode?: AccessMode;
    spreadsheetId?: string | null;
    sheetName?: string | null;
    csvUrl?: string | null;
    sourceId?: string | null;
    assigneeIds?: string[];
  }
) {
  requireAdmin(actor);
  const existing = await findLeadSheet(id);
  if (!existing) throw new LeadSheetError("That sheet no longer exists");

  const accessMode = input.accessMode ?? (existing.accessMode as AccessMode);
  // The admin pastes the whole browser URL; keep only the id.
  const spreadsheetId =
    input.spreadsheetId !== undefined
      ? input.spreadsheetId
        ? extractSpreadsheetId(input.spreadsheetId)
        : null
      : existing.spreadsheetId;
  const csvUrl = input.csvUrl !== undefined ? input.csvUrl || null : existing.csvUrl;

  // Turning a sheet ON is the moment it starts creating real leads, so the
  // configuration has to be complete before that is allowed — otherwise the
  // first anyone hears of a mistake is an error on a background poll.
  const enabled = input.enabled ?? existing.enabled;
  if (enabled) {
    if (accessMode === "SERVICE_ACCOUNT" && !spreadsheetId) {
      throw new LeadSheetError("Add the Google Sheet link before turning this on");
    }
    if (accessMode === "PUBLISHED_CSV" && !csvUrl) {
      throw new LeadSheetError("Add the published CSV link before turning this on");
    }
    const assignees = input.assigneeIds ?? existing.assignees.map((a) => a.userId);
    if (assignees.length === 0) {
      throw new LeadSheetError("Choose at least one telecaller to receive these leads");
    }
  }

  if (input.assigneeIds) {
    const valid = await prisma.user.findMany({
      where: { id: { in: input.assigneeIds }, active: true },
      select: { id: true },
    });
    if (valid.length !== input.assigneeIds.length) {
      throw new LeadSheetError("One of those telecallers no longer exists or is deactivated");
    }
    await setLeadSheetAssignees(id, input.assigneeIds);
  }

  return updateLeadSheet(id, {
    name: input.name?.trim() || undefined,
    enabled,
    accessMode,
    spreadsheetId,
    sheetName: input.sheetName !== undefined ? input.sheetName || null : undefined,
    csvUrl,
    source:
      input.sourceId === undefined
        ? undefined
        : input.sourceId
          ? { connect: { id: input.sourceId } }
          : { disconnect: true },
  });
}

export async function deleteLeadSheetForAdmin(actor: CurrentUser, id: string) {
  requireAdmin(actor);
  const existing = await findLeadSheet(id);
  if (!existing) throw new LeadSheetError("That sheet no longer exists");
  await deleteLeadSheet(id);
}

// --- Syncing ----------------------------------------------------------

export type SyncResult = {
  sheetId: string;
  name: string;
  rowsRead: number;
  created: number;
  skippedDuplicate: number;
  skippedInvalid: number;
  failed: number;
  error?: string;
};

/** Header text -> the field it feeds. Matches the CSV importer's vocabulary. */
function headerIndex(header: string[]): Record<string, number> {
  const map: Record<string, number> = {};
  header.forEach((raw, i) => {
    const key = raw.trim().toLowerCase().replace(/[\s_-]/g, "");
    if (!(key in map)) map[key] = i;
  });
  return map;
}

/**
 * Header text -> field. Matched after lowercasing and stripping spaces,
 * underscores and dashes, so "Phone 1", "phone_1" and "PHONE1" are one key.
 *
 * "phone1"/"phone2" are here because that is what real intake sheets
 * actually use — a sheet headed "Phone 1" silently failed every row as
 * "missing phone" before, which looks identical to an empty sheet.
 */
const FIELD_ALIASES: Record<string, string[]> = {
  name: ["name", "fullname", "leadname", "customername"],
  phone: ["phone", "phone1", "phonenumber", "mobile", "mobile1", "mobilenumber", "contact", "contactnumber"],
  phone2: ["phone2", "altphone", "alternatephone", "secondaryphone", "mobile2"],
  email: ["email", "emailaddress"],
  interestedProduct: ["interestedproduct", "product", "model"],
  temperature: ["temperature", "temp"],
};

function pick(row: string[], idx: Record<string, number>, field: string): string {
  for (const alias of FIELD_ALIASES[field] ?? [field]) {
    const at = idx[alias];
    if (at !== undefined && row[at] !== undefined) return String(row[at]).trim();
  }
  return "";
}

/**
 * Pulls new rows from one sheet and turns them into leads.
 *
 * Only ever reads forward from `lastRowImported`, so editing a row that was
 * already taken in does not create it a second time, and the cursor advances
 * even for rows that were skipped — otherwise one unusable row at the top of
 * the new block would be retried on every poll forever.
 */
export async function syncLeadSheet(sheetId: string, actor: CurrentUser): Promise<SyncResult> {
  const sheet = await findLeadSheet(sheetId);
  if (!sheet) throw new LeadSheetError("That sheet no longer exists");

  const base: SyncResult = {
    sheetId: sheet.id,
    name: sheet.name,
    rowsRead: 0,
    created: 0,
    skippedDuplicate: 0,
    skippedInvalid: 0,
    failed: 0,
  };

  let grid;
  try {
    grid = await fetchSheetGrid(sheet);
  } catch (error) {
    const message = error instanceof GoogleSheetsError || error instanceof Error ? error.message : "Unknown error";
    await updateLeadSheet(sheet.id, { lastPolledAt: new Date(), lastError: message });
    return { ...base, error: message };
  }

  if (grid.length === 0) {
    await updateLeadSheet(sheet.id, { lastPolledAt: new Date(), lastError: null });
    return base;
  }

  const idx = headerIndex(grid[0] ?? []);
  // Resolved through the aliases, not by literal key: a sheet headed
  // "Phone 1" is perfectly valid and was being rejected outright here even
  // though pick() knew how to read it.
  const hasField = (field: string) => (FIELD_ALIASES[field] ?? [field]).some((a) => idx[a] !== undefined);
  if (!hasField("name") || !hasField("phone")) {
    const message =
      'The sheet needs a header row with a name column and a phone column (e.g. "Name" and "Phone 1").';
    await updateLeadSheet(sheet.id, { lastPolledAt: new Date(), lastError: message });
    return { ...base, error: message };
  }

  // Every row is considered every time, and what has already been taken in
  // is decided by the phone number rather than by how far down the sheet we
  // got last time.
  //
  // A positional cursor looked cheaper but was quietly wrong here: a Google
  // Form appends at the first free row, which on a sheet padded with blank
  // formula rows is ABOVE where a previous run finished — so those leads sat
  // behind the cursor and would never have been imported. Matching on the
  // number is also immune to rows being sorted, inserted or deleted.
  const dataRows = grid.slice(1);

  const candidates = dataRows
    .map((row) => ({ row, name: pick(row, idx, "name"), phone: canonicalizePhone(pick(row, idx, "phone")) }))
    .filter((c) => c.name && c.phone.replace(/\D/g, "").length >= 6);

  const alreadyHave = await findExistingPhoneSet(candidates.map((c) => c.phone));
  const seenThisRun = new Set<string>();
  const newOnes = candidates.filter((c) => {
    if (alreadyHave.has(c.phone) || seenThisRun.has(c.phone)) return false;
    seenThisRun.add(c.phone);
    return true;
  });

  base.skippedInvalid = dataRows.length - candidates.length;
  base.skippedDuplicate = candidates.length - newOnes.length;
  const fresh = newOnes.slice(0, MAX_ROWS_PER_SYNC);
  base.rowsRead = dataRows.length;

  const assignees = sheet.assignees.filter((a) => a.user.active);
  if (assignees.length === 0 && fresh.length > 0) {
    const message = "No active telecaller is linked to this sheet, so its rows can't be handed to anyone.";
    await updateLeadSheet(sheet.id, { lastPolledAt: new Date(), lastError: message });
    return { ...base, error: message };
  }

  let rotation = sheet.nextAssigneeIndex;
  let created = 0;
  let skippedDuplicate = 0;
  let failed = 0;

  for (const { row, name, phone } of fresh) {
    // Only kept when it is a different, dialable number — intake sheets
    // very often repeat the primary in the second column.
    const secondaryRaw = canonicalizePhone(pick(row, idx, "phone2"));
    const phone2 =
      secondaryRaw && secondaryRaw !== phone && secondaryRaw.replace(/\D/g, "").length >= 6
        ? secondaryRaw
        : undefined;

    // Round-robin: each row goes to the next telecaller working this sheet,
    // so a shared sheet is split evenly rather than landing on one person.
    const assignee = assignees[rotation % assignees.length];
    rotation = (rotation + 1) % assignees.length;

    const temperatureRaw = pick(row, idx, "temperature").toUpperCase();
    const temperature = (["HOT", "WARM", "COLD"] as const).includes(temperatureRaw as "HOT")
      ? (temperatureRaw as "HOT" | "WARM" | "COLD")
      : "WARM";

    try {
      await createLead(
        {
          name: name.slice(0, 150),
          phone,
          phone2,
          email: pick(row, idx, "email") || undefined,
          interestedProduct: pick(row, idx, "interestedProduct") || undefined,
          temperature,
          priority: "MEDIUM",
          sourceId: sheet.sourceId ?? undefined,
          assignedUserId: assignee.userId,
          allowDuplicate: false,
          financingRequired: false,
        },
        actor,
        // Same reasoning as the CSV importer: a sheet can drop a block of
        // rows at once, and one welcome WhatsApp per row is the burst
        // pattern that gets a telecaller's number banned.
        { sendWelcomeMessage: false }
      );
      created++;
    } catch (error) {
      if (error instanceof DuplicateLeadError) skippedDuplicate++;
      else failed++;
    }
  }

  await updateLeadSheet(sheet.id, {
    // Kept for the settings page's "read to row N" line only; selection no
    // longer depends on it.
    lastRowImported: dataRows.length,
    nextAssigneeIndex: rotation,
    lastPolledAt: new Date(),
    lastError: null,
    ...(created > 0 ? { lastImportedAt: new Date(), totalImported: { increment: created } } : {}),
  });

  return {
    ...base,
    created,
    // Rows rejected mid-import (a race with a manual entry) add to the
    // count computed up front.
    skippedDuplicate: base.skippedDuplicate + skippedDuplicate,
    failed,
  };
}

export async function syncLeadSheetForAdmin(actor: CurrentUser, sheetId: string) {
  requireAdmin(actor);
  return syncLeadSheet(sheetId, actor);
}

/** Every enabled sheet — what the background poll runs. */
export async function syncAllLeadSheets(actor: CurrentUser): Promise<SyncResult[]> {
  const sheets = await listPollableLeadSheets();
  const results: SyncResult[] = [];
  for (const sheet of sheets) {
    // One bad sheet must not stop the others.
    try {
      results.push(await syncLeadSheet(sheet.id, actor));
    } catch (error) {
      results.push({
        sheetId: sheet.id,
        name: sheet.name,
        rowsRead: 0,
        created: 0,
        skippedDuplicate: 0,
        skippedInvalid: 0,
        failed: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }
  return results;
}
