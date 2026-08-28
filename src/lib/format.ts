/**
 * Locale- AND timezone-fixed date formatting.
 *
 * Pinning only the locale is not enough. `toLocaleDateString()` still
 * resolves the *timezone* per environment, and in production the Next
 * server runs in a Docker container on UTC while every browser reading it
 * is on IST. A timestamp of 20:30 UTC then renders as 21/8 on the server
 * and 22/8 in the browser: React reports a hydration mismatch and throws
 * away the tree, and for a moment staff see the wrong day.
 *
 * The business runs in one timezone, so both halves are pinned to it and
 * server and client always agree.
 */
const LOCALE = "en-IN";
const TIME_ZONE = "Asia/Kolkata";

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString(LOCALE, { timeZone: TIME_ZONE });
}

export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString(LOCALE, { timeZone: TIME_ZONE });
}
