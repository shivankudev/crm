/** Digits-only phone, for dedupe/search. Keeps a leading "+" strips to digits too. */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}

/**
 * The one stored form for a phone number, whatever a telecaller typed.
 *
 * Staff enter the same number half a dozen ways — "+91 98765 43210",
 * "98765-43210", "09876543210", "919876543210" — and each was stored
 * verbatim, so one lead list showed five different shapes for numbers of
 * the same kind, and a number typed one way looked nothing like the same
 * number typed another.
 *
 * The business is Indian and 96% of existing rows are already bare
 * ten-digit numbers, which is also what toWhatsAppChatId() assumes when it
 * prepends the country code. So that is the canonical form: digits only,
 * with an Indian country code or STD trunk prefix removed when one is
 * clearly present.
 *
 * Anything that isn't recognisably an Indian mobile — a nine-digit entry, a
 * genuinely foreign number — keeps all of its digits rather than being
 * mangled into a wrong number. It still comes back digits-only, so the
 * column is consistent either way.
 */
export function canonicalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");

  // Indian mobile numbers start 6-9. Requiring that before stripping a
  // prefix stops a legitimate foreign number that merely begins "91" or
  // "0" from losing its leading digits.
  const isIndianMobile = (s: string) => /^[6-9]\d{9}$/.test(s);

  if (digits.length === 12 && digits.startsWith("91") && isIndianMobile(digits.slice(2))) {
    return digits.slice(2);
  }
  if (digits.length === 11 && digits.startsWith("0") && isIndianMobile(digits.slice(1))) {
    return digits.slice(1);
  }
  return digits;
}

/**
 * Read-back grouping for the UI — "98765 43210". Display only; never
 * stored, never used for matching or dialling.
 *
 * Deliberately a pure string transform with no locale or timezone input, so
 * the server and the browser always produce the same characters and it
 * can't reintroduce a hydration mismatch.
 */
export function formatPhoneForDisplay(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (/^[6-9]\d{9}$/.test(digits)) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  return raw;
}
