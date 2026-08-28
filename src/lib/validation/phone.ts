import { z } from "zod";

/**
 * Phone fields, validated on digit count rather than raw length.
 *
 * A plain `.min(6)` counts characters, so "abcdefghij" passed and was stored
 * with an empty `phoneNormalized` — which broke two things at once: the lead
 * could never be called or messaged, and because duplicate detection matches
 * on `phoneNormalized`, every such lead collided with every other one ("a
 * lead with this phone number already exists" for two unrelated numbers).
 *
 * The CSV importer already required six digits; this is the same rule for
 * the API, so both doors into the database agree.
 */
const MIN_DIGITS = 6;
const MAX_LENGTH = 20;

const hasEnoughDigits = (v: string) => v.replace(/\D/g, "").length >= MIN_DIGITS;
const DIGITS_MESSAGE = `Must contain at least ${MIN_DIGITS} digits`;

/** A phone that must be present and dialable. */
export function requiredPhone() {
  return z.string().trim().min(1).max(MAX_LENGTH).refine(hasEnoughDigits, DIGITS_MESSAGE);
}

/**
 * A secondary number — may be omitted or cleared to "", but if something is
 * typed it has to be dialable, or it is worse than leaving it blank.
 */
export function optionalPhone() {
  return z
    .string()
    .trim()
    .max(MAX_LENGTH)
    .refine((v) => v === "" || hasEnoughDigits(v), DIGITS_MESSAGE);
}
