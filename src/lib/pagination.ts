/**
 * Page arithmetic shared by every paged table — server-paged (I13's URL
 * `?page=`) and client-paged (rows already in hand) alike.
 *
 * Pages are **1-based** everywhere they are seen: in the URL, in the label and
 * in these helpers. A 0-based page in a link somebody was sent is an off-by-one
 * waiting for a support ticket.
 */

/** Rows per page unless a screen says otherwise. */
export const DEFAULT_PAGE_SIZE = 25

/** At least one page, so an empty list reads "Page 1 of 1", never "of 0". */
export function pageCountOf(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

/**
 * A `?page=` value, or undefined.
 *
 * Only a whole number of 1 or more is a page. Anything else — `0`, `-2`, `2.5`,
 * `abc`, a repeated parameter — is treated as absent rather than guessed at,
 * which lands the reader on page 1.
 */
export function parsePage(value: string | string[] | undefined): number | undefined {
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return undefined
  const page = Number(value.trim())
  return Number.isSafeInteger(page) && page >= 1 ? page : undefined
}

/** The row offset a 1-based page starts at. */
export function pageOffset(page: number, pageSize: number): number {
  return (Math.max(1, page) - 1) * pageSize
}

export type PageWindow = {
  page: number
  /** `null` when the total is unknown. */
  pageCount: number | null
  /** 1-based position of the first and last row shown; 0 when nothing is. */
  first: number
  last: number
  hasPrevious: boolean
  hasNext: boolean
}

/**
 * Where a page sits in the whole list.
 *
 * `count` is the rows actually on this page. With an unknown `total` (a route
 * that sends no count) a full page is the only hint that another may follow,
 * so Next stays enabled exactly then.
 */
export function pageWindow({
  page,
  pageSize,
  total,
  count,
}: {
  page: number
  pageSize: number
  total: number | null
  count: number
}): PageWindow {
  const first = count > 0 ? pageOffset(page, pageSize) + 1 : 0
  const last = count > 0 ? first + count - 1 : 0
  const pageCount = total === null ? null : pageCountOf(total, pageSize)
  return {
    page,
    pageCount,
    first,
    last,
    hasPrevious: page > 1,
    hasNext: pageCount === null ? count >= pageSize : page < pageCount,
  }
}
