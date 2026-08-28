/**
 * Locale-fixed date formatting. `toLocaleDateString()`/`toLocaleString()`
 * without an explicit locale resolve against each environment's default
 * ICU locale — Node's SSR process and the browser can disagree even on
 * the same machine, which trips React hydration mismatches. Always pass
 * a fixed locale so server and client render identical text.
 */
const LOCALE = "en-IN";

export function formatDate(value: string | Date): string {
  return new Date(value).toLocaleDateString(LOCALE);
}

export function formatDateTime(value: string | Date): string {
  return new Date(value).toLocaleString(LOCALE);
}
