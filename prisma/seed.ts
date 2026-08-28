import { PrismaClient } from "@prisma/client";
import * as argon2 from "argon2";
import {
  PERMISSIONS,
  PERMISSION_LABELS,
  ROLE_NAMES,
  ROLE_PERMISSION_MATRIX,
  type RoleName,
} from "../src/lib/rbac/permissions";
import {
  DEFAULT_FOLLOWUP_RULES,
  DEFAULT_TELECALLER_ALLOWED_STATUSES,
  INDIAN_STATES,
  TELECALLER_ALLOWED_STATUSES_SETTING_KEY,
} from "../src/lib/leads/constants";

const prisma = new PrismaClient();

async function seedRolesAndPermissions() {
  const roles: Record<RoleName, { id: string }> = {} as never;

  for (const name of Object.values(ROLE_NAMES)) {
    roles[name] = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const permissionRows: Record<string, { id: string }> = {};
  for (const key of Object.values(PERMISSIONS)) {
    permissionRows[key] = await prisma.permission.upsert({
      where: { key },
      update: { label: PERMISSION_LABELS[key] },
      create: { key, label: PERMISSION_LABELS[key] },
    });
  }

  for (const [roleName, keys] of Object.entries(ROLE_PERMISSION_MATRIX) as [
    RoleName,
    string[]
  ][]) {
    const roleId = roles[roleName].id;
    for (const key of keys) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId: permissionRows[key].id } },
        update: { allowed: true },
        create: { roleId, permissionId: permissionRows[key].id, allowed: true },
      });
    }

    // Revoke anything this role no longer has in the matrix. Without this
    // the matrix is additive only: a permission removed from the code is
    // left granted forever in the database, so a role can never actually
    // lose access. There is no UI for editing role permissions — the matrix
    // is the single source of truth — so reconciling here can't clobber
    // anyone's hand-made customisation.
    const grantedIds = keys.map((k) => permissionRows[k].id);
    const revoked = await prisma.rolePermission.deleteMany({
      where: { roleId, permissionId: { notIn: grantedIds } },
    });
    if (revoked.count > 0) {
      console.log(`  ${roleName}: revoked ${revoked.count} permission(s) no longer in the matrix.`);
    }
  }

  console.log(`Seeded ${Object.keys(roles).length} roles and ${Object.keys(permissionRows).length} permissions.`);
  return roles;
}

async function seedLeadLookups() {
  const statuses: { name: string; sortOrder: number; isTerminal?: boolean }[] = [
    { name: "NEW", sortOrder: 10 },
    { name: "CONTACTED", sortOrder: 20 },
    { name: "CONNECTED", sortOrder: 30 },
    { name: "NOT_CONNECTED", sortOrder: 40 },
    { name: "FOLLOW_UP", sortOrder: 50 },
    { name: "INTERESTED", sortOrder: 60 },
    { name: "QUALIFIED", sortOrder: 70 },
    { name: "PRICE_SHARED", sortOrder: 80 },
    { name: "FINANCE_REQUIRED", sortOrder: 90 },
    { name: "FACTORY_VISIT", sortOrder: 100 },
    { name: "NEGOTIATION", sortOrder: 110 },
    { name: "READY_TO_ORDER", sortOrder: 120 },
    { name: "WON", sortOrder: 130, isTerminal: true },
    { name: "LOST", sortOrder: 140, isTerminal: true },
    { name: "NOT_INTERESTED", sortOrder: 150, isTerminal: true },
    { name: "INVALID", sortOrder: 160, isTerminal: true },
    { name: "DUPLICATE", sortOrder: 170, isTerminal: true },
  ];

  for (const s of statuses) {
    // update: {} — sortOrder/isTerminal are Settings-editable (see
    // updateLeadStatus); re-asserting the shipped defaults here on every
    // reseed would silently undo an Admin's reordering or terminal-flag
    // change the next time this runs (redeploy, `docker compose up`,
    // migration container restart). This only ever creates a status
    // that's missing — an existing one is never touched.
    await prisma.leadStatus.upsert({
      where: { name: s.name },
      update: {},
      create: { name: s.name, sortOrder: s.sortOrder, isTerminal: s.isTerminal ?? false },
    });
  }

  const sources = [
    "Website",
    "IndiaMART",
    "Facebook Ads",
    "Google Ads",
    "Walk-in",
    "Referral",
    "Cold Call",
    "Exhibition",
    "Other",
  ];
  for (const name of sources) {
    await prisma.leadSource.upsert({ where: { name }, update: {}, create: { name } });
  }

  const lostReasons = [
    "Price too high",
    "Bought from competitor",
    "Not interested anymore",
    "Financing not approved",
    "No response",
    "Out of service area",
  ];
  for (const name of lostReasons) {
    await prisma.lostReason.upsert({ where: { name }, update: {}, create: { name } });
  }

  const results = ["Connected - Interested", "Connected - Not Interested", "Not Reachable", "Wrong Number", "Call Back Later"];
  for (const name of results) {
    await prisma.resultOption.upsert({ where: { name }, update: {}, create: { name } });
  }

  const dealerStatuses: { name: string; sortOrder: number }[] = [
    { name: "PROSPECT", sortOrder: 10 },
    { name: "CONTACTED", sortOrder: 20 },
    { name: "INTERESTED", sortOrder: 30 },
    { name: "DOCUMENTS_REQUESTED", sortOrder: 40 },
    { name: "DOCUMENTS_RECEIVED", sortOrder: 50 },
    { name: "VERIFICATION", sortOrder: 60 },
    { name: "APPROVED", sortOrder: 70 },
    { name: "AGREEMENT", sortOrder: 80 },
    { name: "OPENING_ORDER", sortOrder: 90 },
    { name: "ACTIVE_DEALER", sortOrder: 100 },
    { name: "REJECTED", sortOrder: 110 },
    { name: "SUSPENDED", sortOrder: 120 },
    { name: "INACTIVE", sortOrder: 130 },
  ];
  for (const s of dealerStatuses) {
    // Same reasoning as leadStatus above — sortOrder is Settings-editable
    // (updateDealerStatus), so a reseed must only fill in a missing row,
    // never overwrite one that already exists.
    await prisma.dealerStatus.upsert({
      where: { name: s.name },
      update: {},
      create: { name: s.name, sortOrder: s.sortOrder },
    });
  }

  console.log("Seeded lead statuses, sources, lost reasons, results, and dealer statuses.");
}

async function seedGeography() {
  for (const name of INDIAN_STATES) {
    await prisma.state.upsert({ where: { name }, update: {}, create: { name } });
  }
  console.log(`Seeded ${INDIAN_STATES.length} states (districts/cities: none yet — future phase).`);
}

async function seedFollowUpRules() {
  // Create-if-missing only. daysAfterPrevious/defaultTime are Settings-
  // editable (the Follow-up cadence editor) — this used to re-assert the
  // hardcoded defaults over an existing row on every run, which meant any
  // Admin-edited cadence gap would silently revert to these shipped
  // values the next time seed ran (redeploy, `docker compose up`, a
  // rebuilt migrate/seed container). A restart must never touch a
  // cadence rule that already exists, only add one that's missing.
  let created = 0;
  for (const rule of DEFAULT_FOLLOWUP_RULES) {
    const existing = await prisma.followUpRule.findFirst({
      where: { sequenceNumber: rule.sequenceNumber, appliesTo: "LEAD" },
    });
    if (!existing) {
      await prisma.followUpRule.create({ data: { ...rule, appliesTo: "LEAD" } });
      created++;
    }
  }
  console.log(
    created > 0
      ? `Created ${created} missing follow-up rule(s) (existing rules left untouched).`
      : "Follow-up rules already present — left untouched."
  );
}

async function seedSettings() {
  await prisma.setting.upsert({
    where: { key: TELECALLER_ALLOWED_STATUSES_SETTING_KEY },
    update: {},
    create: {
      key: TELECALLER_ALLOWED_STATUSES_SETTING_KEY,
      value: DEFAULT_TELECALLER_ALLOWED_STATUSES,
    },
  });
  console.log("Seeded settings.");
}

async function seedSuperAdmin(superAdminRoleId: string) {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL ?? "admin@gatti-erickshaw.local";
  const name = process.env.SEED_SUPER_ADMIN_NAME ?? "Super Admin";
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD ?? "GattiAdmin@2026";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Super Admin already exists (${email}) — skipping.`);
    return;
  }

  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });

  await prisma.user.create({
    data: { name, email, passwordHash, roleId: superAdminRoleId },
  });

  console.log("\nSuper Admin created:");
  console.log(`  email:    ${email}`);
  console.log(`  password: ${password}`);
  console.log("  Change this password after first login.\n");
}

async function main() {
  const roles = await seedRolesAndPermissions();
  await seedLeadLookups();
  await seedGeography();
  await seedFollowUpRules();
  await seedSettings();
  await seedSuperAdmin(roles[ROLE_NAMES.SUPER_ADMIN].id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
