/** Digits-only phone, for dedupe/search. Keeps a leading "+" strips to digits too. */
export function normalizePhone(raw: string): string {
  return raw.replace(/\D/g, "");
}
