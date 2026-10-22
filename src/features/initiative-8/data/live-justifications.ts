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

import { single, type RawSearchParams } from "@/features/initiative-8/data/url-params"
import {
  listJustifications,
  type ApiJustification,
  type JustificationListResponse,
} from "@/lib/api/assistant"
import { getUniverse } from "@/lib/api/i8"
import { DEFAULT_PAGE_SIZE, pageOffset, parsePage } from "@/lib/pagination"

export type { RawSearchParams }

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

/** How long one description lookup may take before the row shows the number
 *  alone. The page waits for these, so it is short. */
const DESCRIPTION_TIMEOUT_MS = 5000

/** "000000008000004596" and "8000004596" are one material. */
function sameMaterial(a: string, b: string): boolean {
  return a.replace(/^0+(?=\d)/, "") === b.replace(/^0+(?=\d)/, "")
}

/** What a description lookup returns: materials, each with its description. */
export type MaterialLookup = (
  materialId: string,
) => Promise<{ items: { material: { materialId: string; description?: string | null } }[] }>

/** I08's own list of repairable materials, searched by number. */
const universeLookup: MaterialLookup = (materialId) => getUniverse({ search: materialId, pageSize: 5 })

/** `promise`, or a rejection after `ms` -- whichever comes first. */
function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`no answer within ${ms} ms`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * Descriptions for the materials on one page, by material number.
 *
 * A justification stores the number and nothing else about the part, and a
 * column of bare numbers is what made this screen hard to read
 * (I08_Live_UI_Redesign_Plan.md, L7). Every material here is an 80-series
 * repairable -- that is what a new-acquisition justification is about -- so
 * each distinct one on the page is looked up in I08's own list of them
 * (`GET /i8/universe?search=`), in parallel; a page holds a handful.
 *
 * Not the Spares Assistant's material search, which would look the obvious
 * choice: while the assistant's demo switch is on, as it is in the deployed
 * build, that search is a scripted stub and finds nothing.
 *
 * Best-effort, every one: a lookup that fails, times out or finds no
 * description leaves that row with the number alone. A label is never a
 * reason to fail the log.
 */
export async function loadMaterialDescriptions(
  materialIds: string[],
  lookup: MaterialLookup = universeLookup,
  timeoutMs = DESCRIPTION_TIMEOUT_MS,
): Promise<Record<string, string>> {
  const unique = [...new Set(materialIds.filter(Boolean))]
  const found = await Promise.all(
    unique.map(async (id) => {
      try {
        const body = await within(lookup(id), timeoutMs)
        const hit = body.items.find((item) => sameMaterial(item.material.materialId, id) && item.material.description)
        return hit?.material.description ? ([id, hit.material.description] as const) : null
      } catch {
        return null
      }
    }),
  )
  return Object.fromEntries(found.filter((pair) => pair !== null))
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
