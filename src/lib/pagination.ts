/**
 * Query-string pagination, coerced so a hostile or fat-fingered value can
 * never reach Prisma.
 *
 * `Number("abc")` is NaN and `Number("1e99")` is astronomically large; both
 * used to flow straight into `skip: (page - 1) * pageSize`, and Prisma
 * rejects a NaN/negative/overflowing skip by throwing — which surfaced to
 * the caller as a 500 on /leads, /dealers and both follow-up lists. A bad
 * page number is a bad request, not a server fault, so it is clamped to
 * something sane instead.
 */

export const DEFAULT_PAGE_SIZE = 50;
export const MAX_PAGE_SIZE = 200;

/** Keeps `(page - 1) * pageSize` inside a signed 32-bit int, which is Postgres's OFFSET limit. */
const MAX_PAGE = 1_000_000;

function toPositiveInt(raw: string | null, fallback: number, max: number): number {
  if (raw === null || raw.trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback; // NaN, Infinity
  const floored = Math.floor(n);
  if (floored < 1) return fallback; // 0 and negatives
  return Math.min(floored, max);
}

export function parsePagination(
  params: URLSearchParams,
  defaults: { pageSize?: number; maxPageSize?: number } = {}
): { page: number; pageSize: number } {
  const fallbackSize = defaults.pageSize ?? DEFAULT_PAGE_SIZE;
  const maxSize = defaults.maxPageSize ?? MAX_PAGE_SIZE;
  return {
    page: toPositiveInt(params.get("page"), 1, MAX_PAGE),
    pageSize: toPositiveInt(params.get("pageSize"), fallbackSize, maxSize),
  };
}
