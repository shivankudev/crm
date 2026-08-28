/**
 * Dealer-module constants. Unlike LeadStatus, DealerStatus has no
 * `isTerminal` column in the schema, so which names are terminal/gated
 * lives here instead — same "code, not a migration" tradeoff already made
 * for lead status names in lib/leads/constants.ts.
 */

/** §5: "AGREEMENT → DEALER_CODE issued" — the exact transition that mints a dealerCode. */
export const DEALER_CODE_ISSUE_STATUS_NAME = "AGREEMENT";

/**
 * §3: "Approve dealer onboarding stage" is its own permission
 * (DEALERS_APPROVE_ONBOARDING), separate from general "Manage dealers"
 * (DEALERS_MANAGE) — Admin has both today, but the gate is enforced
 * independently so a narrower future role could have one without the other.
 */
export const DEALER_APPROVAL_STATUS_NAME = "APPROVED";

/** §5: "REJECTED / SUSPENDED / INACTIVE reachable from most states" — exit states that stop the follow-up chain. */
export const DEALER_TERMINAL_STATUSES = ["REJECTED", "SUSPENDED", "INACTIVE"];

/** Statuses excluded from the /dealers/onboarding board: not yet started, or already exited. */
export const DEALER_ONBOARDING_EXCLUDED_STATUSES = ["PROSPECT", "ACTIVE_DEALER", ...DEALER_TERMINAL_STATUSES];

/** §5 order, used to drive the onboarding stepper UI. */
export const DEALER_ONBOARDING_SEQUENCE = [
  "PROSPECT",
  "CONTACTED",
  "INTERESTED",
  "DOCUMENTS_REQUESTED",
  "DOCUMENTS_RECEIVED",
  "VERIFICATION",
  "APPROVED",
  "AGREEMENT",
  "OPENING_ORDER",
  "ACTIVE_DEALER",
];

/** schema.prisma DealerDocument.docType comment. */
export const DEALER_DOC_TYPES = [
  "PAN",
  "GST",
  "ID_PROOF",
  "ADDRESS_PROOF",
  "BANK_DETAILS",
  "CANCELLED_CHEQUE",
  "SHOP_PHOTO",
  "AGREEMENT",
];
