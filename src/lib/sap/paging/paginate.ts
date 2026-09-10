// W2.3 — paged extraction, with a fallback for the sets where `$count` 500s.
//
// Both modes are main paths, not one main path and one edge case:
// requisitions drive I07's PR-to-PO view and goods movements drive
// consumption everywhere, and `$count` is broken on both.

import type { CpiClient } from "../client/client"
import type { SapRow } from "../client/decode-row"
import { orderByFor, pagingConfigFor, SAFETY_LIMITS, type CountMode } from "./config"

export interface ExtractOptions {
  /** OData `$filter`. Required for sets configured `filtered-only`. */
  filter?: string
  select?: string[]
  pageSize?: number
  maxPages?: number
  maxRows?: number
  /** Called when `auto` demotes itself to fallback, so the demotion is visible. */
  onDemotion?: (entitySet: string, reason: string) => void
}

export interface ExtractResult {
  entitySet: string
  rows: SapRow[]
  /** How many HTTP page reads it took. */
  pages: number
  /** Which mode actually ran — not which was configured. */
  countMode: Exclude<CountMode, "auto">
  /** True when `auto` fell back because `$count` failed. */
  demoted: boolean
  /** Explicit, so a zero-row extraction is reportable rather than a bland empty array (§1.3). */
  status: "rows" | "empty"
  /** True when a safety ceiling stopped the extraction early. The result is incomplete. */
  truncated: boolean
  /** Total reported by `$count`, when it answered. */
  reportedTotal: number | null
}

export class UnfilteredExtractError extends Error {}

const DEFAULT_PAGE_SIZE = 1000

function buildQuery(parts: {
  filter?: string
  select?: string[]
  orderBy: string[]
  top: number
  skip: number
}): string {
  const query: string[] = []
  if (parts.filter) query.push(`$filter=${parts.filter}`)
  if (parts.select?.length) query.push(`$select=${parts.select.join(",")}`)
  // Never page without $orderby: $skip/$top over an unordered result can
  // silently skip or duplicate rows. We watched exactly that happen against
  // live CPI in phase 0 — two identical scans disagreed until $orderby was
  // added (phase_summary.md Phase 0).
  if (parts.orderBy.length) query.push(`$orderby=${parts.orderBy.join(",")}`)
  query.push(`$top=${parts.top}`)
  if (parts.skip > 0) query.push(`$skip=${parts.skip}`)
  return query.join("&")
}

/**
 * Read an entire entity set (or an entire filtered slice of one), paging
 * safely in whichever mode the set is configured for.
 */
export async function extract(
  client: CpiClient,
  entitySet: string,
  options: ExtractOptions = {}
): Promise<ExtractResult> {
  const config = pagingConfigFor(entitySet)

  if (config.extract === "filtered-only" && !options.filter) {
    throw new UnfilteredExtractError(
      `${entitySet} is configured extract: "filtered-only" and cannot be read without a $filter. ` +
        `It holds far too many rows to extract whole (§1.4) — filter at SAP instead.`
    )
  }

  const pageSize = options.pageSize ?? config.pageSize ?? DEFAULT_PAGE_SIZE
  const maxPages = options.maxPages ?? SAFETY_LIMITS.maxPages
  const maxRows = options.maxRows ?? SAFETY_LIMITS.maxRows
  const orderBy = orderByFor(entitySet)

  let mode: Exclude<CountMode, "auto"> = config.countMode === "fallback" ? "fallback" : "counted"
  let demoted = false
  let reportedTotal: number | null = null

  if (mode === "counted") {
    reportedTotal = await client.count(entitySet, options.filter ? { query: `$filter=${options.filter}` } : {})
    if (reportedTotal === null) {
      // $count could not answer. Demote rather than fail the extraction —
      // this is exactly what "auto" exists for, and it is how a set
      // self-promotes again once SAP fixes it.
      mode = "fallback"
      demoted = true
      options.onDemotion?.(entitySet, "$count returned a server error; falling back to short-page paging")
    }
  }

  const rows: SapRow[] = []
  let pages = 0
  let truncated = false

  for (let skip = 0; ; skip += pageSize) {
    if (pages >= maxPages) {
      truncated = true
      break
    }

    const remaining = maxRows - rows.length
    if (remaining <= 0) {
      truncated = true
      break
    }

    const top = Math.min(pageSize, remaining)
    const page = await client.read(entitySet, {
      query: buildQuery({ filter: options.filter, select: options.select, orderBy, top, skip }),
    })
    pages++

    rows.push(...page.rows)

    // An empty FIRST page is ambiguous — a genuinely empty set, or a blip.
    // Ask once more before believing it (§4).
    if (page.rows.length === 0 && skip === 0 && pages === 1) {
      const retry = await client.read(entitySet, {
        query: buildQuery({ filter: options.filter, select: options.select, orderBy, top, skip }),
      })
      pages++
      rows.push(...retry.rows)
      if (retry.rows.length === 0) break
      if (retry.rows.length < top) break
      continue
    }

    if (mode === "counted" && reportedTotal !== null) {
      if (rows.length >= reportedTotal) break
    }

    // Short page means last page. A page that exactly fills $top is ambiguous,
    // so we ask once more and expect an empty page — the classic off-by-one.
    if (page.rows.length < top) break
  }

  return {
    entitySet,
    rows,
    pages,
    countMode: mode,
    demoted,
    status: rows.length === 0 ? "empty" : "rows",
    truncated,
    reportedTotal,
  }
}
