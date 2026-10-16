"use client"

import { useMemo, useState } from "react"

import { DEFAULT_PAGE_SIZE, pageCountOf } from "@/lib/pagination"

/**
 * Client-side pagination over rows already in the browser. Pair it with
 * `TablePagination`'s `onPageChange`.
 *
 * - `page` is 1-based and clamped to the current page count on every render,
 *   so a filter that shrinks the rows can never leave the view on a blank,
 *   past-the-end page.
 * - `resetKey` returns to page 1 when it changes — pass the active tab or the
 *   local filter values. Clamping alone would keep you on page 4 of a new,
 *   unrelated list.
 */
export function usePaginatedRows<T>(
  rows: T[],
  { pageSize = DEFAULT_PAGE_SIZE, resetKey = "" }: { pageSize?: number; resetKey?: string } = {}
) {
  const [state, setState] = useState({ key: resetKey, page: 1 })

  const pageCount = pageCountOf(rows.length, pageSize)
  const requested = state.key === resetKey ? state.page : 1
  const page = Math.min(Math.max(1, requested), pageCount)
  const paged = useMemo(
    () => rows.slice((page - 1) * pageSize, page * pageSize),
    [rows, page, pageSize]
  )

  return {
    paged,
    page,
    pageSize,
    total: rows.length,
    setPage: (next: number) => setState({ key: resetKey, page: next }),
  }
}
