/**
 * One-off: rewrites existing Lead/Dealer phone numbers into the canonical
 * form (see canonicalizePhone). Rows entered before input normalisation
 * kept whatever shape was typed, so the same kind of number appeared in
 * several shapes across one list.
 *
 * Dry run:  npx tsx scripts/backfill-phone-format.ts
 * Apply:    npx tsx scripts/backfill-phone-format.ts --apply
 */
import { PrismaClient } from "@prisma/client";
import { canonicalizePhone } from "../src/lib/phone";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

async function run() {
  let scanned = 0;
  let changed = 0;

  const leads = await prisma.lead.findMany({ select: { id: true, phone: true } });
  const dealers = await prisma.dealer.findMany({ select: { id: true, phone: true } });

  for (const { rows, kind } of [
    { rows: leads, kind: "lead" as const },
    { rows: dealers, kind: "dealer" as const },
  ]) {
    for (const row of rows) {
      scanned++;
      const next = canonicalizePhone(row.phone);
      // Never blank a number out: a row whose phone holds no digits at all
      // is left exactly as it is for a human to look at.
      if (!next || next === row.phone) continue;
      changed++;
      if (changed <= 25) {
        console.log(`  ${kind} ${row.id}: ${JSON.stringify(row.phone)} -> ${JSON.stringify(next)}`);
      }
      if (APPLY) {
        const data = { phone: next, phoneNormalized: next };
        if (kind === "lead") await prisma.lead.update({ where: { id: row.id }, data });
        else await prisma.dealer.update({ where: { id: row.id }, data });
      }
    }
  }

  console.log(`\n  scanned ${scanned}, ${APPLY ? "updated" : "would update"} ${changed}`);
  await prisma.$disconnect();
}

run().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
