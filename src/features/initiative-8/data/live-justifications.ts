/**
 * The I08 justification log, one page at a time from the server.
 *
 * ## Why it pages on the server
 *
 * It used to fetch the newest 200 and filter them in the browser. Past 200 the
 * tile stopped counting, and search, the dropdowns and the export quietly
 * worked on the newest 200 only, with nothing on screen saying the rest
 * existed. So the server pages, counts and searches, and the filters live in
 * the URL, the way the I13 OAR screens do theirs (see
 * `features/initiative-13/utils/search-params.ts`).
 *
 * ## Two counts
 *
 * The tile shows every justification on record; the line above the list shows
 * how many the filters match. With no filter they are one number and one
 * request. With a filter, a second one-row request reads the unfiltered count
 * and the dropdown values. Those come from the unfiltered call so that
 * choosing plant 1300 does not take 1500 out of the list.
 *
 * A plain module rather than part of the client component: the server page
 * reads these constants too, and anything exported from a "use client" file
 * reaches a server component as a client reference, not as its value.
 */

import {
  listJustifications,
  type ApiJustification,
  type JustificationListResponse,
} from "@/lib/api/assistant"
import { DEFAULT_PAGE_SIZE, pageOffset, parsePage } from "@/lib/pagination"

/** The only kind that is I08's -- see the page for why. */
export const I08_JUSTIFICATION_KIND = "NEW_ACQUISITION"

export const JUSTIFICATIONS_PATH = "/repairable-spares/justifications"

/** The largest page the backend serves (`limit` is capped at 500). */
export const EXPORT_BATCH_SIZE = 500

/** A ceiling on export requests, so a backend that ignored `offset` and kept
 *  returning full pages could never loop forever. 200 x 500 rows. */
const MAX_EXPORT_BATCHES = 200

/** What the log can be narrowed by. Each is a URL parameter of the same name. */
export type JustificationFilters = {
  q?: string
  plant?: string
  reason?: string
}

export type JustificationFacets = { plants: string[]; reasonCategories: string[] }

export type JustificationsPage = {
  items: ApiJustification[]
  /** Matching the filters. */
  total: number
  /** Every I08 justification on record, whatever the filters. */
  overall: number
  facets: JustificationFacets
}

type FetchPage = typeof listJustifications

/** Next hands `searchParams` as possibly-repeated values. */
export type RawSearchParams = Record<string, string | string[] | undefined>

/**
 * One value, or undefined. A repeated parameter is a malformed link, not a
 * list to pick from -- the rule the I13 screens apply.
 */
function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return undefined
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

export function parseJustificationParams(raw: RawSearchParams): {
  filters: JustificationFilters
  page: number
} {
  return {
    filters: { q: single(raw.q), plant: single(raw.plant), reason: single(raw.reason) },
    page: parsePage(raw.page) ?? 1,
  }
}

export function isFiltered(filters: JustificationFilters): boolean {
  return Boolean(filters.q || filters.plant || filters.reason)
}

/**
 * The link to one page of the log, keeping the filters. Page 1 drops `page`,
 * so the plain screen and its first page are one URL.
 */
export function justificationsHref(filters: JustificationFilters, page = 1): string {
  const params = new URLSearchParams()
  if (filters.q) params.set("q", filters.q)
  if (filters.plant) params.set("plant", filters.plant)
  if (filters.reason) params.set("reason", filters.reason)
  if (page > 1) params.set("page", String(page))
  const query = params.toString()
  return query ? `${JUSTIFICATIONS_PATH}?${query}` : JUSTIFICATIONS_PATH
}

function filterParams(filters: JustificationFilters) {
  return {
    kind: I08_JUSTIFICATION_KIND,
    q: filters.q,
    plant: filters.plant,
    reasonCategory: filters.reason,
  }
}

/**
 * The dropdown values. A backend from before paging sends no facets; then the
 * rows in hand are the best there is, which is what the screen did before.
 */
function facetsOf(body: JustificationListResponse): JustificationFacets {
  if (body.facets) return body.facets
  return {
    plants: [...new Set(body.items.map((e) => e.plant).filter(Boolean))].sort(),
    reasonCategories: [
      ...new Set(body.items.map((e) => e.reasonCategory).filter(Boolean)),
    ].sort(),
  }
}

export async function loadJustificationsPage(
  filters: JustificationFilters,
  page: number,
  {
    pageSize = DEFAULT_PAGE_SIZE,
    fetchPage = listJustifications,
  }: { pageSize?: number; fetchPage?: FetchPage } = {}
): Promise<JustificationsPage> {
  const offset = pageOffset(page, pageSize)

  if (!isFiltered(filters)) {
    const body = await fetchPage({ kind: I08_JUSTIFICATION_KIND, limit: pageSize, offset })
    return { items: body.items, total: body.total, overall: body.total, facets: facetsOf(body) }
  }

  const [unfiltered, matching] = await Promise.all([
    fetchPage({ kind: I08_JUSTIFICATION_KIND, limit: 1 }),
    fetchPage({ ...filterParams(filters), limit: pageSize, offset }),
  ])
  return {
    items: matching.items,
    total: matching.total,
    overall: unfiltered.total,
    facets: facetsOf(unfiltered),
  }
}

/**
 * Every justification the filters match, newest first, for the export.
 *
 * Fetched in the largest pages the backend allows until the count is reached.
 * Deduplicated by id: a justification recorded mid-export pushes every row
 * down by one, so the next batch would repeat the last row of this one. It
 * cannot skip a row, because new ones only ever arrive at the top.
 */
export async function fetchAllJustifications(
  filters: JustificationFilters,
  fetchPage: FetchPage = listJustifications
): Promise<ApiJustification[]> {
  const byId = new Map<string, ApiJustification>()
  let offset = 0
  for (let batch = 0; batch < MAX_EXPORT_BATCHES; batch++) {
    const body = await fetchPage({ ...filterParams(filters), limit: EXPORT_BATCH_SIZE, offset })
    for (const item of body.items) if (!byId.has(item.id)) byId.set(item.id, item)
    offset += body.items.length
    if (body.items.length < EXPORT_BATCH_SIZE || offset >= body.total) break
  }
  return [...byId.values()]
}
