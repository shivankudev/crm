import { parseCsvWithHeader } from "@/lib/csv";
import { normalizePhone } from "@/lib/phone";
import { prisma } from "@/lib/prisma";
import { can, ForbiddenError } from "@/lib/rbac/can";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { createLead, DuplicateLeadError } from "@/services/lead.service";
import type { CurrentUser } from "@/lib/auth/current-user";

/**
 * Import runs synchronously within the request (loops calling
 * lead.service.createLead per row, so dedupe/leadCode/activity-log/
 * follow-up-scheduling all stay correct) rather than as a background
 * job — kept simple for now, at the cost of a hard row cap. A very large
 * bulk load (year-one data migration, say) should be split into files
 * under this cap rather than pushed through here in one request.
 */
const IMPORT_ROW_CAP = 2000;

const REQUIRED_COLUMNS = ["name", "phone"];

export class ImportServiceError extends Error {}

export type ImportPreviewRow = {
  rowNumber: number;
  name: string;
  phone: string;
  email?: string;
  interestedProduct?: string;
  temperature?: string;
  priority?: string;
  sourceId?: string;
  sourceName?: string;
  stateId?: string;
  stateName?: string;
  statusId?: string;
  statusName?: string;
  errors: string[];
  duplicateOf?: { id: string; leadCode: string; name: string } | null;
};

/** "Follow up 1", "not-interested", "READY TO ORDER" → "NOT_INTERESTED" — matches however loosely the sheet spelled it. */
function normalizeStatusKey(value: string): string {
  return value.trim().toUpperCase().replace(/[\s-]+/g, "_");
}

function requireImportExport(actor: CurrentUser) {
  if (!can(actor, PERMISSIONS.IMPORT_EXPORT)) throw new ForbiddenError();
}

export async function previewLeadImport(csvText: string, actor: CurrentUser) {
  requireImportExport(actor);

  const parsed = parseCsvWithHeader(csvText);
  if (parsed.length === 0) {
    return { rows: [] as ImportPreviewRow[], truncated: false, totalRows: 0 };
  }

  const headerColumns = Object.keys(parsed[0]).map((c) => c.toLowerCase());
  const missingRequired = REQUIRED_COLUMNS.filter((c) => !headerColumns.includes(c));
  if (missingRequired.length > 0) {
    throw new ImportServiceError(`CSV is missing required column(s): ${missingRequired.join(", ")}`);
  }

  const truncated = parsed.length > IMPORT_ROW_CAP;
  const slice = parsed.slice(0, IMPORT_ROW_CAP);

  const [sources, states, statuses] = await Promise.all([
    prisma.leadSource.findMany({ select: { id: true, name: true } }),
    prisma.state.findMany({ select: { id: true, name: true } }),
    prisma.leadStatus.findMany({ select: { id: true, name: true, active: true } }),
  ]);
  const sourceByName = new Map(sources.map((s) => [s.name.toLowerCase(), s]));
  const stateByName = new Map(states.map((s) => [s.name.toLowerCase(), s]));
  const statusByKey = new Map(statuses.filter((s) => s.active).map((s) => [normalizeStatusKey(s.name), s]));

  const rows: ImportPreviewRow[] = [];
  for (let i = 0; i < slice.length; i++) {
    const raw = slice[i];
    const get = (key: string) =>
      raw[key] ?? raw[Object.keys(raw).find((k) => k.toLowerCase() === key) ?? ""] ?? "";

    const name = get("name").trim();
    const phone = get("phone").trim();
    const errors: string[] = [];
    if (!name) errors.push("Missing name");
    if (!phone || phone.replace(/\D/g, "").length < 6) errors.push("Missing or invalid phone");

    const sourceName = get("source").trim();
    const source = sourceName ? sourceByName.get(sourceName.toLowerCase()) : undefined;
    if (sourceName && !source) errors.push(`Unknown source "${sourceName}"`);

    const stateName = get("state").trim();
    const state = stateName ? stateByName.get(stateName.toLowerCase()) : undefined;
    if (stateName && !state) errors.push(`Unknown state "${stateName}"`);

    const stageRaw = (get("status").trim() || get("stage").trim());
    const status = stageRaw ? statusByKey.get(normalizeStatusKey(stageRaw)) : undefined;
    if (stageRaw && !status) errors.push(`Unknown stage "${stageRaw}" — will not import until fixed or removed`);

    let duplicateOf: ImportPreviewRow["duplicateOf"] = null;
    if (phone) {
      const existing = await prisma.lead.findFirst({
        where: { phoneNormalized: normalizePhone(phone), deletedAt: null },
        select: { id: true, leadCode: true, name: true },
      });
      if (existing) duplicateOf = existing;
    }

    rows.push({
      rowNumber: i + 2, // +1 for header, +1 for 1-indexing
      name,
      phone,
      email: get("email").trim() || undefined,
      interestedProduct: get("interestedproduct").trim() || undefined,
      temperature: ["HOT", "WARM", "COLD"].includes(get("temperature").trim().toUpperCase())
        ? get("temperature").trim().toUpperCase()
        : undefined,
      priority: ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(get("priority").trim().toUpperCase())
        ? get("priority").trim().toUpperCase()
        : undefined,
      sourceId: source?.id,
      sourceName: source?.name,
      stateId: state?.id,
      stateName: state?.name,
      statusId: status?.id,
      statusName: status?.name,
      errors,
      duplicateOf,
    });
  }

  return { rows, truncated, totalRows: parsed.length };
}

export type CommitLeadImportRow = {
  name: string;
  phone: string;
  email?: string;
  interestedProduct?: string;
  temperature?: string;
  priority?: string;
  sourceId?: string;
  stateId?: string;
  statusId?: string;
  allowDuplicate?: boolean;
};

export async function commitLeadImport(rows: CommitLeadImportRow[], actor: CurrentUser) {
  requireImportExport(actor);
  if (rows.length > IMPORT_ROW_CAP) {
    throw new ImportServiceError(`Import is limited to ${IMPORT_ROW_CAP} rows per file — split larger files.`);
  }

  let created = 0;
  let skippedDuplicate = 0;
  let failed = 0;
  const failures: { row: CommitLeadImportRow; error: string }[] = [];

  for (const row of rows) {
    try {
      await createLead(
        {
          name: row.name,
          phone: row.phone,
          email: row.email,
          interestedProduct: row.interestedProduct,
          temperature: (row.temperature as "HOT" | "WARM" | "COLD") ?? "WARM",
          priority: (row.priority as "LOW" | "MEDIUM" | "HIGH" | "URGENT") ?? "MEDIUM",
          sourceId: row.sourceId,
          stateId: row.stateId,
          allowDuplicate: row.allowDuplicate ?? false,
          financingRequired: false,
        },
        actor,
        // No welcome WhatsApp on import: this loop runs once per row, so
        // leaving it on would blast one message per imported lead (up to
        // 2,000 at once) — a burst that gets the telecaller's number
        // banned. Imported leads still get their follow-up scheduled and
        // pick up the cadence normally from their first real call.
        { initialStatusId: row.statusId, sendWelcomeMessage: false }
      );
      created++;
    } catch (error) {
      if (error instanceof DuplicateLeadError) {
        skippedDuplicate++;
      } else {
        failed++;
        failures.push({ row, error: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  }

  return { created, skippedDuplicate, failed, failures };
}
