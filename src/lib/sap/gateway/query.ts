// W2.6a — apply an OData query to in-memory rows.

import { parseFilter } from "./odata-filter-parser"
import type { RawRow } from "./csv-source"

export interface ODataQuery {
  filter?: string
  top?: number
  skip?: number
  orderby?: string
  select?: string[]
  format?: string
}

export function parseQueryString(apiQuery: string): ODataQuery {
  const params = new URLSearchParams(apiQuery)
  const select = params.get("$select")
  const top = params.get("$top")
  const skip = params.get("$skip")
  return {
    filter: params.get("$filter") ?? undefined,
    top: top === null ? undefined : Number(top),
    skip: skip === null ? undefined : Number(skip),
    orderby: params.get("$orderby") ?? undefined,
    select: select ? select.split(",").map((s) => s.trim()) : undefined,
    format: params.get("$format") ?? undefined,
  }
}

function applyOrderBy(rows: RawRow[], orderby: string): RawRow[] {
  const terms = orderby.split(",").map((term) => {
    const [field, direction = "asc"] = term.trim().split(/\s+/)
    return { field, descending: direction.toLowerCase() === "desc" }
  })

  return [...rows].sort((a, b) => {
    for (const { field, descending } of terms) {
      const left = a[field] ?? ""
      const right = b[field] ?? ""
      if (left === right) continue
      return (left < right ? -1 : 1) * (descending ? -1 : 1)
    }
    return 0
  })
}

/**
 * Filter, order, then page — in that order, which is what OData mandates and
 * what makes `$skip`/`$top` stable across calls.
 */
export function applyQuery(rows: RawRow[], query: ODataQuery): RawRow[] {
  let result = rows

  if (query.filter) {
    const predicate = parseFilter(query.filter)
    result = result.filter((row) => predicate(row))
  }

  if (query.orderby) {
    result = applyOrderBy(result, query.orderby)
  }

  if (query.skip !== undefined) {
    result = result.slice(query.skip)
  }

  if (query.top !== undefined) {
    result = result.slice(0, query.top)
  }

  return result
}
