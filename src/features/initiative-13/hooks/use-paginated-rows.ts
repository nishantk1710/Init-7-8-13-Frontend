"use client"

import { useMemo, useState } from "react"

const DEFAULT_PAGE_SIZE = 25

/** Bounded client-side pagination over an already-filtered row array — see
 * §18 of the W6.7 task. `page` is clamped to the current `pageCount` on
 * every render, so a filter change that shrinks the row set can never leave
 * the view on a past-the-end (blank) page. */
export function usePaginatedRows<T>(rows: T[], pageSize: number = DEFAULT_PAGE_SIZE) {
  const [page, setPage] = useState(0)

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize))
  const safePage = Math.min(page, pageCount - 1)
  const paged = useMemo(() => rows.slice(safePage * pageSize, safePage * pageSize + pageSize), [rows, safePage, pageSize])

  return {
    paged,
    page: safePage,
    pageCount,
    hasPrevious: safePage > 0,
    hasNext: safePage < pageCount - 1,
    previous: () => setPage((p) => Math.max(0, p - 1)),
    next: () => setPage((p) => Math.min(pageCount - 1, p + 1)),
  }
}
