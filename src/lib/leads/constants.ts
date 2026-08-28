/**
 * Lead-module constants shared between the seed script and services.
 *
 * Statuses/sources/results/lost-reasons themselves are DB rows (Settings-
 * editable, per 01-architecture.md §2) — these are the small set of fixed
 * *names* the app's business logic has to special-case (closing a deal,
 * requiring a lost reason, limiting what a Telecaller can set).
 */

export const WON_STATUS_NAME = "WON";
export const LOST_STATUS_NAME = "LOST";

/** CallActivity.callStatus values that count as "didn't connect" for calling-activity stats. */
export const NOT_CONNECTED_CALL_STATUSES = ["NOT_CONNECTED", "BUSY", "SWITCHED_OFF", "WRONG_NUMBER"];

/**
 * §3 permission matrix: Telecaller gets "Change lead status — Limited set
 * (configurable)". The schema has nowhere to encode that restriction as
 * data yet (no per-role allowed-statuses table), so it lives here as a
 * single Setting row (key below) that Admin can edit once Settings exists.
 * Telecallers may move a lead through initial contact/follow-up, or mark
 * it not-interested/invalid/duplicate — anything past qualification
 * (pricing, negotiation, factory visit, WON/LOST) needs a Sales Manager
 * or Admin.
 */
export const TELECALLER_ALLOWED_STATUSES_SETTING_KEY = "telecaller_allowed_lead_statuses";

export const DEFAULT_TELECALLER_ALLOWED_STATUSES = [
  "NEW",
  "CONTACTED",
  "CONNECTED",
  "NOT_CONNECTED",
  "FOLLOW_UP",
  "INTERESTED",
  "NOT_INTERESTED",
  "INVALID",
  "DUPLICATE",
];

/**
 * §6 Follow-up Lifecycle: a plain numbered cadence, not tied to specific
 * lead statuses (the schema's FollowUpRule has no status column). Rule 1
 * fires when a lead first needs a follow-up; completing a follow-up with
 * "continue" checked advances to the next sequence number; WON/LOST stops
 * the chain (see followup.service.ts).
 */
export const DEFAULT_FOLLOWUP_RULES: {
  sequenceNumber: number;
  daysAfterPrevious: number;
  defaultTime: string;
}[] = [
  { sequenceNumber: 1, daysAfterPrevious: 1, defaultTime: "10:00" },
  { sequenceNumber: 2, daysAfterPrevious: 2, defaultTime: "10:00" },
  { sequenceNumber: 3, daysAfterPrevious: 3, defaultTime: "10:00" },
  { sequenceNumber: 4, daysAfterPrevious: 5, defaultTime: "10:00" },
  { sequenceNumber: 5, daysAfterPrevious: 7, defaultTime: "10:00" },
];

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Andaman and Nicobar Islands",
  "Chandigarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Jammu and Kashmir",
  "Ladakh",
  "Lakshadweep",
  "Puducherry",
];
